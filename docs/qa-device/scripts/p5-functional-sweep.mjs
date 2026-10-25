// P5 functional sweep: every city pair, date/time edge cases, filters, Journey/Wallet pages.
// Usage (repo root, candidate served locally): node docs/qa-device/scripts/p5-functional-sweep.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const pw = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || 'qa-results/p5-sweep';
fs.mkdirSync(out, { recursive: true });

const cities = ['Portland', 'Boston', 'Providence', 'Hartford', 'New Haven', 'Albany', 'New York', 'Stony Brook', 'Trenton', 'Philadelphia', 'Baltimore', 'Washington, DC', 'Richmond', 'Norfolk', 'Raleigh', 'Charlotte', 'Fayetteville', 'Charleston', 'Savannah', 'Jacksonville', 'Orlando', 'Tampa', 'Fort Lauderdale', 'Miami'];
const BAD = /\b(NaN|undefined|null|Invalid Date|\[object Object\])\b/;
const findings = [];
const log = (area, result, detail) => { findings.push({ area, result, detail }); if (result !== 'PASS') console.log(`[${result}] ${area} :: ${JSON.stringify(detail).slice(0, 400)}`); };

const browser = await pw.chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push({ url: page.url(), text: m.text().slice(0, 200) }); });
page.on('pageerror', e => consoleErrors.push({ url: page.url(), text: 'PAGEERROR ' + String(e).slice(0, 200) }));
console.log('BROWSER chrome', browser.version(), 'BASE', BASE);

const q = (o) => '/?' + new URLSearchParams(o).toString();
async function searchSnapshot() {
  return page.evaluate(() => {
    const live = [...document.querySelectorAll('[aria-live]')].map(e => e.textContent.trim()).filter(Boolean);
    const routes = [...document.querySelectorAll('#routes a')].filter(a => /Choose this route/.test(a.textContent)).map(a => a.getAttribute('href'));
    const cards = [...document.querySelectorAll('#routes article, #routes li')].length;
    const main = document.querySelector('main')?.innerText || '';
    return { live, routes, cards, origin: document.getElementById('origin')?.value, dest: document.getElementById('destination')?.value, date: document.querySelector('input[name=departure-date]')?.value, time: document.querySelector('input[name=departure-time]')?.value, scrollW: document.documentElement.scrollWidth, vw: innerWidth, bad: (main.match(/\b(NaN|undefined|Invalid Date|\[object Object\])\b/) || [])[0] || null, routesText: document.getElementById('routes')?.innerText.slice(0, 600) };
  });
}

// ---- A. Every city pair
const routeIds = new Set();
const pairStats = { total: 0, withRoutes: 0, noRoutes: [], errors: [] };
for (const from of cities) for (const to of cities) {
  if (from === to) continue;
  pairStats.total++;
  await page.goto(BASE + q({ from, to }), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#routes', { timeout: 5000 }).catch(() => {});
  const s = await searchSnapshot();
  if (s.routes.length) { pairStats.withRoutes++; s.routes.forEach(r => routeIds.add(r)); }
  else pairStats.noRoutes.push(`${from} → ${to}: ${s.live.join(' | ').slice(0, 120)}`);
  if (s.bad || s.origin !== from || s.dest !== to) pairStats.errors.push({ from, to, bad: s.bad, origin: s.origin, dest: s.dest });
}
log('A city pairs (552)', pairStats.errors.length ? 'FAIL' : 'PASS', { total: pairStats.total, withRoutes: pairStats.withRoutes, noRoutesCount: pairStats.noRoutes.length, noRoutesSample: pairStats.noRoutes.slice(0, 8), errors: pairStats.errors.slice(0, 5) });

// ---- B. Every Journey + Wallet page produced by results
const jw = { checked: 0, problems: [] };
for (const href of routeIds) {
  const id = href.split('/').pop();
  for (const path of [`/journey/${id}`, `/wallet/${id}`]) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => { const m = document.querySelector('main')?.innerText || document.body.innerText; return { len: m.length, chooseRoute: /choose a route/i.test(m) && m.length < 1500, bad: (m.match(/\b(NaN|undefined|Invalid Date|\[object Object\])\b/) || [])[0] || null, h1: document.querySelector('h1')?.textContent.trim() }; });
    jw.checked++;
    if (r.chooseRoute || r.bad || r.len < 200) jw.problems.push({ path, ...r });
  }
}
log('B Journey/Wallet pages', jw.problems.length ? 'FAIL' : 'PASS', { uniqueRoutes: routeIds.size, pagesChecked: jw.checked, problems: jw.problems.slice(0, 8) });

