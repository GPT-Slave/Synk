const { chromium, firefox } = require('/tmp/pw/node_modules/playwright');

const base = 'http://localhost:3000';
const apiOrigin = 'https://synk-fueq.onrender.com';
const starts = [
  '2026-08-14T07:00:00.000Z',
  '2026-08-14T07:15:00.000Z',
  '2026-08-14T07:30:00.000Z',
  '2026-08-14T07:45:00.000Z',
];
const ends = [
  '2026-08-14T07:15:00.000Z',
  '2026-08-14T07:30:00.000Z',
  '2026-08-14T07:45:00.000Z',
  '2026-08-14T08:00:00.000Z',
];
const labels = ['08:00', '08:15', '08:30', '08:45'];

const participants = [
  { id: 'organizer', displayName: 'You (organizer)', joinedAt: '2026-08-13T18:00:00.000Z', responded: true, isOrganizer: true },
  { id: 'alice', displayName: 'Alice', joinedAt: '2026-08-13T18:05:00.000Z', responded: true },
  { id: 'bob', displayName: 'Bob', joinedAt: '2026-08-13T18:06:00.000Z', responded: true },
];

const slots = starts.map((datetimeStart, index) => ({
  date: '2026-08-14',
  timeLabel: labels[index],
  datetimeStart,
  datetimeEnd: ends[index],
}));

const heatmap = slots.map((slot, index) => ({
  ...slot,
  availableCount: index < 3 ? 2 : 1,
  totalParticipants: 3,
  percentage: index < 3 ? 67 : 33,
  participantIds: index < 3 ? ['alice', 'bob'] : ['alice'],
  participantNames: index < 3 ? ['Alice', 'Bob'] : ['Alice'],
}));

