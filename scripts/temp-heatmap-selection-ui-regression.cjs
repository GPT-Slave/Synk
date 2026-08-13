const { chromium } = require('/tmp/pw/node_modules/playwright');

const base = 'http://localhost:3000';
const api = 'https://synk-fueq.onrender.com';
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
const people = [
  ['organizer', 'You (organizer)', true],
  ['alice', 'Alice'],
  ['bob', 'Bob'],
  ['cara', 'Cara'],
  ['dan', 'Dan'],
  ['erin', 'Erin'],
  ['finn', 'Finn'],
  ['gina', 'Gina'],
];
const participants = people.map(([id, displayName, isOrganizer], index) => ({
  id,
  displayName,
  joinedAt: `2026-08-13T18:${String(index).padStart(2, '0')}:00.000Z`,
  responded: true,
  ...(isOrganizer ? { isOrganizer: true } : {}),
}));
const slots = starts.map((datetimeStart, index) => ({
  date: '2026-08-14',
  timeLabel: labels[index],
  datetimeStart,
  datetimeEnd: ends[index],
}));
const idsByQuarter = [
  ['alice', 'bob', 'cara'],
  ['alice', 'bob', 'cara', 'dan', 'erin'],
  ['alice', 'bob', 'cara', 'dan', 'erin', 'finn'],
  ['alice', 'bob', 'cara', 'dan', 'erin', 'finn', 'gina'],
];
const nameById = new Map(participants.map((person) => [person.id, person.displayName]));
const heatmap = slots.map((slot, index) => ({
  ...slot,
  availableCount: idsByQuarter[index].length,
  totalParticipants: 8,
  percentage: Math.round((idsByQuarter[index].length / 8) * 100),
  participantIds: idsByQuarter[index],
  participantNames: idsByQuarter[index].map((id) => nameById.get(id)),
}));
const selectedIndexes = [0, 1, 3];
const meeting = {
  id: 'ui-meeting',
  title: 'Heatmap UI review',
  description: 'Selected-tile visual regression fixture',
  slug: 'ui-meeting-slug',
  timezone: 'Africa/Tunis',
  startDate: '2026-08-14',
  endDate: '2026-08-14',
  workdayStart: '08:00',
  workdayEnd: '09:00',
  slotIntervalMinutes: 15,
  meetingDurationMinutes: 30,
  finalized: false,
  locked: false,
  createdAt: '2026-08-13T18:00:00.000Z',
  status: 'upcoming',
  participantCount: 8,
  responseCount: 8,
  acceptingResponses: true,
  participants,
  organizerAvailability: {
    participant: participants[0],
    availabilities: selectedIndexes.map((index) => ({
      datetimeStart: starts[index],
      datetimeEnd: ends[index],
    })),
  },
  dates: [{ date: '2026-08-14', label: 'Friday, Aug 14' }],
  slots,
  heatmap,
  bestTimes: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function mockApi(page) {
  await page.route(`${api}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const send = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (pathname === '/auth/session' || pathname === '/auth/refresh') {
      return send({ user: { id: 'organizer-user', email: 'organizer@example.com' } });
    }
    if (pathname === '/auth/csrf') return send({ token: 'test-csrf' });
    if (pathname === '/meetings/ui-meeting') return send(meeting);
    if (pathname.startsWith('/socket.io/')) return send({ message: 'offline in visual fixture' }, 503);
    return send({ message: 'Not mocked' }, 404);
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await mockApi(page);
  await page.goto(`${base}/dashboard/meetings/ui-meeting`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Heatmap UI review' }).waitFor({ state: 'visible' });
  await page.locator('[data-heatmap-presentation="true"]').waitFor({ state: 'visible' });
  await page.locator('button[data-heatmap-cell="true"][data-available-count]').first().waitFor({ state: 'visible' });

  const cells = page.locator('button[data-heatmap-cell="true"]');
  assert(await cells.count() === 4, `expected four quarter cells, got ${await cells.count()}`);
  const visibleCounts = await cells.evaluateAll((nodes) => nodes.map((node) => {
    const after = getComputedStyle(node, '::after');
    const original = node.querySelector(':scope > span.relative.z-10');
    return {
      dataCount: node.getAttribute('data-available-count'),
      renderedCount: after.content,
      originalVisibility: original ? getComputedStyle(original).visibility : 'missing',
      title: node.getAttribute('title'),
    };
  }));
  assert(visibleCounts.map((item) => item.dataCount).join(',') === '4,6,6,8', `unexpected visible counts: ${JSON.stringify(visibleCounts)}`);
  assert(visibleCounts.every((item) => !item.renderedCount.includes('/')), `fraction is still rendered: ${JSON.stringify(visibleCounts)}`);
  assert(visibleCounts.every((item) => item.originalVisibility === 'hidden'), 'original fraction text is still visible');
  assert(visibleCounts[0].title.endsWith('4/8') && visibleCounts[3].title.endsWith('8/8'), 'full fraction semantics were lost from titles');

  const selected = page.locator('button[data-heatmap-cell="true"][data-selected="true"]');
  assert(await selected.count() === 3, `expected three selected tiles, got ${await selected.count()}`);
  const selectedMetrics = await selected.evaluateAll((nodes) => nodes.map((node) => {
    const before = getComputedStyle(node, '::before');
    const button = getComputedStyle(node);
    return {
      left: before.left,
      right: before.right,
      bottom: before.bottom,
      height: before.height,
      backgroundColor: before.backgroundColor,
      backgroundImage: before.backgroundImage,
      boxShadow: before.boxShadow,
      filter: before.filter,
      borderLeft: before.borderLeftWidth,
      borderRight: before.borderRightWidth,
      overflow: button.overflow,
      borderRadius: button.borderRadius,
      width: node.getBoundingClientRect().width,
    };
  }));
  for (const metric of selectedMetrics) {
    assert(metric.left === '0px' && metric.right === '0px', `green band does not reach both sides: ${JSON.stringify(metric)}`);
    assert(metric.bottom === '0px', `green band is not flush with bottom: ${JSON.stringify(metric)}`);
    assert(metric.height === '15px', `green band is not 15px thick: ${JSON.stringify(metric)}`);
    assert(metric.backgroundColor === 'rgb(57, 255, 20)', `green is not #39ff14: ${JSON.stringify(metric)}`);
    assert(metric.backgroundImage === 'none', `green band still uses a gradient: ${JSON.stringify(metric)}`);
    assert(metric.boxShadow === 'none', `green band still glows: ${JSON.stringify(metric)}`);
    assert(metric.filter === 'none', `green band still has a glow/filter: ${JSON.stringify(metric)}`);
    assert(metric.borderLeft === '0px' && metric.borderRight === '0px', `side bars remain: ${JSON.stringify(metric)}`);
    assert(metric.overflow === 'hidden', `tile does not clip selection paint to rounded corners: ${JSON.stringify(metric)}`);
  }

  const firstCell = cells.nth(0);
  const lastCell = cells.nth(3);
  assert((await firstCell.evaluate((node) => getComputedStyle(node).borderBottomLeftRadius)) !== '0px', 'left edge tile lost bottom-left rounding');
  assert((await lastCell.evaluate((node) => getComputedStyle(node).borderBottomRightRadius)) !== '0px', 'right edge tile lost bottom-right rounding');

  const legend = page.locator('[data-selection-legend="true"]');
  await legend.waitFor({ state: 'visible' });
  assert((await legend.innerText()).trim().length > 0, 'selection legend is empty');

  await page.screenshot({ path: '/tmp/heatmap-ui/desktop-full.png', fullPage: true });
  await page.locator('[data-heatmap-presentation="true"]').screenshot({ path: '/tmp/heatmap-ui/desktop-heatmap.png' });

  await cells.nth(1).hover();
  await page.locator('[data-heatmap-tooltip="true"]').waitFor({ state: 'visible' });
  const tooltip = await page.locator('[data-heatmap-tooltip="true"]').innerText();
  assert(/6 of 8 available/i.test(tooltip), `tooltip lost denominator semantics: ${tooltip}`);
  await page.screenshot({ path: '/tmp/heatmap-ui/desktop-tooltip.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-heatmap-presentation="true"]').waitFor({ state: 'visible' });
  await page.locator('button[data-heatmap-cell="true"][data-available-count]').first().waitFor({ state: 'visible' });
  await page.screenshot({ path: '/tmp/heatmap-ui/mobile-full.png', fullPage: true });
  await page.locator('[data-heatmap-presentation="true"]').screenshot({ path: '/tmp/heatmap-ui/mobile-heatmap.png' });

  console.log(JSON.stringify({ visibleCounts, selectedMetrics, tooltip }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
