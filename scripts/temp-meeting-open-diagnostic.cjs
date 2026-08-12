const { chromium } = require('/tmp/pw/node_modules/playwright');
const base = 'http://localhost:3000';
const api = 'http://localhost:4000';

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
  const baselinePage = await context.newPage();
  const baselineErrors = [];
  baselinePage.on('pageerror', (error) => baselineErrors.push(error.stack || error.message));

  await baselinePage.goto(base);
  await waitForCanonicalWorker(baselinePage);

  const staticResources = await scriptResources(baselinePage);
  if (!staticResources.length) throw new Error('no Next.js static script resource was observed');
  const deploymentAsset = staticResources.find((url) => new URL(url).searchParams.has('dpl'));
  if (!deploymentAsset) {
    throw new Error(`deploymentId missing from static assets: ${staticResources.slice(0, 5).join(', ')}`);
  }

  const initiallyCachedNextAssets = await cachedNextAssets(baselinePage);
  if (initiallyCachedNextAssets.length) {
    throw new Error(`service worker caches Next.js code: ${JSON.stringify(initiallyCachedNextAssets)}`);
  }

  const password = 'MeetingRegressionPass1!';
  await baselinePage.goto(`${base}/signup`);
  await baselinePage.locator('#email').fill(`meeting-regression-${Date.now()}@example.com`);
  await baselinePage.locator('#password').fill(password);
  await baselinePage.locator('#confirm-password').fill(password);
  await baselinePage.getByRole('button', { name: 'Create organizer account' }).click();
  await baselinePage.waitForURL('**/dashboard');

  const meeting = await baselinePage.evaluate(async ({ api }) => {
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

  // Discover the route-specific production chunk and verify the normal organizer
  // path first. This page is used only as the baseline and is not reused for the
  // induced failure below.
  await baselinePage.goto(`${base}/dashboard`);
  const dashboardScripts = new Set(await scriptResources(baselinePage));
  await baselinePage.goto(detailUrl);
  await baselinePage.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await baselinePage.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  if (await baselinePage.getByText('Something went wrong').count()) throw new Error('global error boundary rendered on baseline open');
  if (await baselinePage.getByText('Meeting not found').count()) throw new Error('meeting not found rendered on baseline open');
  if (baselineErrors.length) throw new Error(`baseline page errors: ${baselineErrors.join('\n')}`);

  const meetingScripts = await scriptResources(baselinePage);
  const meetingOnlyScripts = meetingScripts.filter((url) => !dashboardScripts.has(url));
  if (!meetingOnlyScripts.length) {
    throw new Error(`no meeting-specific script found; meeting scripts: ${meetingScripts.join(', ')}`);
  }
  const targetChunk = meetingOnlyScripts[meetingOnlyScripts.length - 1];
  const targetPath = new URL(targetChunk).pathname;

  // Use a fresh authenticated tab and disable its HTTP cache so the meeting-only
  // chunk must be requested again. Fail that actual route chunk exactly once.
  // The service worker should observe the failed Next.js asset and reload the
  // requesting meeting document; after the one failure, the same chunk is served
  // normally and the meeting must finish rendering.
  const recoveryPage = await context.newPage();
  const cdp = await context.newCDPSession(recoveryPage);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  let failedChunkRequests = 0;
  let detailDocumentLoads = 0;
  const recoveryErrors = [];
  recoveryPage.on('pageerror', (error) => recoveryErrors.push(error.stack || error.message));
  recoveryPage.on('response', (response) => {
    const url = new URL(response.url());
    if (
      response.request().isNavigationRequest() &&
      url.pathname === `/dashboard/meetings/${meeting.id}`
    ) {
      detailDocumentLoads += 1;
    }
  });

  await recoveryPage.route(
    (url) => url.pathname === targetPath,
    async (route) => {
      failedChunkRequests += 1;
      if (failedChunkRequests === 1) {
        await route.fulfill({
          status: 404,
          contentType: 'text/plain; charset=utf-8',
          body: 'simulated stale deployment chunk',
        });
        return;
      }
      await route.continue();
    },
  );

  await recoveryPage.goto(`${base}/dashboard`);
  await waitForCanonicalWorker(recoveryPage);
  const loadsBeforeMeeting = detailDocumentLoads;

  await recoveryPage.goto(detailUrl).catch(() => undefined);
  await recoveryPage.getByRole('heading', { name: 'Meeting open regression' }).waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  await recoveryPage.locator('[data-unified-heatmap="true"]').waitFor({
    state: 'visible',
    timeout: 20_000,
  });

  if (failedChunkRequests < 2) {
    throw new Error(`meeting chunk did not fail once and retry; requests=${failedChunkRequests}, target=${targetChunk}`);
  }
  if (detailDocumentLoads <= loadsBeforeMeeting + 1) {
    throw new Error(`missing meeting chunk did not trigger an additional document recovery load; loads=${detailDocumentLoads}`);
  }
  if (await recoveryPage.getByText('Something went wrong').count()) {
    throw new Error('global error boundary remained after missing meeting chunk recovery');
  }
  if (await recoveryPage.getByText('Meeting not found').count()) {
    throw new Error('meeting not found remained after missing meeting chunk recovery');
  }
  if (new URL(recoveryPage.url()).searchParams.has('__synk_asset_refresh')) {
    throw new Error(`asset recovery marker leaked into visible URL: ${recoveryPage.url()}`);
  }

  const unexpectedRecoveryErrors = recoveryErrors.filter(
    (text) => !/ChunkLoadError|Loading chunk|dynamically imported module|module script/i.test(text),
  );
  if (unexpectedRecoveryErrors.length) {
    throw new Error(`unexpected recovery page errors: ${unexpectedRecoveryErrors.join('\n')}`);
  }

  await recoveryPage.reload();
  await recoveryPage.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await recoveryPage.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });

  const finalCachedNextAssets = await cachedNextAssets(recoveryPage);
  if (finalCachedNextAssets.length) {
    throw new Error(`Next.js assets appeared in Synk cache after recovery: ${JSON.stringify(finalCachedNextAssets)}`);
  }

  await recoveryPage.screenshot({ path: '/tmp/meeting-diagnostic/meeting-open-fixed.png', fullPage: true });
  console.log(JSON.stringify({
    deploymentAsset,
    targetChunk,
    failedChunkRequests,
    detailDocumentLoads,
    cachedNextAssets: finalCachedNextAssets,
    recoveryErrors,
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
