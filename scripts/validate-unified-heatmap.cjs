const { chromium } = require('/tmp/pw/node_modules/playwright');
const fs = require('node:fs');
const base = 'http://localhost:3000';
const api = 'http://localhost:4000';
const screens = '/tmp/unified-heatmap-screenshots';
fs.mkdirSync(screens, { recursive: true });

async function join(page, invite, name) {
  await page.goto(invite);
  await page.locator('#display-name').fill(name);
  await page.getByRole('button', { name: 'Continue to availability' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  await dialog.getByRole('button', { name: 'Continue to availability' }).click();
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible', timeout: 15000 });
}
async function slot(page, time, occurrence = 0) {
  const cell = page.locator(`button[title^="${time} ·"]`).nth(occurrence);
  await cell.waitFor({ state: 'visible', timeout: 10000 });
  return cell;
}
async function saveNow(page) {
  const button = page.getByRole('button', { name: 'Save now' });
  await button.waitFor({ state: 'visible' });
  if (await button.isDisabled()) await page.waitForTimeout(350);
  const responsePromise = page.waitForResponse((response) => response.url().includes('/availability') && response.request().method() === 'PUT' && response.ok(), { timeout: 15000 }).catch(() => null);
  if (!(await button.isDisabled())) await button.click();
  const response = await responsePromise;
  if (!response) await page.getByText('Saved', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(250);
}
async function confirmRestoredIdentity(page, name) {
  const continueButton = page.getByRole('button', { name: `Continue as ${name}` });
  try {
    await continueButton.waitFor({ state: 'visible', timeout: 5000 });
    await continueButton.click();
  } catch {}
  await page.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible', timeout: 15000 });
}
async function pointerHold(page, target, pointerId) {
  const box = await target.boundingBox();
  if (!box) throw new Error('Hold target has no bounds');
  const point = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  await target.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId, button: 0, ...point });
  await page.waitForTimeout(520);
  return async () => target.dispatchEvent('pointerup', { pointerType: 'touch', pointerId, button: 0, ...point });
}
async function touchSwipe(context, page, box) {
  const cdp = await context.newCDPSession(page);
  const y = Math.round(box.y + box.height / 2);
  const startX = Math.round(box.x + box.width * 0.8);
  const endX = Math.round(box.x + box.width * 0.15);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
  });
  for (let step = 1; step <= 8; step += 1) {
    const x = Math.round(startX + ((endX - startX) * step) / 8);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const organizerContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const organizer = await organizerContext.newPage();
  const email = `heatmap-${Date.now()}@example.com`;
  const password = 'VisualPass1!';
  await organizer.goto(`${base}/signup`);
  await organizer.locator('#email').fill(email);
  await organizer.locator('#password').fill(password);
  await organizer.locator('#confirm-password').fill(password);
  await organizer.getByRole('button', { name: 'Create organizer account' }).click();
  await organizer.waitForURL('**/dashboard', { timeout: 20000 });
  const meeting = await organizer.evaluate(async ({ api }) => {
    const csrfResponse = await fetch(`${api}/auth/csrf`, { credentials: 'include' });
    const { token } = await csrfResponse.json();
    const response = await fetch(`${api}/meetings`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ title: 'Unified heatmap validation', description: 'Browser validation', startDate: '2026-08-13', endDate: '2026-08-14', workdayStart: '08:00', workdayEnd: '10:00', slotIntervalMinutes: 15, meetingDurationMinutes: 30, timezone: 'Africa/Tunis' }),
    });
    if (!response.ok) throw new Error(`create meeting ${response.status}: ${await response.text()}`);
    return response.json();
  }, { api });
  const invite = `${base}/meets/${meeting.slug}`;

  const aliceContext = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const alice = await aliceContext.newPage();
  await join(alice, invite, 'Alice');
  await (await slot(alice, '08:00')).click();
  await (await slot(alice, '08:15')).click();
  await saveNow(alice);
  const bobContext = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const bob = await bobContext.newPage();
  await join(bob, invite, 'Bob');
  await (await slot(bob, '08:00')).click();
  await saveNow(bob);

  await organizer.goto(`${base}/dashboard/meetings/${meeting.id}`);
  await organizer.locator('[data-unified-heatmap="true"]').waitFor({ state: 'visible', timeout: 20000 });
  if (await organizer.locator('[data-unified-heatmap="true"]').count() !== 1) throw new Error('Organizer does not render exactly one unified selector/heatmap');
  const org0800 = await slot(organizer, '08:00');
  const org0815 = await slot(organizer, '08:15');
  if ((await org0800.textContent()).trim() !== '2/3') throw new Error('Expected 2/3 before organizer edit');
  await org0800.click();
  if ((await org0800.textContent()).trim() !== '3/3') throw new Error('Organizer heatmap did not update immediately');
  if ((await org0800.getAttribute('data-selected')) !== 'true') throw new Error('Selected organizer tile missing selected state');
  if ((await org0800.getAttribute('data-boundary-right')) !== 'true') throw new Error('Single selected tile right boundary missing');
  await org0815.click();
  if ((await org0800.getAttribute('data-boundary-right')) !== 'false' || (await org0815.getAttribute('data-boundary-left')) !== 'false') throw new Error('Adjacent selected tiles retained shared green outline');
  await org0800.hover();
  await organizer.waitForTimeout(180);
  if (await organizer.locator('aside [data-participant-id][data-highlighted="true"]').count() < 2) throw new Error('Heatmap hover did not highlight participant list');
  await organizer.screenshot({ path: `${screens}/organizer-unified-heatmap.png`, fullPage: true });
  const firstMatch = organizer.locator('[data-match-start]').first();
  await firstMatch.hover();
  await organizer.locator('[data-match-participant-names="true"]').waitFor({ state: 'visible' });
  if (await organizer.locator('aside [data-participant-id][data-highlighted="true"]').count() < 1) throw new Error('Best match hover did not highlight participant list');
  await organizer.screenshot({ path: `${screens}/best-match-hover-names.png`, fullPage: true });

  await alice.reload();
  await confirmRestoredIdentity(alice, 'Alice');
  if (await alice.locator('[data-participant-roster="true"]').count() !== 1) throw new Error('Participant shared roster missing');
  const alice0830 = await slot(alice, '08:30');
  const aliceBefore = (await alice0830.textContent()).trim();
  await alice0830.click();
  if ((await alice0830.textContent()).trim() === aliceBefore) throw new Error('Participant heatmap did not optimistically update');
  await (await slot(alice, '08:00')).hover();
  await alice.waitForTimeout(180);
  if (await alice.locator('[data-participant-roster] [data-highlighted="true"]').count() < 1) throw new Error('Participant hover did not light roster');
  await alice.screenshot({ path: `${screens}/participant-unified-heatmap.png`, fullPage: true });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await mobileContext.newPage();
  await join(mobile, invite, 'Alice');
  if (await mobile.locator('[data-date-header]').count() !== 1) throw new Error('Mobile renders more than one day');
  const editButton = mobile.locator('button[title="Edit"]');
  const viewButton = mobile.locator('button[title="View"]');
  if ((await editButton.getAttribute('aria-pressed')) !== 'true') throw new Error('Mobile does not default to edit mode');
  if (await mobile.locator('[data-day-swipe="true"]').count() !== 1) throw new Error('Dedicated mobile swipe area missing');
  const gridBox = await mobile.locator('[data-unified-heatmap="true"] > div').nth(1).boundingBox();
  if (!gridBox || gridBox.width < 360) throw new Error(`Mobile timetable not wide enough: ${gridBox?.width}`);
  await mobile.screenshot({ path: `${screens}/mobile-edit-one-day.png`, fullPage: true });
  const swipeArea = mobile.locator('[data-day-swipe="true"] > div').first();
  const swipeBox = await swipeArea.boundingBox();
  if (!swipeBox) throw new Error('Swipe area bounds missing');
  const selectedBeforeSwipe = await mobile.locator('button[data-selected="true"]').count();
  await touchSwipe(mobileContext, mobile, swipeBox);
  await mobile.waitForTimeout(250);
  if ((await mobile.locator('[data-mobile-day-index]').getAttribute('data-mobile-day-index')) !== '1') throw new Error('Dedicated swipe did not move to next day');
  if (await mobile.locator('button[data-selected="true"]').count() !== selectedBeforeSwipe) throw new Error('Day swipe changed availability');
  await viewButton.click();
  const viewCell = mobile.locator('button[data-slot-start]').first();
  const pressedBeforeView = await viewCell.getAttribute('aria-pressed');
  await viewCell.tap();
  await mobile.locator('[data-heatmap-tooltip="true"]').waitFor({ state: 'visible' });
  if ((await viewCell.getAttribute('aria-pressed')) !== pressedBeforeView) throw new Error('View-mode tap edited availability');
  await mobile.screenshot({ path: `${screens}/mobile-view-inspect.png`, fullPage: true });
  await editButton.click();
  const holdCell = mobile.locator('button[data-slot-start]').nth(1);
  const pressedBeforeHold = await holdCell.getAttribute('aria-pressed');
  const releaseHold = await pointerHold(mobile, holdCell, 91);
  await mobile.locator('[data-heatmap-tooltip="true"]').waitFor({ state: 'visible' });
  await releaseHold();
  if ((await holdCell.getAttribute('aria-pressed')) !== pressedBeforeHold) throw new Error('Edit-mode hold edited availability');

  const mobileOrganizerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await mobileOrganizerContext.addCookies(await organizerContext.cookies());
  const mobileOrganizer = await mobileOrganizerContext.newPage();
  await mobileOrganizer.goto(`${base}/dashboard/meetings/${meeting.id}`);
  const mobileMatch = mobileOrganizer.locator('[data-match-start]').first();
  await mobileMatch.waitFor({ state: 'visible', timeout: 15000 });
  const releaseMatch = await pointerHold(mobileOrganizer, mobileMatch, 77);
  await mobileOrganizer.locator('[data-match-participant-names="true"]').waitFor({ state: 'visible' });
  await mobileOrganizer.screenshot({ path: `${screens}/mobile-match-hold.png`, fullPage: true });
  await releaseMatch();

  console.log('Unified heatmap browser validation passed.');
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
