const { chromium } = require('/tmp/pw/node_modules/playwright');
const base = 'http://localhost:3000';
const api = 'http://localhost:4000';
const staleAssetPath = '/_next/static/stale-meeting-client.js';

function scriptResources(page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.includes('/_next/static/') && /\.js(?:\?|$)/.test(url)),
  );
}

async function waitForCanonicalWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
  }
  await page.waitForFunction(() => {
    const controller = navigator.serviceWorker.controller;
    return Boolean(controller && new URL(controller.scriptURL).pathname === '/sw.js');
  });
}

async function cachedNextAssets(page) {
  return page.evaluate(async () => {
    const matches = [];
    for (const key of await caches.keys()) {
      if (!key.startsWith('synk-')) continue;
      const cache = await caches.open(key);
      for (const request of await cache.keys()) {
        if (new URL(request.url).pathname.startsWith('/_next/static/')) {
          matches.push({ cache: key, url: request.url });
        }
      }
    }
    return matches;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  let dashboardDocumentLoads = 0;

  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.request().isNavigationRequest() && url.pathname === '/dashboard') {
      dashboardDocumentLoads += 1;
    }
  });

  await page.goto(base);
  await waitForCanonicalWorker(page);

  const staticResources = await scriptResources(page);
  if (!staticResources.length) throw new Error('no Next.js static script resource was observed');
  const deploymentAsset = staticResources.find((url) => new URL(url).searchParams.has('dpl'));
  if (!deploymentAsset) {
    throw new Error(`deploymentId missing from static assets: ${staticResources.slice(0, 5).join(', ')}`);
  }

  const initiallyCachedNextAssets = await cachedNextAssets(page);
  if (initiallyCachedNextAssets.length) {
    throw new Error(`service worker caches Next.js code: ${JSON.stringify(initiallyCachedNextAssets)}`);
  }

  const password = 'MeetingRegressionPass1!';
  await page.goto(`${base}/signup`);
  await page.locator('#email').fill(`meeting-regression-${Date.now()}@example.com`);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create organizer account' }).click();
  await page.waitForURL('**/dashboard');

  const meeting = await page.evaluate(async ({ api }) => {
    const csrfResponse = await fetch(`${api}/auth/csrf`, { credentials: 'include' });
    if (!csrfResponse.ok) throw new Error(`csrf ${csrfResponse.status}: ${await csrfResponse.text()}`);
    const csrf = await csrfResponse.json();
    const response = await fetch(`${api}/meetings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({
        title: 'Meeting open regression',
        startDate: '2026-08-13',
        endDate: '2026-08-13',
        workdayStart: '08:00',
        workdayEnd: '10:00',
        slotIntervalMinutes: 15,
        meetingDurationMinutes: 30,
        timezone: 'Africa/Tunis',
      }),
    });
    if (!response.ok) throw new Error(`create ${response.status}: ${await response.text()}`);
    return response.json();
  }, { api });

  const detailUrl = `${base}/dashboard/meetings/${meeting.id}`;

  // Baseline organizer flow: prove the real meeting exists and renders in the
  // production build before exercising deployment recovery.
  await page.goto(detailUrl);
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  if (await page.getByText('Something went wrong').count()) throw new Error('global error boundary rendered on baseline open');
  if (await page.getByText('Meeting not found').count()) throw new Error('meeting not found rendered on baseline open');

  // Return to the organizer dashboard and reproduce the invariant behind the
  // regression: a currently controlled app client asks for a Next.js asset from
  // a deployment that no longer exists. The service worker must force one full
  // dashboard reload under the current deployment.
  await page.goto(`${base}/dashboard`);
  await waitForCanonicalWorker(page);
  const loadsBeforeRecovery = dashboardDocumentLoads;
  const staleProbe = await page.evaluate(async (staleAssetPath) => {
    const response = await fetch(staleAssetPath, { cache: 'reload' });
    return { status: response.status, body: await response.text() };
  }, staleAssetPath).catch(() => ({ status: 0, body: '' }));

  await page.waitForFunction(
    () => !new URL(window.location.href).searchParams.has('__synk_asset_refresh'),
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(500);

  if (staleProbe.status === 200) {
    throw new Error(`missing deployment asset unexpectedly returned 200: ${staleProbe.body.slice(0, 120)}`);
  }
  if (dashboardDocumentLoads <= loadsBeforeRecovery) {
    throw new Error(`missing Next.js asset did not trigger a full dashboard recovery load; before=${loadsBeforeRecovery}, after=${dashboardDocumentLoads}`);
  }

  // This is the user-visible regression check: immediately after recovering the
  // stale client, open the real organizer meeting and require the full heatmap.
  await page.goto(detailUrl);
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  await page.locator('[data-unified-heatmap="true"]').waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  if (await page.getByText('Something went wrong').count()) {
    throw new Error('global error boundary rendered after stale-client recovery');
  }
  if (await page.getByText('Meeting not found').count()) {
    throw new Error('meeting not found rendered after stale-client recovery');
  }

  await page.reload();
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });

  const finalCachedNextAssets = await cachedNextAssets(page);
  if (finalCachedNextAssets.length) {
    throw new Error(`Next.js assets appeared in Synk cache after recovery: ${JSON.stringify(finalCachedNextAssets)}`);
  }

  const unexpectedErrors = pageErrors.filter(
    (text) => !/ChunkLoadError|Loading chunk|dynamically imported module|module script/i.test(text),
  );
  if (unexpectedErrors.length) {
    throw new Error(`unexpected browser errors: ${unexpectedErrors.join('\n')}`);
  }

  await page.screenshot({ path: '/tmp/meeting-diagnostic/meeting-open-fixed.png', fullPage: true });
  console.log(JSON.stringify({
    deploymentAsset,
    staleProbeStatus: staleProbe.status,
    dashboardDocumentLoads,
    cachedNextAssets: finalCachedNextAssets,
    pageErrors,
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
