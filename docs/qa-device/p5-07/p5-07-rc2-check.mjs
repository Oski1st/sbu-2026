// P5-07: F1 focus rings (real keyboard), F2 date/time layout across widths, K5 new-tab link names, on a served build.
// Usage (repo root): node docs/qa-device/p5-07/p5-07-rc2-check.mjs <baseUrl> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const pw = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const out = process.argv[3] || 'qa-results/p5-07';
fs.mkdirSync(out, { recursive: true });
const results = [];
const rec = (id, check, result, detail) => { results.push({ id, check, result, detail }); console.log(`[${result}] ${id} ${check} :: ${JSON.stringify(detail).slice(0, 700)}`); };
const browser = await pw.chromium.launch({ channel: 'chrome' });
console.log('BROWSER chrome', browser.version(), 'BASE', BASE);

// Measures the visible focus indicator of the active element against the colour it is drawn on.
const probe = () => {
  const el = document.activeElement, cs = getComputedStyle(el);
  const parse = c => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  const bgOf = start => { for (let e = start; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0.5) return { c, from: e.className?.toString().slice(0, 30) || e.tagName }; } return { c: { r: 255, g: 255, b: 255 }, from: 'default' }; };
  const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && parse(cs.outlineColor).a > 0;
  let kind, color, width, against;
  if (outline) {
    kind = parseFloat(cs.outlineOffset) < 0 ? 'outline-inset' : 'outline';
    color = parse(cs.outlineColor); width = cs.outlineWidth;
    against = kind === 'outline-inset' ? bgOf(el) : bgOf(el.parentElement);
  } else {
    kind = 'border-bottom'; color = parse(cs.borderBottomColor); width = cs.borderBottomWidth; against = bgOf(el.parentElement);
  }
  const name = (el.getAttribute('aria-label') || el.id || el.getAttribute('name') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return { name, tag: el.tagName, cls: el.className?.toString().slice(0, 40), fv: el.matches(':focus-visible'), kind, width, color: `rgb(${color.r},${color.g},${color.b})`, against: `rgb(${against.c.r},${against.c.g},${against.c.b}) (${against.from})`, ratio: color.a === 0 ? 0 : ratio(color, against.c), active: el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true' };
};

// ---- F1: Tab through Search from the top with real key presses.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?from=Boston&to=Miami', { waitUntil: 'networkidle' });
  await page.mouse.click(2, 2);
  const stops = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab'); await page.waitForTimeout(120);
    const s = await page.evaluate(probe);
    stops.push(s);
    const key = s.name.toLowerCase();
    const shot = { origin: 'origin', destination: 'destination', 'swap origin and destination': 'swap', 'departure-date': 'date', 'departure-time': 'time', 'find my way': 'find' }[key] || (s.tag === 'A' && /^(search|journey|wallet)$/.test(key) ? `nav-${key}` : null) || (s.tag === 'BUTTON' && /^(all transport|rail only)$/.test(key) ? `filter-${key.replace(' ', '-')}` : null);
    if (shot) {
      const box = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
      if (box.w > 0) await page.screenshot({ path: `${out}/f1-focus-${shot}.png`, clip: { x: Math.max(0, box.x - 14), y: Math.max(0, box.y - 14), width: Math.min(1440, box.w + 28), height: box.h + 28 } });
    }
  }
  const targets = ['origin', 'swap origin and destination', 'destination', 'departure-date', 'departure-time', 'find my way'];
  for (const t of targets) {
    const s = stops.find(x => x.name.toLowerCase() === t);
    rec(`F1-${t.split(' ')[0]}`, `focus ring: ${t}`, s && s.fv && s.ratio >= 3 ? 'PASS' : 'FAIL', s || 'not reached');
  }
  const nav = stops.filter(s => s.tag === 'A' && /^(Search|Journey|Wallet)$/.test(s.name));
  rec('F1-nav', 'nav pill rings visible (>= 3:1, incl. active pill)', nav.length === 3 && nav.every(s => s.fv && s.ratio >= 3) ? 'PASS' : 'FAIL', nav);
  const pills = stops.filter(s => s.tag === 'BUTTON' && /^(All transport|Rail only|Bus only|Rail \+ bus)$/.test(s.name));
  rec('F1-filters', 'filter pill rings visible (>= 3:1, incl. pressed pill)', pills.length >= 4 && pills.every(s => s.fv && s.ratio >= 3) ? 'PASS' : 'FAIL', pills);
  const weak = stops.filter(s => s.fv && s.ratio < 3);
  rec('F1-all', 'every keyboard stop in the first 30 has a >= 3:1 indicator', weak.length ? 'FAIL' : 'PASS', { stops: stops.length, weak });
  await ctx.close();
}

// ---- F2: date/time layout across widths.
for (const w of [361, 375, 389, 390, 400, 413, 414, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 860 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/?date=2026-11-15&time=17%3A30', { waitUntil: 'networkidle' });
  const box = page.locator('.date-time-controls'); await box.scrollIntoViewIfNeeded();
  await box.screenshot({ path: `${out}/f2-date-time-${w}.png` });
  const m = await page.evaluate(() => {
    const d = document.querySelector('input[name=departure-date]').getBoundingClientRect();
    const t = document.querySelector('input[name=departure-time]').getBoundingClientRect();
    return { stacked: t.top > d.bottom - 1, dateW: Math.round(d.width), timeW: Math.round(t.width), docScrollW: document.documentElement.scrollWidth, vw: innerWidth };
  });
  // A native mm/dd/yyyy value plus the picker icon needs about 144px (the fix's own threshold); stacking is always safe.
  rec(`F2-${w}`, `date/time fully visible at ${w}px`, (m.stacked || m.dateW >= 144) && m.docScrollW <= m.vw ? 'PASS' : 'FAIL', m);
  await ctx.close();
}

// ---- K5: new-tab links must say so in their accessible name.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const missing = {};
  for (const [label, path, prep] of [['search+map', '/', async () => page.evaluate(() => { document.querySelector('.passenger-rail-map details').open = true; })], ['search results', '/?from=Boston&to=Miami', async () => page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /View route details/.test(b.textContent)).forEach(b => b.click()))], ['journey', '/journey/regional-connection', async () => page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /View trip details/.test(b.textContent)).forEach(b => b.click()))], ['wallet', '/wallet/regional-connection', async () => {}]]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); await prep(); await page.waitForTimeout(400);
    missing[label] = await page.evaluate(() => [...document.querySelectorAll('a[target=_blank]')].filter(a => a.getClientRects().length).filter(a => !/new tab/i.test((a.getAttribute('aria-label') || '') + ' ' + a.textContent)).map(a => a.textContent.trim().replace(/\s+/g, ' ').slice(0, 50)));
  }
  const total = Object.values(missing).flat().length;
  rec('K5', 'every visible new-tab link announces "new tab"', total ? 'FAIL (expected; P2-NEWTAB-K5)' : 'PASS', { total, missing });
  await ctx.close();
}

fs.writeFileSync(`${out}/results.json`, JSON.stringify({ base: BASE, chrome: browser.version(), results }, null, 2));
await browser.close();
