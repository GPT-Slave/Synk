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
  const page = await context.newPage();
  const unexpectedPageErrors = [];
  let allowDeploymentFailure = false;
  page.on('pageerror', (error) => {
    if (!allowDeploymentFailure) unexpectedPageErrors.push(error.stack || error.message);
  });

  await page.goto(base);
  await waitForCanonicalWorker(page);

  const staticResources = await scriptResources(page);
  if (!staticResources.length) throw new Error('no Next.js static script resource was observed');
  const deploymentAsset = staticResources.find((url) => new URL(url).searchParams.has('dpl'));
  if (!deploymentAsset) {
    throw new Error(`deploymentId missing from static assets: ${staticResources.slice(0, 5).join(', ')}`);
  }

  await page.evaluate(async (url) => {
    await fetch(url, { cache: 'reload' });
  }, staticResources[0]);
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
  await page.goto(`${base}/dashboard`);
  const dashboardScripts = new Set(await scriptResources(page));

  // Verify the normal organizer path before inducing a deployment-skew failure.
  await page.goto(detailUrl);
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  if (await page.getByText('Something went wrong').count()) throw new Error('global error boundary rendered on baseline open');
  if (await page.getByText('Meeting not found').count()) throw new Error('meeting not found rendered on baseline open');
  if (unexpectedPageErrors.length) throw new Error(`baseline page errors: ${unexpectedPageErrors.join('\n')}`);

  const meetingScripts = await scriptResources(page);
  const meetingOnlyScripts = meetingScripts.filter((url) => !dashboardScripts.has(url));
  if (!meetingOnlyScripts.length) {
    throw new Error(`no meeting-specific script found; meeting scripts: ${meetingScripts.join(', ')}`);
  }
  const targetChunk = meetingOnlyScripts[meetingOnlyScripts.length - 1];

  // Make the meeting-only chunk disappear once, exactly like a client carrying
  // references to the previous deployment. The error boundary must hard-reload
  // once and then render the meeting from the current build.
  await page.goto(`${base}/dashboard`);
  let blocked = false;
  await page.route(targetChunk, async (route) => {
    if (!blocked) {
      blocked = true;
      await route.fulfill({
        status: 404,
        contentType: 'text/plain; charset=utf-8',
        body: 'simulated stale deployment chunk',
      });
      return;
    }
    await route.continue();
  });

  allowDeploymentFailure = true;
  await page.goto(detailUrl).catch(() => undefined);
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({
    state: 'visible',
    timeout: 20_000,
  });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  allowDeploymentFailure = false;

  if (!blocked) throw new Error(`simulated stale chunk was never requested: ${targetChunk}`);
  if (await page.getByText('Something went wrong').count()) throw new Error('global error boundary remained after deployment recovery');
  if (await page.getByText('Meeting not found').count()) throw new Error('meeting not found remained after deployment recovery');

  const recoveryMarker = await page.evaluate(() => sessionStorage.getItem('synk:deployment-recovery-at'));
  if (!recoveryMarker) throw new Error('deployment recovery did not reserve its guarded reload marker');

  await page.reload();
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });

  const finalCachedNextAssets = await cachedNextAssets(page);
  if (finalCachedNextAssets.length) {
    throw new Error(`Next.js assets appeared in Synk cache after recovery: ${JSON.stringify(finalCachedNextAssets)}`);
  }

  await page.screenshot({ path: '/tmp/meeting-diagnostic/meeting-open-fixed.png', fullPage: true });
  console.log(JSON.stringify({
    deploymentAsset,
    targetChunk,
    cachedNextAssets: finalCachedNextAssets,
    recoveryMarker,
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
