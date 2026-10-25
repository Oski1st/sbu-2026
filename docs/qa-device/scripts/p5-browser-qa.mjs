// P5-02 browser QA driver. Usage: node p5-browser-qa.mjs <chrome|webkit> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const pw = require('playwright');

const engine = process.argv[2] || 'chrome';
const out = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:5174';
const Q = '/?date=2026-11-15&time=17%3A30';
const results = [];
const rec = (id, check, result, detail) => { results.push({ id, check, result, detail }); console.log(`[${result}] ${id} ${check} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };

const browser = engine === 'chrome'
  ? await pw.chromium.launch({ channel: 'chrome', headless: false })
  : await pw.webkit.launch({ headless: false });
console.log('BROWSER', engine, browser.version());

async function newPage(viewport, extra = {}) {
  const ctx = await browser.newContext({ viewport, ...extra });
  const page = await ctx.newPage();
  return { ctx, page };
}

// ---- 1 Autocomplete (desktop 1280x800)
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(BASE + Q);
  console.log('UA', await page.evaluate(() => navigator.userAgent));
  const o = page.locator('#origin');
  await o.click(); await o.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
  await page.keyboard.type('new');
  const opts = await page.locator('#origin-listbox [role=option]').allInnerTexts();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  const active = await o.getAttribute('aria-activedescendant');
  await page.keyboard.press('Enter');
  const picked = await o.inputValue();
  const exp1 = await o.getAttribute('aria-expanded');
  rec('1a', 'suggestions + arrows + Enter', opts.length >= 2 && picked === 'New York' && exp1 === 'false' ? 'PASS' : 'FAIL', { opts: opts.map(s => s.replace(/\s+/g, ' ')), active, picked, expandedAfter: exp1 });

  await o.press('Meta+a'); await page.keyboard.type('Zzyzx');
  const noMatch = await page.getByText(/No supported sample cities match “Zzyzx”/).isVisible();
  await page.keyboard.press('Escape');
  const exp2 = await o.getAttribute('aria-expanded');
  const focusStill = await page.evaluate(() => document.activeElement.id);
  rec('1b', 'no-match message + Escape', noMatch && exp2 === 'false' && focusStill === 'origin' ? 'PASS' : 'FAIL', { noMatchVisible: noMatch, expandedAfterEsc: exp2, focus: focusStill });
  await ctx.close();
}

// ---- 2 Keyboard focus sweep
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(BASE + Q);
  await page.evaluate(() => { window.__log = []; document.addEventListener('focusin', e => { const el = e.target, cs = getComputedStyle(el); __log.push({ el: (el.getAttribute('aria-label') || el.id || el.name || el.textContent.trim()).slice(0, 32), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? `${cs.outlineWidth} ${cs.outlineColor}` : 'none', borderBottom: cs.borderBottomWidth + ' ' + cs.borderBottomColor }); }); });
  await page.mouse.click(5, 300);
  const tabKey = engine === 'webkit' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < 22; i++) await page.keyboard.press(tabKey);
  const fwdCount = await page.evaluate(() => __log.length);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+' + tabKey);
  const log = await page.evaluate(() => __log);
  // screenshot of focused origin and date for visual evidence
  await page.locator('#origin').focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  await page.locator('.search-section').screenshot({ path: `${out}/p5-02-${engine}-focus-origin-1280.png` });
  const reached = new Set(log.map(l => l.el));
  const formFocus = log.filter(l => ['origin', 'destination', 'departure-date', 'departure-time'].includes(l.el));
  const trap = fwdCount < 8;
  rec('2a', 'Tab/Shift+Tab order, no trap', !trap && reached.has('origin') && reached.has('departure-time') ? 'PASS' : 'FAIL', { forwardFocusEvents: fwdCount, order: log.map(l => l.el) });
  rec('2b', 'form-control focus indicator', 'SEE-CONTRAST', formFocus);
  await ctx.close();
}

// ---- 3 Date typing, submit, Back
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(BASE + Q);
  const d = page.locator('input[name=departure-date]');
  await d.click({ position: { x: 14, y: 12 } });
  await page.keyboard.type('12252026');
  const typed = await d.inputValue();
  await page.getByRole('button', { name: /Find my way/ }).click();
  await page.waitForTimeout(500);
  const urlAfter = page.url();
  await page.goBack(); await page.waitForTimeout(500);
  const back = await d.inputValue();
  rec('3', 'type date, submit, Back', typed === '2026-12-25' && urlAfter.includes('date=2026-12-25') && back === '2026-11-15' ? 'PASS' : 'FAIL', { typed, urlAfter: urlAfter.replace(BASE, ''), afterBack: back });
  await ctx.close();
}

// ---- 4 375px date visibility (resized desktop)
for (const w of [375, 390]) {
  const { ctx, page } = await newPage({ width: w, height: 812 });
  await page.goto(BASE + Q);
  const box = page.locator('.date-time-controls');
  await box.scrollIntoViewIfNeeded();
  await box.screenshot({ path: `${out}/p5-02-${engine}-date-time-${w}.png` });
  const m = await page.evaluate(() => { const i = document.querySelector('input[name=departure-date]'); const r = i.getBoundingClientRect(); return { width: Math.round(r.width), dir: getComputedStyle(document.querySelector('.date-time-controls')).flexDirection, docScrollW: document.documentElement.scrollWidth }; });
  rec(`4-${w}`, `date/time at ${w}px`, 'SEE-SCREENSHOT', m);
  await ctx.close();
}

// ---- 5 200% zoom equivalent: 640x400 CSS px at deviceScaleFactor 2 (= 1280x800 window at 200%)
{
  const { ctx, page } = await newPage({ width: 640, height: 400 }, { deviceScaleFactor: 2 });
  const pages = [['search', Q], ['journey', '/journey/regional-connection'], ['wallet', '/wallet/regional-connection']];
  const res = {};
  for (const [name, path] of pages) {
    await page.goto(BASE + path); await page.waitForTimeout(800);
    res[name] = await page.evaluate(() => ({ vw: innerWidth, scrollW: document.documentElement.scrollWidth }));
    await page.screenshot({ path: `${out}/p5-02-${engine}-zoom200eq-${name}.png` });
  }
  const ok = Object.values(res).every(r => r.scrollW <= r.vw);
  rec('5', '200% zoom equivalent, no horizontal overflow', ok ? 'PASS' : 'FAIL', res);
  await ctx.close();
}

// ---- 6 Pointer autocomplete
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(BASE + Q);
  const d = page.locator('#destination');
  await d.click(); await d.press('Meta+a'); await page.keyboard.type('was');
  const opt = page.locator('#destination-listbox [role=option]').first();
  const label = (await opt.innerText()).replace(/\s+/g, ' ');
  await opt.click();
  const v = await d.inputValue();
  rec('6', 'pointer: click a destination suggestion', v && label.startsWith(v) ? 'PASS' : 'FAIL', { clicked: label, value: v, expanded: await d.getAttribute('aria-expanded') });
  await ctx.close();
}

// ---- 7 Time-only change: typed time, submit, Back / Forward / reload
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(BASE + Q);
  const t = page.locator('input[name=departure-time]');
  await t.click({ position: { x: 14, y: 12 } });
  await page.keyboard.type('0945AM');
  const typed = await t.inputValue();
  await page.getByRole('button', { name: /Find my way/ }).click(); await page.waitForTimeout(500);
  const u1 = page.url().replace(BASE, '');
  await page.goBack(); await page.waitForTimeout(500); const b = await t.inputValue();
  await page.goForward(); await page.waitForTimeout(500); const f = await t.inputValue();
  await page.reload(); await page.waitForTimeout(800); const r = await t.inputValue(); const rd = await page.locator('input[name=departure-date]').inputValue();
  rec('7', 'type time only, submit, Back/Forward/reload', typed === '09:45' && u1.includes('time=09%3A45') && b === '17:30' && f === '09:45' && r === '09:45' && rd === '2026-11-15' ? 'PASS' : 'FAIL', { typed, urlAfter: u1, afterBack: b, afterForward: f, afterReload: r, dateAfterReload: rd });
  await ctx.close();
}

// ---- 8 Journey -> Wallet -> back (pointer clicks + browser Back)
{
  const { ctx, page } = await newPage({ width: 1280, height: 800 });
  await page.goto(BASE + Q);
  await page.getByRole('link', { name: /Choose this route/ }).first().click(); await page.waitForURL(/\/journey\//);
  const j = page.url().replace(BASE, '');
  await page.getByRole('button', { name: /Start demo journey/ }).click();
  await page.getByRole('button', { name: /Next step/ }).click();
  const st = (await page.locator('main [aria-live], main [role=status]').allInnerTexts()).filter(Boolean)[0];
  await page.getByRole('link', { name: /View ticket wallet/ }).click(); await page.waitForURL(/\/wallet\//);
  const w = page.url().replace(BASE, '');
  await page.goBack(); await page.waitForURL(/\/journey\//);
  await page.goBack(); await page.waitForTimeout(600);
  const s = { url: page.url().replace(BASE, ''), date: await page.locator('input[name=departure-date]').inputValue(), time: await page.locator('input[name=departure-time]').inputValue() };
  rec('8', 'Journey -> demo Next -> Wallet -> Back -> Back', w.startsWith('/wallet/') && s.date === '2026-11-15' && s.time === '17:30' ? 'PASS' : 'FAIL', { journey: j, demoStatus: st, wallet: w, backToSearch: s });
  await ctx.close();
}

fs.writeFileSync(`${out}/results-${engine}.json`, JSON.stringify({ engine, version: browser.version(), results }, null, 2));
await browser.close();