const meeting = {
  id: 'test-meeting',
  title: 'Production polish meeting',
  description: 'Visual and console regression fixture',
  slug: 'test-meeting-slug',
  timezone: 'Africa/Tunis',
  startDate: '2026-08-14',
  endDate: '2026-08-14',
  workdayStart: '08:00',
  workdayEnd: '10:00',
  slotIntervalMinutes: 15,
  meetingDurationMinutes: 30,
  finalized: false,
  locked: false,
  createdAt: '2026-08-13T18:00:00.000Z',
  status: 'upcoming',
  participantCount: 3,
  responseCount: 3,
  acceptingResponses: true,
  participants,
  organizerAvailability: {
    participant: participants[0],
    availabilities: slots.slice(0, 2).map(({ datetimeStart, datetimeEnd }) => ({ datetimeStart, datetimeEnd })),
  },
  dates: [{ date: '2026-08-14', label: 'Friday, Aug 14' }],
  slots,
  heatmap,
  bestTimes: [
    {
      datetimeStart: starts[0],
      datetimeEnd: ends[1],
      date: '2026-08-14',
      timeLabel: '08:00',
      availableCount: 3,
      totalParticipants: 3,
      percentage: 100,
      participantIds: ['organizer', 'alice', 'bob'],
      participantNames: ['You (organizer)', 'Alice', 'Bob'],
    },
    {
      datetimeStart: starts[2],
      datetimeEnd: ends[3],
      date: '2026-08-14',
      timeLabel: '08:30',
      availableCount: 2,
      totalParticipants: 3,
      percentage: 67,
      participantIds: ['alice', 'bob'],
      participantNames: ['Alice', 'Bob'],
    },
  ],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function mockApi(page) {
  await page.route(`${apiOrigin}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const send = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (pathname === '/auth/session') {
      return send({ user: { id: 'organizer-user', email: 'organizer@example.com' } });
    }
    if (pathname === '/meetings/test-meeting') return send(meeting);
    if (pathname === '/auth/refresh') return send({ user: { id: 'organizer-user', email: 'organizer@example.com' } });
    if (pathname === '/auth/csrf') return send({ token: 'test-csrf' });
    if (pathname.startsWith('/socket.io/')) return send({ message: 'socket fixture intentionally offline' }, 503);
    return send({ message: 'Not mocked' }, 404);
  });
}

async function collectCleanBrowserState(browserType, name) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  const fileRequests = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('request', (request) => {
    if (request.url().startsWith('file:')) fileRequests.push(request.url());
  });
  await mockApi(page);
  const response = await page.goto(`${base}/dashboard/meetings/test-meeting`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Production polish meeting' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  const csp = response ? (await response.allHeaders())['content-security-policy'] || '' : '';
  assert(csp.includes('https://synk-fueq.onrender.com'), `${name}: API origin missing from CSP`);
  assert(csp.includes('wss://synk-fueq.onrender.com'), `${name}: WSS origin missing from CSP`);
  assert(!/connect-src[^;]*https:\/\/synk-fueq\.onrender\.com\s+https:\/\/synk-fueq\.onrender\.com/.test(csp), `${name}: duplicate HTTPS socket origin remains in CSP`);
  const fileLinks = await page.locator('[href^="file:"], [src^="file:"]').count();
  const performanceFileUrls = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => url.startsWith('file:')));
  assert(fileRequests.length === 0, `${name}: application requested file URLs: ${fileRequests.join(', ')}`);
  assert(fileLinks === 0, `${name}: file URL exists in rendered DOM`);
  assert(performanceFileUrls.length === 0, `${name}: file URL exists in performance resources`);
  const relevantErrors = errors.filter((text) => /Content-Security-Policy|connect-src|file:\/\/\/|TypeError|is not a function/i.test(text));
  assert(relevantErrors.length === 0, `${name}: relevant console errors:\n${relevantErrors.join('\n')}`);
  await browser.close();
  return { name, csp, fileRequests, performanceFileUrls, relevantErrors };
}

(async () => {
  const out = '/tmp/synk-polish';
  const chromiumBrowser = await chromium.launch({ headless: true });
  const context = await chromiumBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const fileRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => { if (request.url().startsWith('file:')) fileRequests.push(request.url()); });
  await mockApi(page);

  const response = await page.goto(`${base}/dashboard/meetings/test-meeting`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Production polish meeting' }).waitFor({ state: 'visible' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });

  const csp = response ? (await response.allHeaders())['content-security-policy'] || '' : '';
  assert(csp.includes('https://synk-fueq.onrender.com'), 'API HTTPS origin missing from CSP');
  assert(csp.includes('wss://synk-fueq.onrender.com'), 'WSS origin missing from CSP');
  assert(!/connect-src[^;]*https:\/\/synk-fueq\.onrender\.com\s+https:\/\/synk-fueq\.onrender\.com/.test(csp), 'CSP still duplicates HTTPS instead of allowing WSS');

  const selected = page.locator('button[data-heatmap-cell="true"][data-selected="true"]');
  await selected.first().waitFor({ state: 'visible' });
  assert(await selected.count() === 2, `expected two adjacent selected tiles, got ${await selected.count()}`);
  const geometry = await selected.evaluateAll((nodes) => nodes.slice(0, 2).map((node) => {
    const before = getComputedStyle(node, '::before');
    const after = getComputedStyle(node, '::after');
    const floor = node.querySelector('[data-selection-floor="true"]');
    const background = getComputedStyle(node).backgroundColor;
    return {
      beforeHeight: before.height,
      beforeBottom: before.bottom,
      beforeBackground: before.backgroundImage,
      afterLeft: after.borderLeftWidth,
      afterRight: after.borderRightWidth,
      afterLeftColor: after.borderLeftColor,
      afterRightColor: after.borderRightColor,
      legacyFloorDisplay: floor ? getComputedStyle(floor).display : 'missing',
      background,
    };
  }));
  assert(geometry[0].beforeHeight === '15px' && geometry[1].beforeHeight === '15px', `selection floor is not 15px: ${JSON.stringify(geometry)}`);
  assert(geometry[0].beforeBottom === '0px' && geometry[1].beforeBottom === '0px', 'selection floor is not flush with tile bottom');
  assert(geometry[0].afterLeft === '5px', `first tile missing outer left rail: ${geometry[0].afterLeft}`);
  assert(geometry[0].afterRight === '0px', `shared rail remains between first and second tile: ${geometry[0].afterRight}`);
  assert(geometry[1].afterLeft === '0px', `shared rail remains on second tile: ${geometry[1].afterLeft}`);
  assert(geometry[1].afterRight === '5px', `second tile missing outer right rail: ${geometry[1].afterRight}`);
  assert(/57, 255, 20|57 255 20/.test(geometry[0].afterLeftColor), `selection is not neon green: ${geometry[0].afterLeftColor}`);
  assert(geometry.every((item) => item.legacyFloorDisplay === 'none'), 'legacy floating green bar is still visible');
  const rgb = geometry[0].background.match(/\d+/g).map(Number);
  assert(rgb[2] > rgb[1] && rgb[2] > rgb[0], `selected tile center is no longer blue: ${geometry[0].background}`);

  await page.screenshot({ path: `${out}/desktop-neon-selection.png`, fullPage: true });

  const match = page.locator('[data-match-start]').first();
  await match.hover();
  await page.waitForTimeout(25);
  const reveal = page.locator('[data-match-participant-reveal="true"]').first();
  await reveal.waitFor({ state: 'attached' });
  const h0 = await reveal.evaluate((node) => node.getBoundingClientRect().height);
  await page.waitForTimeout(90);
  const h1 = await reveal.evaluate((node) => node.getBoundingClientRect().height);
  await page.waitForTimeout(220);
  const h2 = await reveal.evaluate((node) => node.getBoundingClientRect().height);
  assert(h2 > 0 && h1 >= h0, `match reveal did not expand smoothly: ${h0}, ${h1}, ${h2}`);
  const names = await page.locator('[data-match-participant-names="true"]').innerText();
  assert(names.includes('Alice') && names.includes('Bob'), `expanded names missing: ${names}`);
  await page.screenshot({ path: `${out}/match-smooth-expanded.png`, fullPage: true });
  await page.mouse.move(8, 8);
  await page.waitForTimeout(45);
  assert(await page.locator('[data-match-participant-reveal="true"]').count() > 0, 'match reveal retracted instantly instead of animating');
  await page.waitForTimeout(320);
  assert(await page.locator('[data-match-participant-reveal="true"]').count() === 0, 'match reveal did not finish retracting');

  await page.mouse.move(720, 460);
  await page.waitForTimeout(100);
  const halo = page.locator('[data-cursor-halo="true"]');
  const haloMetrics = await halo.evaluate((node) => {
    const style = getComputedStyle(node);
    return { width: style.width, height: style.height, opacity: style.opacity };
  });
  assert(haloMetrics.width === '144px' && haloMetrics.height === '144px', `cursor halo is not 144px: ${JSON.stringify(haloMetrics)}`);
  assert(Number(haloMetrics.opacity) > 0, 'cursor halo did not become visible after mouse movement');
  await page.screenshot({ path: `${out}/cursor-halo-larger.png`, fullPage: false });

  const fontPreloads = await page.locator('link[rel="preload"][as="font"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  assert(fontPreloads.length <= 1, `too many globally preloaded fonts remain: ${JSON.stringify(fontPreloads)}`);

  assert(pageErrors.length === 0, `Chromium page errors:\n${pageErrors.join('\n')}`);
  assert(fileRequests.length === 0, `Chromium file requests:\n${fileRequests.join('\n')}`);
  const relevantConsoleErrors = consoleErrors.filter((message) => /Content-Security-Policy|connect-src|file:\/\/\/|TypeError|is not a function/i.test(message));
  assert(relevantConsoleErrors.length === 0, `Chromium relevant console errors:\n${relevantConsoleErrors.join('\n')}`);

  await context.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${out}/mobile-neon-selection.png`, fullPage: true });
  await chromiumBrowser.close();

  const cleanChromium = await collectCleanBrowserState(chromium, 'chromium-clean');
  const cleanFirefox = await collectCleanBrowserState(firefox, 'firefox-clean');
  console.log(JSON.stringify({ csp, geometry, h0, h1, h2, haloMetrics, fontPreloads, relevantConsoleErrors, cleanChromium, cleanFirefox }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
