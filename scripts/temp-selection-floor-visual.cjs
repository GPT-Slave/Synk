const { chromium } = require('/tmp/pw/node_modules/playwright');

const base = 'http://localhost:3000';
const api = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const password = 'SelectionFloorPass1!';

  await page.goto(`${base}/signup`);
  await page.locator('#email').fill(`selection-floor-${Date.now()}@example.com`);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create organizer account' }).click();
  await page.waitForURL('**/dashboard');

  const meeting = await page.evaluate(async ({ api }) => {
    const csrf = await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json();
    const response = await fetch(`${api}/meetings`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({
        title: 'Selection floor visual check',
        startDate: '2026-08-13',
        endDate: '2026-08-13',
        workdayStart: '08:00',
        workdayEnd: '10:00',
        slotIntervalMinutes: 15,
        meetingDurationMinutes: 30,
        timezone: 'Africa/Tunis'
      })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }, { api });

  await page.goto(`${base}/dashboard/meetings/${meeting.id}`);
  let first = page.locator('button[title^="08:00 ·"]').first();
  let second = page.locator('button[title^="08:15 ·"]').first();
  await first.click();
  await second.click();
  await page.waitForTimeout(1600);
  await page.reload();

  first = page.locator('button[title^="08:00 ·"]').first();
  second = page.locator('button[title^="08:15 ·"]').first();
  await first.waitFor({ state: 'visible' });

  const floors = page.locator('[data-selection-floor="true"]');
  if ((await floors.count()) !== 2) throw new Error(`expected two persisted selected floors, got ${await floors.count()}`);
  for (let i = 0; i < 2; i += 1) {
    const style = await floors.nth(i).evaluate((el) => {
      const s = getComputedStyle(el);
      return { height: s.height, shadow: s.boxShadow, bottom: s.bottom, background: s.backgroundColor };
    });
    if (Math.abs(parseFloat(style.height) - 5) > 0.5) throw new Error(`floor height is not 5px: ${style.height}`);
    if (style.shadow !== 'none') throw new Error(`selected floor still glows: ${style.shadow}`);
    if (parseFloat(style.bottom) <= 0) throw new Error(`selected floor is not inset: ${style.bottom}`);
    if (!style.background.includes('21') || !style.background.includes('128')) throw new Error(`unexpected floor green: ${style.background}`);
  }

  if (await page.locator('button[data-heatmap-cell="true"] span[style*="conic-gradient"]').count()) {
    throw new Error('quarter progress circle is still rendered');
  }

  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) throw new Error('selected cell geometry unavailable');
  const floorA = await floors.nth(0).boundingBox();
  const floorB = await floors.nth(1).boundingBox();
  if (!floorA || !floorB) throw new Error('floor geometry unavailable');
  if (Math.abs((floorA.x + floorA.width) - floorB.x) > 1.5) {
    throw new Error('adjacent selected floors do not join continuously');
  }

  const participantItem = page.locator('li[data-participant-id]').first();
  await participantItem.waitFor({ state: 'visible' });
  const baseRadius = await participantItem.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  if (baseRadius < 12) throw new Error(`participant row is not permanently rounded before hover: ${baseRadius}`);

  const box = await first.boundingBox();
  if (!box) throw new Error('hover cell geometry unavailable');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  const highlightedItem = page.locator('li[data-highlighted="true"]').first();
  await highlightedItem.waitFor({ state: 'visible' });
  const radii = [];
  for (const delay of [0, 16, 40, 100, 180]) {
    if (delay) await page.waitForTimeout(delay);
    radii.push(await highlightedItem.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius)));
  }
  if (radii.some((radius) => radius < 12)) throw new Error(`participant highlight briefly loses rounded shape: ${radii.join(', ')}`);
  const highlightedStyle = await highlightedItem.evaluate((el) => {
    const s = getComputedStyle(el);
    return { shadow: s.boxShadow, border: s.borderTopColor, radius: s.borderTopLeftRadius };
  });
  if (highlightedStyle.shadow !== 'none') throw new Error(`participant highlight still glows: ${highlightedStyle.shadow}`);

  await page.screenshot({ path: '/tmp/selection-floor/full-page.png', fullPage: true });

  const selectedLeft = Math.min(firstBox.x, secondBox.x);
  const selectedRight = Math.max(firstBox.x + firstBox.width, secondBox.x + secondBox.width);
  await page.screenshot({
    path: '/tmp/selection-floor/selection-floor.png',
    clip: {
      x: Math.max(0, selectedLeft - 28),
      y: Math.max(0, firstBox.y - 28),
      width: Math.min(1440 - Math.max(0, selectedLeft - 28), selectedRight - selectedLeft + 56),
      height: Math.min(1000 - Math.max(0, firstBox.y - 28), firstBox.height + 56)
    }
  });

  const participantBox = await highlightedItem.boundingBox();
  if (!participantBox) throw new Error('participant highlight geometry unavailable');
  await page.screenshot({
    path: '/tmp/selection-floor/participant-highlight.png',
    clip: {
      x: Math.max(0, participantBox.x - 28),
      y: Math.max(0, participantBox.y - 28),
      width: Math.min(1440 - Math.max(0, participantBox.x - 28), participantBox.width + 56),
      height: Math.min(1000 - Math.max(0, participantBox.y - 28), participantBox.height + 56)
    }
  });

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