// ---- C. Same city, aliases, unknown, hostile input
const special = [
  ['same city', { from: 'Boston', to: 'Boston' }],
  ['alias NYC→philly', { from: 'NYC', to: 'philly' }],
  ['alias DC→long island', { from: 'DC', to: 'long island' }],
  ['alias Washington D.C.', { from: 'Washington, D.C.', to: 'Boston' }],
  ['case/space', { from: '  new   york ', to: 'MIAMI' }],
  ['unknown Chicago', { from: 'Chicago', to: 'Boston' }],
  ['unknown both', { from: 'Atlantis', to: 'El Dorado' }],
  ['empty from', { from: '', to: 'Boston' }],
  ['long 300 chars', { from: 'x'.repeat(300), to: 'Boston' }],
  ['html injection', { from: '<img src=x onerror=alert(1)>', to: 'Boston' }],
  ['emoji', { from: '🚆 Boston', to: 'Miami' }],
];
let dialogFired = false; page.on('dialog', d => { dialogFired = true; d.dismiss(); });
for (const [name, params] of special) {
  await page.goto(BASE + q(params), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(250);
  const s = await searchSnapshot();
  log(`C ${name}`, s.bad || s.scrollW > s.vw ? 'FAIL' : 'INFO', { origin: s.origin?.slice(0, 40), dest: s.dest, routes: s.routes.length, live: s.live.join(' | ').slice(0, 200), overflow: s.scrollW > s.vw, bad: s.bad });
}
log('C no script execution from URL input', dialogFired ? 'FAIL' : 'PASS', { dialogFired });

// ---- D. Date edge cases via URL
const dates = [['2026-10-24', '2026-10-24'], ['2026-12-31', '2026-12-31'], ['2027-01-01', '2027-01-01'], ['2028-02-29', '2028-02-29'], ['2026-02-29', '2026-10-24'], ['2026-03-08', '2026-03-08'], ['2026-11-01', '2026-11-01'], ['1999-12-31', '1999-12-31'], ['2000-02-29', '2000-02-29'], ['2100-02-29', '2026-10-24'], ['2099-12-31', '2099-12-31'], ['9999-12-31', '9999-12-31'], ['0001-01-01', '0001-01-01'], ['2026-13-01', '2026-10-24'], ['2026-00-10', '2026-10-24'], ['2026-04-31', '2026-10-24'], ['26-10-24', '2026-10-24'], ['garbage', '2026-10-24'], ['2026-1-5', '2026-10-24'], ['20260-01-01', '2026-10-24']];
const baseline = await (async () => { await page.goto(BASE + q({ from: 'Philadelphia', to: 'Stony Brook' })); await page.waitForTimeout(200); return (await searchSnapshot()).routes; })();
for (const [input, expect] of dates) {
  await page.goto(BASE + q({ from: 'Philadelphia', to: 'Stony Brook', date: input }), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(150);
  const s = await searchSnapshot();
  const sameRoutes = JSON.stringify(s.routes) === JSON.stringify(baseline);
  log(`D date ${input}`, s.date === expect && sameRoutes && !s.bad ? 'PASS' : 'FAIL', { expect, got: s.date, sameRoutes, bad: s.bad });
}

// ---- E. Time edge cases via URL
const times = [['00:00', '00:00'], ['23:59', '23:59'], ['12:00', '12:00'], ['12:30', '12:30'], ['24:00', '08:00'], ['23:60', '08:00'], ['9:05', '08:00'], ['-01:00', '08:00'], ['ab:cd', '08:00'], ['07:30:00', '08:00']];
for (const [input, expect] of times) {
  await page.goto(BASE + q({ from: 'Philadelphia', to: 'Stony Brook', time: input }), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(150);
  const s = await searchSnapshot();
  log(`E time ${input}`, s.time === expect && !s.bad ? 'PASS' : 'FAIL', { expect, got: s.time, bad: s.bad });
}

// ---- F. Typed dates/years in the native control, then submit -> URL
const typedCases = [['01012027', '2027-01-01'], ['02292028', '2028-02-29'], ['12312099', '2099-12-31'], ['07041776', '1776-07-04'], ['03082026', '2026-03-08']];
for (const [keys, expect] of typedCases) {
  await page.goto(BASE + q({ from: 'Boston', to: 'Miami' }), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(150);
  const d = page.locator('input[name=departure-date]');
  await d.click({ position: { x: 14, y: 12 } }); await page.keyboard.type(keys);
  const typed = await d.inputValue();
  await page.getByRole('button', { name: /Find my way/ }).click(); await page.waitForTimeout(300);
  const url = new URL(page.url()); const s = await searchSnapshot();
  log(`F typed date ${expect}`, typed === expect && url.searchParams.get('date') === expect && s.routes.length > 0 ? 'PASS' : 'FAIL', { typed, urlDate: url.searchParams.get('date'), routes: s.routes.length });
}
// Five-digit year typed into the date field
{
  await page.goto(BASE + q({ from: 'Boston', to: 'Miami' })); await page.waitForTimeout(150);
  const d = page.locator('input[name=departure-date]');
  await d.click({ position: { x: 14, y: 12 } }); await page.keyboard.type('010120270');
  const typed = await d.inputValue();
  await page.getByRole('button', { name: /Find my way/ }).click(); await page.waitForTimeout(300);
  const url = new URL(page.url()); const s = await searchSnapshot();
  log('F typed 5-digit year', 'INFO', { typed, urlDate: url.searchParams.get('date'), shownAfterSubmit: s.date, routes: s.routes.length });
  await page.reload(); await page.waitForTimeout(300);
  log('F typed 5-digit year after reload', 'INFO', { shownAfterReload: (await searchSnapshot()).date });
}
// Cleared date / time then submit
{
  await page.goto(BASE + q({ from: 'Boston', to: 'Miami', date: '2026-11-15' })); await page.waitForTimeout(150);
  await page.locator('input[name=departure-date]').fill('');
  await page.getByRole('button', { name: /Find my way/ }).click(); await page.waitForTimeout(300);
  const s = await searchSnapshot();
  log('F cleared date then submit', 'INFO', { url: page.url().replace(BASE, ''), shown: s.date, routes: s.routes.length, live: s.live.join(' | ').slice(0, 150) });
}

// ---- G. Filters, operator, sort, Amtrak toggle
await page.goto(BASE + q({ from: 'Boston', to: 'Miami' })); await page.waitForTimeout(200);
const filterButtons = await page.locator('#routes button').allInnerTexts();
log('G filter controls present', 'INFO', { buttons: filterButtons.map(t => t.trim()).filter(t => t.length < 30) });
for (const mode of ['all', 'rail', 'bus', 'mixed']) for (const sort of ['recommended', 'fastest', 'fare']) {
  await page.goto(BASE + q({ from: 'Boston', to: 'Miami', mode, sort }), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#routes article')];
    return cards.map(c => { const t = c.innerText; const dur = t.match(/(\d+)h\s*(\d+)?m?/); const fare = t.match(/\$(\d+(?:\.\d+)?)/); return { mins: dur ? (+dur[1]) * 60 + (+(dur[2] || 0)) : null, fare: fare ? +fare[1] : null, text: t.slice(0, 60).replace(/\s+/g, ' ') }; });
  });
  let sorted = true;
  if (sort === 'fastest') sorted = r.every((c, i) => i === 0 || c.mins == null || r[i - 1].mins == null || r[i - 1].mins <= c.mins);
  if (sort === 'fare') sorted = r.every((c, i) => i === 0 || c.fare == null || r[i - 1].fare == null || r[i - 1].fare <= c.fare);
  log(`G mode=${mode} sort=${sort}`, sorted ? 'PASS' : 'FAIL', { count: r.length, order: r.map(c => `${c.mins}m/$${c.fare}`) });
}
for (const amtrak of ['1', '0']) {
  await page.goto(BASE + q({ from: 'Boston', to: 'Miami', amtrak }), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(200);
  const txt = await page.locator('#routes').innerText();
  log(`G amtrak=${amtrak}`, amtrak === '0' && /Amtrak/i.test(txt.replace(/Include Amtrak|Amtrak routes?/gi, '')) ? 'CHECK' : 'INFO', { mentionsAmtrak: (txt.match(/Amtrak/gi) || []).length, live: (await searchSnapshot()).live.join(' | ').slice(0, 150) });
}

// ---- H. Swap button
await page.goto(BASE + q({ from: 'Boston', to: 'Miami' })); await page.waitForTimeout(200);
await page.getByRole('button', { name: /Swap origin and destination/ }).click();
const sw = await searchSnapshot();
log('H swap', sw.origin === 'Miami' && sw.dest === 'Boston' ? 'PASS' : 'FAIL', { origin: sw.origin, dest: sw.dest });

// ---- I. Layout at 320/375/390 for long-name pairs (overflow + screenshots)
for (const w of [320, 375, 390]) {
  const c2 = await browser.newContext({ viewport: { width: w, height: 800 } }); const p2 = await c2.newPage();
  for (const [from, to] of [['Fort Lauderdale', 'Portland'], ['Washington, DC', 'Stony Brook']]) {
    await p2.goto(BASE + q({ from, to, date: '2028-02-29', time: '23:59' })); await p2.waitForTimeout(300);
    const m = await p2.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, vw: innerWidth }));
    const tag = `${w}-${from.split(/[ ,]/)[0].toLowerCase()}`;
    await p2.locator('.search-section').screenshot({ path: `${out}/search-${tag}.png` });
    const href = await p2.locator('#routes a', { hasText: 'Choose this route' }).first().getAttribute('href');
    if (href) {
      await p2.goto(BASE + href); await p2.waitForTimeout(300);
      const jm = await p2.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, vw: innerWidth }));
      await p2.screenshot({ path: `${out}/journey-${tag}.png`, fullPage: false });
      log(`I ${w}px ${from}→${to} journey overflow`, jm.scrollW > jm.vw ? 'FAIL' : 'PASS', jm);
    }
    log(`I ${w}px ${from}→${to} search overflow`, m.scrollW > m.vw ? 'FAIL' : 'PASS', m);
  }
  await c2.close();
}

log('Z console errors', consoleErrors.length ? 'FAIL' : 'PASS', { count: consoleErrors.length, sample: consoleErrors.slice(0, 8) });
fs.writeFileSync(`${out}/sweep-results.json`, JSON.stringify({ base: BASE, chrome: browser.version(), pairStats, routeCount: routeIds.size, findings, consoleErrors }, null, 2));
console.log('DONE findings', findings.length, 'nonpass', findings.filter(f => f.result !== 'PASS').length);
await browser.close();
