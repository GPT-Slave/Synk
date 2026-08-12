const { chromium } = require('/tmp/pw/node_modules/playwright');
const base = 'http://localhost:3000';
const api = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

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
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({
        title: 'Meeting open regression',
        startDate: '2026-08-13', endDate: '2026-08-13',
        workdayStart: '08:00', workdayEnd: '10:00',
        slotIntervalMinutes: 15, meetingDurationMinutes: 30,
        timezone: 'Africa/Tunis'
      })
    });
    if (!response.ok) throw new Error(`create ${response.status}: ${await response.text()}`);
    return response.json();
  }, { api });

  const detailResponses = [];
  page.on('response', response => {
    if (response.url().includes(`/meetings/${meeting.id}`)) detailResponses.push({ url: response.url(), status: response.status() });
  });

  await page.goto(`${base}/dashboard/meetings/${meeting.id}`);
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  if (await page.getByText('Something went wrong').count()) throw new Error('global error boundary rendered on first open');
  if (await page.getByText('Meeting not found').count()) throw new Error('meeting not found rendered on first open');

  await page.reload();
  await page.getByRole('heading', { name: 'Meeting open regression' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  if (await page.getByText('Something went wrong').count()) throw new Error('global error boundary rendered after reload');
  if (await page.getByText('Meeting not found').count()) throw new Error('meeting not found rendered after reload');

  await page.screenshot({ path: '/tmp/meeting-diagnostic/meeting-open.png', fullPage: true });
  console.log(JSON.stringify({ detailResponses, consoleErrors, pageErrors }, null, 2));
  if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join('\n')}`);
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
