const { chromium } = require('/tmp/pw/node_modules/playwright');

const base = 'http://localhost:3000';
const api = 'http://localhost:4000';

const meeting = {
  id: 'test-meeting',
  title: 'Production i18n meeting',
  description: 'Production resolver regression fixture',
  slug: 'test-meeting-slug',
  timezone: 'Africa/Tunis',
  startDate: '2026-08-14',
  endDate: '2026-08-14',
  workdayStart: '08:00',
  workdayEnd: '10:00',
  slotIntervalMinutes: 15,
  meetingDurationMinutes: 60,
  finalized: false,
  locked: false,
  createdAt: '2026-08-13T18:00:00.000Z',
  status: 'upcoming',
  participantCount: 1,
  responseCount: 1,
  acceptingResponses: true,
  participants: [{ id: 'organizer', displayName: 'You (organizer)', joinedAt: '2026-08-13T18:00:00.000Z', responded: true, isOrganizer: true }],
  organizerAvailability: { participant: { id: 'organizer', displayName: 'You (organizer)', joinedAt: '2026-08-13T18:00:00.000Z', isOrganizer: true }, availabilities: [] },
  dates: [{ date: '2026-08-14', label: 'Friday, Aug 14' }],
  slots: [
    { date: '2026-08-14', timeLabel: '08:00', datetimeStart: '2026-08-14T07:00:00.000Z', datetimeEnd: '2026-08-14T07:15:00.000Z' },
    { date: '2026-08-14', timeLabel: '08:15', datetimeStart: '2026-08-14T07:15:00.000Z', datetimeEnd: '2026-08-14T07:30:00.000Z' },
    { date: '2026-08-14', timeLabel: '08:30', datetimeStart: '2026-08-14T07:30:00.000Z', datetimeEnd: '2026-08-14T07:45:00.000Z' },
    { date: '2026-08-14', timeLabel: '08:45', datetimeStart: '2026-08-14T07:45:00.000Z', datetimeEnd: '2026-08-14T08:00:00.000Z' }
  ],
  heatmap: [],
  bestTimes: []
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => localStorage.setItem('synk:language', 'it'));
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const fileRequests = [];

  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => { if (request.url().startsWith('file:')) fileRequests.push(request.url()); });

  await page.route(`${api}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/auth/session') return send({ user: { id: 'organizer-user', email: 'organizer@example.com' } });
    if (pathname === '/meetings/test-meeting') return send(meeting);
    return send({ message: 'Not mocked' }, 404);
  });

  await page.goto(`${base}/dashboard/meetings/new`);
  await page.getByRole('heading', { name: 'Crea riunione' }).waitFor({ state: 'visible' });
  await page.locator('#meeting-duration').waitFor({ state: 'visible' });
  const durationText = await page.locator('output[for="meeting-duration"]').innerText();
  if (!durationText.trim()) throw new Error('duration formatter returned an empty value');
  if (await page.getByText('Something went wrong').count()) throw new Error('global error boundary rendered on new meeting page');

  await page.goto(`${base}/dashboard/meetings/test-meeting`);
  await page.getByRole('heading', { name: 'Production i18n meeting' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  if (await page.getByText('Something went wrong').count()) throw new Error('global error boundary rendered on meeting detail page');
  if (await page.getByText('Riunione non trovata').count()) throw new Error('meeting detail fell into not-found state');

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
})().catch((error) => { console.error(error); process.exit(1); });
