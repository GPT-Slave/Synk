const { chromium } = require('/tmp/pw/node_modules/playwright');
const base = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  let mainDocumentLoads = 0;
  page.on('response', (response) => {
    if (response.request().isNavigationRequest() && new URL(response.url()).pathname === '/') {
      mainDocumentLoads += 1;
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

  await page.evaluate(async () => {
    const cache = await caches.open('synk-static-v2');
    await cache.put(
      '/_next/static/stale-test.js',
      new Response('stale build asset', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' },
      }),
    );
  });
  if (!(await page.evaluate(async () => (await caches.keys()).includes('synk-static-v2')))) {
    throw new Error('legacy cache fixture was not created');
  }

  // Loading Synk runs the current PwaRegister. The new worker must take control
  // and force a real document refresh so this tab stops running the old build.
  await page.goto(base).catch(() => undefined);
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
  await page.waitForTimeout(1_250);

  if (mainDocumentLoads < 2) {
    throw new Error(`legacy client was not refreshed after worker replacement; main loads=${mainDocumentLoads}`);
  }
  if (mainDocumentLoads > 4) {
    throw new Error(`worker replacement caused an apparent reload loop; main loads=${mainDocumentLoads}`);
  }

  // A retired worker may finish an in-flight cache.put after its cache was
  // deleted and physically recreate the old CacheStorage object. What matters
  // is that the current worker never consults it. This seeded URL does not exist
  // on the server, so receiving the cached fixture would prove stale code can
  // still leak into the new app.
  const staleProbe = await page.evaluate(async () => {
    const response = await fetch('/_next/static/stale-test.js', { cache: 'reload' });
    return { status: response.status, body: await response.text() };
  });
  if (staleProbe.status === 200 && staleProbe.body === 'stale build asset') {
    throw new Error('current worker served a stale Next.js asset from synk-static-v2');
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
  if (visibleUrl.searchParams.has('__synk_sw_refresh')) {
    throw new Error(`internal service-worker refresh marker leaked into visible URL: ${visibleUrl.href}`);
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
    staleProbe,
    brandingCacheNextAssets,
    legacyCacheSnapshot,
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
