const { chromium } = require('/tmp/pw/node_modules/playwright');

const base = 'http://localhost:3000';
const api = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const password = 'CleanSelectionPass1!';

  await page.goto(`${base}/signup`);
  await page.locator('#email').fill(`clean-selection-${Date.now()}@example.com`);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create organizer account' }).click();
  await page.waitForURL('**/dashboard');

  const meeting = await page.evaluate(async ({ api }) => {
    const csrf = await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json();
    const response = await fetch(`${api}/meetings`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({ title:'Clean selection screenshot', startDate:'2026-08-13', endDate:'2026-08-13', workdayStart:'08:00', workdayEnd:'10:00', slotIntervalMinutes:15, meetingDurationMinutes:30, timezone:'Africa/Tunis' })
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

  // Move away from the heatmap so neither tooltip nor cursor halo contaminates the selection screenshot.
  await page.mouse.move(80, 120);
  await page.waitForTimeout(250);
  if (await page.locator('[data-heatmap-tooltip="true"]').count()) throw new Error('heatmap tooltip remained visible');

  const floors = page.locator('[data-selection-floor="true"]');
  if ((await floors.count()) !== 2) throw new Error(`expected two selected floors, got ${await floors.count()}`);
  const floorStyles = await floors.evaluateAll((els) => els.map((el) => {
    const s = getComputedStyle(el);
    return { height: s.height, bottom: s.bottom, shadow: s.boxShadow, color: s.backgroundColor };
  }));
  if (floorStyles.some((s) => s.shadow !== 'none' || Math.abs(parseFloat(s.height) - 5) > 0.5 || parseFloat(s.bottom) <= 0)) {
    throw new Error(`invalid selection floors: ${JSON.stringify(floorStyles)}`);
  }

  const haloOpacity = await page.locator('[data-cursor-halo="true"]').evaluate((el) => getComputedStyle(el).opacity);
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) throw new Error('selected geometry unavailable');
  const left = Math.min(firstBox.x, secondBox.x);
  const right = Math.max(firstBox.x + firstBox.width, secondBox.x + secondBox.width);
  await page.screenshot({
    path: '/tmp/clean-selection/selection-floor-clean.png',
    clip: { x: Math.max(0, left - 45), y: Math.max(0, firstBox.y - 45), width: right - left + 90, height: firstBox.height + 90 }
  });
  await page.screenshot({ path: '/tmp/clean-selection/full-page-clean.png', fullPage: true });
  console.log(JSON.stringify({ floorStyles, haloOpacity }));
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
