// P5-06: click through the 3-minute demo on a locally served build and capture each expected screen.
// Usage (repo root): node docs/demo/p5-06/verify-demo.mjs <baseUrl> <screenshotDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const pw = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const out = process.argv[3] || 'qa-results/p5-06';
fs.mkdirSync(out, { recursive: true });
const steps = [];
const step = (n, name, ok, detail) => { steps.push({ n, name, ok, detail }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${n} ${name} :: ${JSON.stringify(detail).slice(0, 500)}`); };

const browser = await pw.chromium.launch({ channel: 'chrome' });
console.log('BROWSER chrome', browser.version(), 'BASE', BASE);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
const t0 = Date.now(); const lap = () => ((Date.now() - t0) / 1000).toFixed(1);

// 1. Landing
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.screenshot({ path: `${out}/01-landing.png` });
step(1, 'landing', (await page.locator('h1').first().innerText()).includes('Different lines'), { h1: await page.locator('h1').first().innerText(), t: lap() });

// 2. Search with autocomplete (keyboard + pointer) and a date preference
const from = page.locator('#origin'), to = page.locator('#destination');
await from.click(); await from.press('Meta+a'); await page.keyboard.type('phil');
await page.waitForSelector('#origin-listbox [role=option]');
const fromOpts = await page.locator('#origin-listbox [role=option]').allInnerTexts();
await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
await to.click(); await to.press('Meta+a'); await page.keyboard.type('stony');
await page.waitForSelector('#destination-listbox [role=option]');
await page.locator('.search-section').screenshot({ path: `${out}/02-autocomplete.png` });
await page.locator('#destination-listbox [role=option]').first().click();
const d = page.locator('input[name=departure-date]');
await d.click({ position: { x: 14, y: 12 } }); await page.keyboard.type('11152026');
await page.getByRole('button', { name: /Find my way/ }).click();
await page.waitForTimeout(600);
const live = (await page.locator('[aria-live]').allInnerTexts()).filter(Boolean);
const cards = await page.locator('#routes article').count();
await page.locator('#routes').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/03-results.png` });
step(2, 'search with autocomplete', (await from.inputValue()) === 'Philadelphia' && (await to.inputValue()) === 'Stony Brook' && cards === 2 && page.url().includes('date=2026-11-15'), { fromOpts: fromOpts.map(s => s.replace(/\s+/g, ' ')), url: page.url().replace(BASE, ''), cards, live, t: lap() });

// 3. Rail map + coverage details
const map = page.locator('.passenger-rail-map');
await map.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/04-rail-map.png` });
await map.locator('summary').click();
const detailsOpen = await map.locator('details').evaluate(e => e.open);
await map.locator('details').screenshot({ path: `${out}/05-map-coverage.png` });
const mapText = await map.innerText();
await map.locator('summary').click();
step(3, 'rail map', detailsOpen && /Partial coverage/i.test(mapText), { heading: await map.locator('h2').innerText(), routes: await map.locator('.prm-routes > g').count(), stations: await map.locator('.prm-stations circle').count(), t: lap() });

// 4. Compare both demo options
await page.locator('#routes').scrollIntoViewIfNeeded();
const compareBtn = page.getByRole('button', { name: /Compare (two|both) options/ });
await compareBtn.click();
const dialog = page.locator('dialog[open], [role=dialog]').first();
await dialog.waitFor();
const insight = await page.locator('.comparison-insight').innerText();
await page.screenshot({ path: `${out}/06-compare.png` });
step(4, 'compare', /35 minutes sooner/.test(insight) && /\$15 more/.test(insight), { compareButton: await compareBtn.innerText(), insight, t: lap() });

// 5. Choose the regional connection (has SEPTA + transfers) -> Journey, demo + simulated delay
const choose = dialog.getByRole('link', { name: /Choose/ }).or(dialog.getByRole('button', { name: /Choose/ }));
const chooseNames = await choose.allInnerTexts();
let picked = false;
for (let i = 0; i < await choose.count(); i++) {
  const href = await choose.nth(i).getAttribute('href');
  if (href && href.includes('regional-connection')) { await choose.nth(i).click(); picked = true; break; }
}
if (!picked) await page.goto(BASE + '/journey/regional-connection');
await page.waitForURL(/\/journey\/regional-connection/); await page.waitForSelector('text=Guided journey');
await page.screenshot({ path: `${out}/07-journey.png` });
await page.getByRole('button', { name: /Start demo journey/ }).click();
await page.getByRole('button', { name: /Next step/ }).click();
const demoStatus = (await page.locator('main [aria-live], main [role=status]').allInnerTexts()).filter(Boolean);
await page.getByRole('button', { name: /^Simulate delay/ }).click();
await page.waitForTimeout(400);
const journeyText = await page.locator('main').innerText();
const delayMsg = (journeyText.match(/[^\n]*(connection|delay)[^\n]*/gi) || []).filter(s => !/Simulate a delay|See how OneLine/.test(s)).slice(0, 4);
await page.locator('text=Simulate a delay').first().scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/08-delay.png` });
step(5, 'journey + simulated delay', /Add 12 minutes/.test(journeyText), { pickedFromDialog: picked, chooseNames, demoStatus, delayMsg, t: lap() });

// 6. Wallet with the live SEPTA panel
await page.getByRole('link', { name: /View ticket wallet/ }).click();
await page.waitForURL(/\/wallet\/regional-connection/);
await page.waitForFunction(() => /Live feed fetched|unavailable|No active|retrieved/i.test(document.querySelector('main')?.innerText || ''), null, { timeout: 10000 }).catch(() => {});
const walletText = await page.locator('main').innerText();
const septa = (walletText.match(/[^\n]*(SEPTA|feed|Delay|retrieved|simulated)[^\n]*/gi) || []).slice(0, 8);
await page.locator('text=/SEPTA/').last().scrollIntoViewIfNeeded().catch(() => {});
await page.screenshot({ path: `${out}/09-wallet-septa.png` });
step(6, 'wallet + SEPTA panel', /SEPTA/.test(walletText) && !/999 min/.test(walletText), { header: walletText.match(/\d+ travel legs?[^\n]*/)?.[0], septa, t: lap() });
console.log('ELAPSED_CLICKTHROUGH_S', lap());

// 7. Backup path: SEPTA feed down (502 from the proxy) and empty feed
for (const [name, status, body] of [['outage-502', 502, '{"error":"septa_unavailable"}'], ['empty-200', 200, '[]']]) {
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await c2.newPage();
  await p2.route('**/api/transit/septa/trains', r => r.fulfill({ status, contentType: 'application/json', body }));
  await p2.goto(BASE + '/wallet/regional-connection');
  await p2.waitForTimeout(1500);
  const txt = await p2.locator('main').innerText();
  const lines = (txt.match(/[^\n]*(SEPTA|feed|unavailable|No active|Refresh|try again)[^\n]*/gi) || []).slice(0, 6);
  await p2.locator('text=/SEPTA/').last().scrollIntoViewIfNeeded().catch(() => {});
  await p2.screenshot({ path: `${out}/10-backup-${name}.png` });
  step(`7-${name}`, `backup: wallet when feed ${name}`, !/Loading|Fetching/i.test(lines.join(' ')) && lines.length > 0, { lines });
  await c2.close();
}
step(8, 'no page/console errors', errors.length === 0, { errors });
fs.writeFileSync(`${out}/demo-steps.json`, JSON.stringify({ base: BASE, chrome: browser.version(), steps }, null, 2));
await browser.close();
