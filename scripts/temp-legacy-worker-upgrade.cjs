const { chromium } = require('/tmp/pw/node_modules/playwright');
const base = 'http://localhost:3000';
const staleAssetPath = '/_next/static/stale-test.js';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let mainDocumentLoads = 0;
  let staleAssetStatus;

  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.request().isNavigationRequest() && url.pathname === '/') {
      mainDocumentLoads += 1;
    }
    if (url.pathname === staleAssetPath) {
      staleAssetStatus = response.status();
    }
  });

  // Install the exact legacy cache-first behavior without loading the app (and
  // therefore without allowing the current PWA registration code to run yet).
  await page.goto(`${base}/legacy-sw-test.js`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/legacy-sw-test.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => {
    const controller = navigator.serviceWorker.controller;
    return Boolean(controller && new URL(controller.scriptURL).pathname === '/legacy-sw-test.js');
  });

  await page.evaluate(async (staleAssetPath) => {
    const cache = await caches.open('synk-static-v2');
    await cache.put(
      staleAssetPath,
      new Response('stale build asset', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      }),
    );
  }, staleAssetPath);
  if (!(await page.evaluate(async () => (await caches.keys()).includes('synk-static-v2')))) {
    throw new Error('legacy cache fixture was not created');
  }

  // Loading Synk replaces the legacy worker. The new worker does not cache or
  // read Next.js code; it waits until an old runtime actually asks for a chunk
  // that disappeared in the deployment, then reloads that tab once.
  await page.goto(base);
  await page.waitForFunction(async () => {
    const controller = navigator.serviceWorker.controller;
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(
      controller &&
        new URL(controller.scriptURL).pathname === '/sw.js' &&
        registration?.active &&
        new URL(registration.active.scriptURL).pathname === '/sw.js',
    );
  }, undefined, { timeout: 20_000 });

  const loadsBeforeStaleAsset = mainDocumentLoads;

  // This URL exists only in the retired cache. Under the current worker it must
  // go to the server, receive a failure, and force the existing tab to reload.
  await page
    .evaluate(async (staleAssetPath) => {
      await fetch(staleAssetPath, { cache: 'reload' });
    }, staleAssetPath)
    .catch(() => undefined);

  await page.waitForFunction(
    (previousLoads) => window.performance.getEntriesByType('navigation').length >= 1,
    loadsBeforeStaleAsset,
  );
  await page.waitForFunction(() => {
    const controller = navigator.serviceWorker.controller;
    return Boolean(controller && new URL(controller.scriptURL).pathname === '/sw.js');
  });
  await page.waitForTimeout(750);

  if (staleAssetStatus === 200) {
    throw new Error('current worker served the seeded stale Next.js asset instead of the network failure');
  }
  if (mainDocumentLoads <= loadsBeforeStaleAsset) {
    throw new Error(
      `missing Next.js asset did not refresh the stale client; before=${loadsBeforeStaleAsset}, after=${mainDocumentLoads}`,
    );
  }
  if (mainDocumentLoads > loadsBeforeStaleAsset + 2) {
    throw new Error(`missing asset recovery caused an apparent reload loop; main loads=${mainDocumentLoads}`);
  }

  const brandingCacheNextAssets = await page.evaluate(async () => {
    const cache = await caches.open('synk-branding-v3');
    const entries = [];
    for (const request of await cache.keys()) {
      if (new URL(request.url).pathname.startsWith('/_next/static/')) {
        entries.push(request.url);
      }
    }
    return entries;
  });
  if (brandingCacheNextAssets.length) {
    throw new Error(`new worker cached Next.js code: ${JSON.stringify(brandingCacheNextAssets)}`);
  }

  const visibleUrl = new URL(page.url());
  if (visibleUrl.searchParams.has('__synk_asset_refresh')) {
    throw new Error(`internal asset recovery marker leaked into visible URL: ${visibleUrl.href}`);
  }

  const legacyCacheSnapshot = await page.evaluate(async () => {
    const keys = await caches.keys();
    const exists = keys.includes('synk-static-v2');
    if (!exists) return { exists: false, nextAssetCount: 0 };
    const cache = await caches.open('synk-static-v2');
    const requests = await cache.keys();
    return {
      exists: true,
      nextAssetCount: requests.filter((request) =>
        new URL(request.url).pathname.startsWith('/_next/static/'),
      ).length,
    };
  });

  await page.screenshot({ path: '/tmp/meeting-diagnostic/legacy-worker-upgraded.png', fullPage: true });
  console.log(JSON.stringify({
    activeWorker: await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    mainDocumentLoads,
    loadsBeforeStaleAsset,
    staleAssetStatus,
    brandingCacheNextAssets,
    legacyCacheSnapshot,
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
