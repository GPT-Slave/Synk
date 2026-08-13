const { chromium } = require('/tmp/pw/node_modules/playwright');

const base = 'http://localhost:3000';
const api = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const fileRequests = [];

  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (request.url().startsWith('file:')) fileRequests.push(request.url());
  });

  const password = 'ProductionI18nPass1!';
  await page.goto(`${base}/signup`);
  await page.locator('#email').fill(`prod-i18n-${Date.now()}@example.com`);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create organizer account' }).click();
  await page.waitForURL('**/dashboard');

  // Prove the full runtime is active in production, not the physical catalog
  // fallback: Italian exists only in the complete/runtime layer.
  await page.evaluate(() => localStorage.setItem('synk:language', 'it'));
  await page.goto(`${base}/dashboard/meetings/new`);
  await page.getByRole('heading', { name: 'Crea riunione' }).waitFor({ state: 'visible' });
  await page.locator('#meeting-duration').waitFor({ state: 'visible' });
  const durationText = await page.locator('output[for="meeting-duration"]').innerText();
  if (!durationText.trim()) throw new Error('duration formatter returned an empty value');
  if (await page.getByText('Something went wrong').count()) {
    throw new Error('global error boundary rendered on new meeting page');
  }

  // Create a meeting through the same authenticated API session, then open the
  // organizer detail page where formatDuration is also used.
  const meeting = await page.evaluate(async ({ api }) => {
    const csrfResponse = await fetch(`${api}/auth/csrf`, { credentials: 'include' });
    if (!csrfResponse.ok) throw new Error(`csrf ${csrfResponse.status}: ${await csrfResponse.text()}`);
    const csrf = await csrfResponse.json();
    const response = await fetch(`${api}/meetings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({
        title: 'Production i18n meeting',
        startDate: '2026-08-14',
        endDate: '2026-08-14',
        workdayStart: '08:00',
        workdayEnd: '10:00',
        slotIntervalMinutes: 15,
        meetingDurationMinutes: 60,
        timezone: 'Africa/Tunis',
      }),
    });
    if (!response.ok) throw new Error(`create ${response.status}: ${await response.text()}`);
    return response.json();
  }, { api });

  await page.goto(`${base}/dashboard/meetings/${meeting.id}`);
  await page.getByRole('heading', { name: 'Production i18n meeting' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  if (await page.getByText('Something went wrong').count()) {
    throw new Error('global error boundary rendered on meeting detail page');
  }
  if (await page.getByText('Riunione non trovata').count()) {
    throw new Error('meeting detail fell into not-found state');
  }

  await page.reload();
  await page.getByRole('heading', { name: 'Production i18n meeting' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });

  if (pageErrors.length) throw new Error(`page errors:\n${pageErrors.join('\n')}`);
  if (fileRequests.length) throw new Error(`file:// requests observed:\n${fileRequests.join('\n')}`);
  const typeErrors = consoleErrors.filter((message) => /TypeError|is not a function/i.test(message));
  if (typeErrors.length) throw new Error(`console type errors:\n${typeErrors.join('\n')}`);

  await page.screenshot({ path: '/tmp/prod-i18n/new-and-detail-fixed.png', fullPage: true });
  console.log(JSON.stringify({ durationText, pageErrors, fileRequests, consoleErrors }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
