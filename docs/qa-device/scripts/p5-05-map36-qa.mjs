// P5-05 installed-Chrome device/accessibility pass for the CONUS rail map candidate (#36).
// Usage (repo root, candidate served locally): node docs/qa-device/scripts/p5-05-map36-qa.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const pw = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || 'qa-results/p5-05-map36';
fs.mkdirSync(out, { recursive: true });
const results = [];
const rec = (id, check, result, detail) => { results.push({ id, check, result, detail }); console.log(`[${result}] ${id} ${check} :: ${JSON.stringify(detail).slice(0, 600)}`); };

const browser = await pw.chromium.launch({ channel: 'chrome' });
console.log('BROWSER chrome', browser.version(), 'BASE', BASE);

// In-page helpers: WCAG contrast of an element's text against its effective background.
const contrastFn = `(() => {
  const parse = c => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
  window.__ratio = (fg, bg) => { const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return +((a + 0.05) / (b + 0.05)).toFixed(2); };
  window.__textContrast = el => { const cs = getComputedStyle(el); return { ratio: __ratio(parse(cs.color), bgOf(el)), size: cs.fontSize, weight: cs.fontWeight }; };
  window.__outlineContrast = el => { const cs = getComputedStyle(el); return cs.outlineStyle === 'none' ? null : { ratio: __ratio(parse(cs.outlineColor), bgOf(el.parentElement)), width: cs.outlineWidth }; };
})()`;

// ---- M1/M2: map at widths: overflow, readability, contrast, external requests
for (const w of [320, 375, 390, 768, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const external = []; const errors = [];
  page.on('request', r => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !u.protocol.startsWith('data')) external.push(r.url()); });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(contrastFn);
  const map = page.locator('.passenger-rail-map');
  await map.scrollIntoViewIfNeeded();
  await map.screenshot({ path: `${out}/map-${w}.png` });
  const m = await page.evaluate(() => {
    const sec = document.querySelector('.passenger-rail-map');
    const svg = sec.querySelector('svg');
    const r = svg.getBoundingClientRect();
    const texts = [...sec.querySelectorAll('.prm-eyebrow, .prm-heading h2, .prm-heading p, .prm-legend li, .prm-note, summary')].map(e => ({ text: e.textContent.trim().slice(0, 40), ...__textContrast(e), clipped: e.scrollWidth > e.clientWidth + 1 }));
    return { vw: innerWidth, docScrollW: document.documentElement.scrollWidth, sectionRight: Math.round(sec.getBoundingClientRect().right), svgW: Math.round(r.width), svgH: Math.round(r.height), routes: sec.querySelectorAll('.prm-routes g').length, stations: sec.querySelectorAll('.prm-stations circle').length, texts };
  });
  const lowContrast = m.texts.filter(t => t.ratio < 4.5);
  const clipped = m.texts.filter(t => t.clipped);
  rec(`M1-${w}`, `map at ${w}px: no sideways scroll, nothing clipped`, m.docScrollW <= m.vw && m.sectionRight <= m.vw && !clipped.length ? 'PASS' : 'FAIL', { vw: m.vw, docScrollW: m.docScrollW, svg: `${m.svgW}x${m.svgH}`, routes: m.routes, stations: m.stations, clipped });
  rec(`M2-${w}`, `map text contrast >= 4.5:1 at ${w}px`, lowContrast.length ? 'FAIL' : 'PASS', { min: Math.min(...m.texts.map(t => t.ratio)), smallestFont: m.texts.map(t => t.size).sort((a, b) => parseFloat(a) - parseFloat(b))[0], lowContrast });
  if (w === 1280) {
    rec('M3', 'no external runtime requests on load', external.length ? 'FAIL' : 'PASS', { external });
    rec('M4', 'no console errors on load', errors.length ? 'FAIL' : 'PASS', { errors });
  }
  await ctx.close();
}

// ---- Z: 200% zoom. Real browser zoom cannot be driven by page automation -> BLOCKED; record emulated equivalent as info only.
{
  const ctx = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const map = page.locator('.passenger-rail-map'); await map.scrollIntoViewIfNeeded();
  await map.screenshot({ path: `${out}/map-zoom200-emulated.png` });
  const z = await page.evaluate(() => ({ vw: innerWidth, docScrollW: document.documentElement.scrollWidth }));
  rec('Z1', 'real 200% browser zoom', 'BLOCKED', { reason: 'browser zoom is not reachable from page automation; emulated 640x400@2x equivalent shown for information only', emulated: z });
  await ctx.close();
}

