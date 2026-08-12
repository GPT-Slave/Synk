const fs = require('node:fs');
const path = require('node:path');
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
  page.on('pageerror', (error) => unexpectedPageErrors.push(error.stack || error.message));

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

  // Baseline: a normal production organizer open and reload must work first.
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
  const targetUrl = new URL(targetChunk);
  const nextRelativePath = targetUrl.pathname.replace(/^\/_next\//, '');
  const targetFile = path.join(process.cwd(), 'apps/web/.next', nextRelativePath);
  const backupFile = `${targetFile}.synk-recovery-test`;
  if (!fs.existsSync(targetFile)) {
    throw new Error(`built meeting chunk does not exist on disk: ${targetFile}`);
  }

  // Open the same authenticated meeting from a fresh document with browser HTTP
  // caching disabled. Temporarily removing the actual built route chunk makes
  // Next.js return a real 404. The service worker must refresh the stale client;
  // the response listener restores the chunk before that recovery load retries.
  const recoveryPage = await context.newPage();
  const cdp = await context.newCDPSession(recoveryPage);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await recoveryPage.goto(`${base}/dashboard`);
  await waitForCanonicalWorker(recoveryPage);

  let missingChunkObserved = false;
  let chunkRestored = false;
  let recoveryDetailLoads = 0;
  const recoveryPageErrors = [];
  recoveryPage.on('pageerror', (error) => recoveryPageErrors.push(error.stack || error.message));
  recoveryPage.on('response', (response) => {
    const url = new URL(response.url());
    if (
      response.request().isNavigationRequest() &&
      url.pathname === `/dashboard/meetings/${meeting.id}`
    ) {
      recoveryDetailLoads += 1;
    }
    if (url.pathname === targetUrl.pathname && response.status() === 404) {
      missingChunkObserved = true;
      if (!chunkRestored && fs.existsSync(backupFile)) {
        fs.renameSync(backupFile, targetFile);
        chunkRestored = true;
      }
    }
  });

  fs.renameSync(targetFile, backupFile);
  try {
    await recoveryPage.goto(detailUrl).catch(() => undefined);
    await recoveryPage.getByRole('heading', { name: 'Meeting open regression' }).waitFor({
      state: 'visible',
      timeout: 20_000,
    });
    await recoveryPage.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  } finally {
    if (!chunkRestored && fs.existsSync(backupFile)) {
      fs.renameSync(backupFile, targetFile);
      chunkRestored = true;
    }
  }

  if (!missingChunkObserved) {
    throw new Error(`real missing meeting chunk was not observed: ${targetUrl.pathname}`);
  }
  if (recoveryDetailLoads < 2) {
    throw new Error(`missing chunk did not trigger a full meeting recovery load; loads=${recoveryDetailLoads}`);
  }
  if (await recoveryPage.getByText('Something went wrong').count()) {
    throw new Error('global error boundary remained after real missing-chunk recovery');
  }
  if (await recoveryPage.getByText('Meeting not found').count()) {
    throw new Error('meeting not found remained after real missing-chunk recovery');
  }
  if (new URL(recoveryPage.url()).searchParams.has('__synk_asset_refresh')) {
    throw new Error(`asset recovery marker leaked into visible URL: ${recoveryPage.url()}`);
  }

  // A transient chunk error may surface while the old document is being torn
  // down; it is acceptable only if recovery completes and the error is a known
  // deployment-asset failure rather than an application exception.
  const unexpectedRecoveryErrors = recoveryPageErrors.filter(
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
    missingChunkObserved,
    recoveryDetailLoads,
    cachedNextAssets: finalCachedNextAssets,
    recoveryPageErrors,
  }, null, 2));

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
