const { chromium } = require('/tmp/pw/node_modules/playwright');
const base='http://localhost:3000'; const api='http://localhost:4000';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await (await browser.newContext({viewport:{width:1440,height:1000}})).newPage();
 const password='SelectionDiagPass1!';
 await page.goto(`${base}/signup`);
 await page.locator('#email').fill(`diag-${Date.now()}@example.com`);
 await page.locator('#password').fill(password); await page.locator('#confirm-password').fill(password);
 await page.getByRole('button',{name:'Create organizer account'}).click(); await page.waitForURL('**/dashboard');
 const meeting=await page.evaluate(async({api})=>{const csrf=await (await fetch(`${api}/auth/csrf`,{credentials:'include'})).json(); const r=await fetch(`${api}/meetings`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.token},body:JSON.stringify({title:'Selection style diagnostic',startDate:'2026-08-13',endDate:'2026-08-13',workdayStart:'08:00',workdayEnd:'10:00',slotIntervalMinutes:15,meetingDurationMinutes:30,timezone:'Africa/Tunis'})}); if(!r.ok) throw new Error(await r.text()); return r.json();},{api});
 await page.goto(`${base}/dashboard/meetings/${meeting.id}`);
 let a=page.locator('button[title^="08:00 ·"]').first(), b=page.locator('button[title^="08:15 ·"]').first();
 await a.click(); await b.click(); await page.waitForTimeout(1600); await page.reload();
 a=page.locator('button[title^="08:00 ·"]').first(); await a.waitFor({state:'visible'}); await page.mouse.move(80,120); await page.waitForTimeout(250);
 const diag=await a.evaluate((el)=>{
   const props=(node,pseudo)=>{const s=getComputedStyle(node,pseudo); return {boxShadow:s.boxShadow,filter:s.filter,outline:s.outline,background:s.background,backgroundColor:s.backgroundColor,border:s.border,opacity:s.opacity,mixBlendMode:s.mixBlendMode,transform:s.transform};};
   return {button:props(el),before:props(el,'::before'),after:props(el,'::after'),parent:props(el.parentElement),grandparent:props(el.parentElement?.parentElement),floor:props(el.querySelector('[data-selection-floor="true"]'))};
 });
 console.log('SELECTION_DIAGNOSTIC='+JSON.stringify(diag));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