// ---- K: keyboard through "Corridors, cities & coverage gaps"
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(contrastFn);
  // Collect every Tab stop from the top of the page; note which fall inside the map section.
  const sweep = async (limit) => {
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.mouse.click(2, 2);
    const stops = [];
    for (let i = 0; i < limit; i++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate(() => { const el = document.activeElement; const inMap = !!el.closest('.passenger-rail-map'); return { inMap, tag: el.tagName, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50), fv: el.matches(':focus-visible'), outline: inMap ? __outlineContrast(el) : null }; });
      stops.push(s);
      if (stops.length > 3 && !s.inMap && stops.some(x => x.inMap) && !stops.at(-2).inMap) break;
    }
    return stops;
  };
  const closed = await sweep(40);
  const closedMap = closed.filter(s => s.inMap);
  rec('K1', 'details closed: summary is the only map tab stop', closedMap.length === 1 && closedMap[0].tag === 'SUMMARY' ? 'PASS' : 'FAIL', { mapStops: closedMap.map(s => `${s.tag}:${s.text}`) });
  rec('K2', 'summary focus visible (outline >= 3:1)', closedMap[0]?.fv && closedMap[0]?.outline?.ratio >= 3 ? 'PASS' : 'FAIL', closedMap[0]?.outline);
  // Open with Enter on the summary, then Tab through the content.
  await page.locator('.passenger-rail-map summary').focus();
  await page.keyboard.press('Enter');
  const open = await page.evaluate(() => document.querySelector('.passenger-rail-map details').open);
  const linkCount = await page.locator('.passenger-rail-map .prm-details-content a').count();
  const inside = [];
  for (let i = 0; i < linkCount + 2; i++) {
    await page.keyboard.press('Tab');
    inside.push(await page.evaluate(() => { const el = document.activeElement; return { inDetails: !!el.closest('.prm-details-content'), tag: el.tagName, text: el.textContent.trim().slice(0, 50), href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel'), fv: el.matches(':focus-visible'), outline: __outlineContrast(el), srText: el.querySelector('.prm-sr-only')?.textContent || '' }; }));
  }
  const reached = inside.filter(s => s.inDetails);
  const badOutline = reached.filter(s => !s.fv || !s.outline || s.outline.ratio < 3);
  const noNewTabHint = reached.filter(s => s.target === '_blank' && !/new tab/i.test(s.srText));
  rec('K3', 'Enter opens details; every source link reachable by Tab', open && reached.length === linkCount ? 'PASS' : 'FAIL', { open, linkCount, reached: reached.length });
  rec('K4', 'focus visible on every link (outline >= 3:1)', badOutline.length ? 'FAIL' : 'PASS', { checked: reached.length, minOutline: Math.min(...reached.map(s => s.outline?.ratio ?? 0)), badOutline: badOutline.slice(0, 3) });
  rec('K5', 'new-tab links announce "opens in a new tab"', noNewTabHint.length ? 'FAIL' : 'PASS', { withoutHint: noNewTabHint.map(s => s.text) });
  const httpsOk = reached.every(s => /^https:\/\//.test(s.href) && /noreferrer|noopener/.test(s.rel || ''));
  rec('K6', 'links https + rel noreferrer', httpsOk ? 'PASS' : 'FAIL', { sample: reached.slice(0, 3).map(s => s.href) });
  // Shift+Tab back out and close with Enter on summary.
  await page.locator('.passenger-rail-map summary').focus(); await page.keyboard.press('Enter');
  const closedAgain = await page.evaluate(() => !document.querySelector('.passenger-rail-map details').open);
  rec('K7', 'Enter on summary closes details again', closedAgain ? 'PASS' : 'FAIL', { closedAgain });
  await page.locator('.passenger-rail-map summary').focus(); await page.keyboard.press('Enter');
  await page.locator('.passenger-rail-map').screenshot({ path: `${out}/map-details-open-1280.png` });
  await ctx.close();
}

// ---- W: wording
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const w = await page.evaluate(() => {
    const sec = document.querySelector('.passenger-rail-map');
    sec.querySelector('details').open = true;
    const text = sec.innerText + ' ' + sec.querySelector('desc').textContent;
    const page = document.body.innerText;
    return { partial: /partial (rail )?coverage/i.test(text), notTimetable: /not a timetable/i.test(text), sampleUnchanged: /do not change the sample itineraries/i.test(text), alaskaHawaiiInMap: /alaska|hawaii/i.test(text), alaskaHawaiiOnPage: (page.match(/alaska|hawaii/gi) || []).length, insets: sec.querySelectorAll('[class*=inset]').length, cityCount: sec.querySelectorAll('.prm-city-list > li').length, stonyBrookGap: /Stony Brook[^.]*missing|alignment not mapped/i.test(text) };
  });
  rec('W1', 'says partial coverage', w.partial ? 'PASS' : 'FAIL', w);
  rec('W2', 'says not a timetable', w.notTimetable ? 'PASS' : 'FAIL', {});
  rec('W3', 'no Alaska/Hawaii in map or page', !w.alaskaHawaiiInMap && !w.alaskaHawaiiOnPage && !w.insets ? 'PASS' : 'FAIL', { inMap: w.alaskaHawaiiInMap, onPage: w.alaskaHawaiiOnPage, insets: w.insets });
  rec('W4', 'lists all 24 cities and the Stony Brook gap', w.cityCount === 24 && w.stonyBrookGap ? 'PASS' : 'FAIL', { cityCount: w.cityCount, stonyBrookGap: w.stonyBrookGap });
  await ctx.close();
}

// ---- B: Search / Journey / Wallet basics on #36
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
  await page.goto(BASE + '/?date=2026-11-15&time=17%3A30');
  const o = page.locator('#origin');
  await o.click(); await o.press('Meta+a'); await page.keyboard.type('new');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  const picked = await o.inputValue();
  rec('B1', 'keyboard autocomplete', picked === 'New York' ? 'PASS' : 'FAIL', { picked });
  const d = page.locator('input[name=departure-date]');
  await d.click({ position: { x: 14, y: 12 } }); await page.keyboard.type('12252026');
  await page.getByRole('button', { name: /Find my way/ }).click(); await page.waitForTimeout(400);
  const u = page.url(); const routes = await page.locator('#routes a', { hasText: 'Choose this route' }).count();
  await page.goBack(); await page.waitForTimeout(400);
  const back = await d.inputValue();
  rec('B2', 'typed date -> submit -> Back', u.includes('date=2026-12-25') && routes > 0 && back === '2026-11-15' ? 'PASS' : 'FAIL', { url: u.replace(BASE, ''), routes, afterBack: back });
  await page.goForward(); await page.waitForTimeout(400);
  await page.locator('#routes a', { hasText: 'Choose this route' }).first().click(); await page.waitForURL(/\/journey\//); await page.waitForSelector('h1');
  const j = { url: page.url().replace(BASE, ''), h1: await page.locator('h1').first().innerText() };
  await page.getByRole('button', { name: /Start demo journey/ }).click();
  const status = (await page.locator('main [aria-live], main [role=status]').allInnerTexts()).filter(Boolean)[0];
  await page.getByRole('link', { name: /View ticket wallet/ }).click(); await page.waitForURL(/\/wallet\//); await page.waitForSelector('h1');
  const wallet = page.url().replace(BASE, '');
  await page.goBack(); await page.waitForURL(/\/journey\//); await page.goBack(); await page.waitForTimeout(500);
  const s = { url: page.url().replace(BASE, ''), date: await d.inputValue() };
  rec('B3', 'Journey -> demo -> Wallet -> Back -> Back', wallet.startsWith('/wallet/') && s.date === '2026-12-25' ? 'PASS' : 'FAIL', { journey: j, demoStatus: status, wallet, back: s });
  // Known findings re-check (labelled, not new): F1 focus contrast, F2 375px date clip.
  await page.goto(BASE + '/'); await page.evaluate(contrastFn);
  const f1 = await page.evaluate(() => { const i = document.getElementById('origin'); i.focus(); return getComputedStyle(i).borderBottomColor; });
  rec('F1', 'known: Search field focus indicator (#97b47e, 2.3:1)', 'FAIL (known F1)', { focusBorder: f1 });
  const c375 = await browser.newContext({ viewport: { width: 375, height: 812 } }); const p375 = await c375.newPage();
  await p375.goto(BASE + '/?date=2026-11-15&time=17%3A30');
  const box = p375.locator('.date-time-controls'); await box.scrollIntoViewIfNeeded();
  await box.screenshot({ path: `${out}/date-time-375.png` });
  const dw = await p375.evaluate(() => ({ dateW: Math.round(document.querySelector('input[name=departure-date]').getBoundingClientRect().width), dir: getComputedStyle(document.querySelector('.date-time-controls')).flexDirection }));
  rec('F2', 'known: date year clipped at 375px', dw.dir === 'row' && dw.dateW < 136 ? 'FAIL (known F2)' : 'CHECK', dw);
  await c375.close();
  rec('B4', 'no page errors during basics', errors.length ? 'FAIL' : 'PASS', { errors });
  await ctx.close();
}

fs.writeFileSync(`${out}/results.json`, JSON.stringify({ base: BASE, chrome: browser.version(), results }, null, 2));
await browser.close();
