const { chromium } = require('/tmp/pw/node_modules/playwright');
const base = 'http://localhost:3000';
const api = 'http://localhost:4000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const password = 'FinalSelectionPass1!';

  await page.goto(`${base}/signup`);
  await page.locator('#email').fill(`final-selection-${Date.now()}@example.com`);
  await page.locator('#password').fill(password);
  await page.locator('#confirm-password').fill(password);
  await page.getByRole('button', { name: 'Create organizer account' }).click();
  await page.waitForURL('**/dashboard');

  const meeting = await page.evaluate(async ({ api }) => {
    const csrf = await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json();
    const response = await fetch(`${api}/meetings`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({ title:'Final selection visual', startDate:'2026-08-13', endDate:'2026-08-13', workdayStart:'08:00', workdayEnd:'10:00', slotIntervalMinutes:15, meetingDurationMinutes:30, timezone:'Africa/Tunis' })
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

  await page.mouse.move(70, 100);
  await page.waitForTimeout(200);

  const floors = page.locator('[data-selection-floor="true"]');
  if ((await floors.count()) !== 2) throw new Error(`expected two floors, got ${await floors.count()}`);
  for (let i = 0; i < 2; i++) {
    const style = await floors.nth(i).evaluate(el => { const s = getComputedStyle(el); return { height:s.height, bottom:s.bottom, shadow:s.boxShadow, color:s.backgroundColor }; });
    if (Math.abs(parseFloat(style.height) - 5) > .5) throw new Error(`floor not 5px: ${style.height}`);
    if (style.shadow !== 'none') throw new Error(`floor glows: ${style.shadow}`);
    if (parseFloat(style.bottom) <= 0) throw new Error(`floor not inset: ${style.bottom}`);
  }

  for (const cell of [first, second]) {
    const shadow = await cell.evaluate(el => getComputedStyle(el).boxShadow);
    if (shadow !== 'none') throw new Error(`selected button still has shadow: ${shadow}`);
  }

  if (await page.locator('button[data-heatmap-cell="true"] span[style*="conic-gradient"]').count()) throw new Error('quarter circle still exists');

  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  const floorA = await floors.nth(0).boundingBox();
  const floorB = await floors.nth(1).boundingBox();
  if (!firstBox || !secondBox || !floorA || !floorB) throw new Error('missing floor geometry');
  if (Math.abs((floorA.x + floorA.width) - floorB.x) > 1.5) throw new Error('adjacent floors are not continuous');

  const participantItem = page.locator('li[data-participant-id]').first();
  await participantItem.waitFor({ state: 'visible' });
  const baseRadius = await participantItem.evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  if (baseRadius < 12) throw new Error(`participant base radius too small: ${baseRadius}`);

  const hoverBox = await first.boundingBox();
  await page.mouse.move(hoverBox.x + hoverBox.width / 2, hoverBox.y + hoverBox.height / 2);
  const highlighted = page.locator('li[data-highlighted="true"]').first();
  await highlighted.waitFor({ state: 'visible' });
  const radii = [];
  for (const delay of [0, 16, 40, 100, 180]) {
    if (delay) await page.waitForTimeout(delay);
    radii.push(await highlighted.evaluate(el => parseFloat(getComputedStyle(el).borderTopLeftRadius)));
  }
  if (radii.some(r => r < 12)) throw new Error(`participant highlight lost rounded corners: ${radii.join(',')}`);
  const participantShadow = await highlighted.evaluate(el => getComputedStyle(el).boxShadow);
  if (participantShadow !== 'none') throw new Error(`participant highlight glows: ${participantShadow}`);

  const participantBox = await highlighted.boundingBox();
  await page.screenshot({ path:'/tmp/final-selection/participant-highlight-final.png', clip:{ x:Math.max(0, participantBox.x-30), y:Math.max(0, participantBox.y-30), width:Math.min(1440-Math.max(0,participantBox.x-30), participantBox.width+60), height:Math.min(1000-Math.max(0,participantBox.y-30), participantBox.height+60) } });

  await page.mouse.move(70, 100);
  await page.waitForTimeout(200);
  const left = Math.min(firstBox.x, secondBox.x);
  const right = Math.max(firstBox.x + firstBox.width, secondBox.x + secondBox.width);
  await page.screenshot({ path:'/tmp/final-selection/selection-floor-final.png', clip:{ x:Math.max(0,left-45), y:Math.max(0,firstBox.y-45), width:right-left+90, height:firstBox.height+90 } });
  await page.screenshot({ path:'/tmp/final-selection/full-page-final.png', fullPage:true });
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
