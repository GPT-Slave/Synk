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
      new Response('stale build asset', { headers: { 'Content-Type': 'application/javascript' } }),
    );
  });
  if (!(await page.evaluate(async () => (await caches.keys()).includes('synk-static-v2')))) {
    throw new Error('legacy cache fixture was not created');
  }

  // Loading Synk now runs the current PwaRegister. It replaces the controlling
  // legacy worker with /sw.js; the new worker purges synk-static-v2 and reloads
  // this already-open client once so it cannot keep an old Next.js runtime.
  await page.goto(base).catch(() => undefined);
  await page.waitForFunction(async () => {
    const controller = navigator.serviceWorker.controller;
    const registration = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    return Boolean(
      controller &&
        new URL(controller.scriptURL).pathname === '/sw.js' &&
        registration?.active &&
        new URL(registration.active.scriptURL).pathname === '/sw.js' &&
        !keys.includes('synk-static-v2'),
    );
  }, undefined, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');

  const badCacheEntries = await page.evaluate(async () => {
    const entries = [];
    for (const key of await caches.keys()) {
      if (!key.startsWith('synk-')) continue;
      const cache = await caches.open(key);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.startsWith('/_next/static/')) {
          entries.push({ cache: key, url: request.url });
        }
      }
    }
    return entries;
  });
  if (badCacheEntries.length) {
    throw new Error(`legacy Next.js cache entries survived upgrade: ${JSON.stringify(badCacheEntries)}`);
  }
  if (mainDocumentLoads < 2) {
    throw new Error(`legacy client was not refreshed after worker replacement; main loads=${mainDocumentLoads}`);
  }
  if (mainDocumentLoads > 4) {
    throw new Error(`worker replacement caused an apparent reload loop; main loads=${mainDocumentLoads}`);
  }

  await page.screenshot({ path: '/tmp/meeting-diagnostic/legacy-worker-upgraded.png', fullPage: true });
  console.log(JSON.stringify({
    oldCachePurged: true,
    activeWorker: await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    mainDocumentLoads,
    cachedNextAssets: badCacheEntries,
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
