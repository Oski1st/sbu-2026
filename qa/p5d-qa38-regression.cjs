// P5D-QA38 item 3: do the P2/P3-assigned findings still reproduce, and did anything else regress?
// Usage: node qa/p5d-qa38-regression.cjs <baseUrl> <outDir> <label>
// Automated Chrome check, not a human test. "REPRODUCES" means the known defect is still present.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2], OUT = process.argv[3], LABEL = process.argv[4] || 'run';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (id, kind, name, status, observed) => { results.push({ id, kind, name, status, observed }); console.log(`${status} ${id} ${name} :: ${JSON.stringify(observed).slice(0, 360)}`); };

function contrastFn() {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  window.__contrast = el => { const fg = parse(getComputedStyle(el).color); const bg = bgOf(el); const a = fg.a ?? 1; const mix = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) }; const L1 = lum(mix), L2 = lum(bg); return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2)); };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const open = async (path, w = 1280, h = 900) => { const c = await browser.newContext({ viewport: { width: w, height: h } }); await c.addInitScript(contrastFn); const p = await c.newPage(); if (path) await p.goto(BASE + path, { waitUntil: 'networkidle' }); return p; };
  const close = p => p.context().close();
  const legsOf = async p => p.evaluate(() => [...document.querySelectorAll('article, li, section')].map(e => e.innerText).filter(t => /Journey segment \d+/.test(t)).map(t => t.replace(/\s+/g, ' ').slice(0, 160)));
  const segs = async p => p.evaluate(() => [...document.querySelectorAll('p')].filter(e => /Journey segment \d+/.test(e.textContent)).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  const step = async (fn) => { try { await fn(); } catch (e) { console.log('ERROR', String(e).slice(0, 300)); } };

  // ---------- P2 findings ----------
  await step(async () => { const p = await open('/journey/east-boston--miami--amtrak');
    const planned = await p.evaluate(() => [...document.body.innerText.matchAll(/(\d+) min planned/g)].map(m => +m[1]));
    await p.getByRole('button', { name: 'Simulate delay' }).click(); await p.waitForTimeout(400);
    const warn = await p.evaluate(() => document.body.innerText.includes('Your connection may no longer be comfortable'));
    await p.screenshot({ path: `${OUT}/${LABEL}-j2-delay-warning.png` });
    rec('J2', 'P2', 'Simulate delay always warns (12-min delay vs 60-min transfer)', warn ? 'REPRODUCES' : 'NOT-REPRODUCED', { plannedTransferMinutes: planned, warningShown: warn }); await close(p); });

  await step(async () => { const p = await open('/journey/east-boston--miami--amtrak', 320, 800);
    await p.getByRole('button', { name: 'Simulate delay' }).click(); await p.waitForTimeout(400);
    const r = await p.evaluate(() => { const delayed = document.querySelector('span.flex-col.items-end'); if (!delayed) return null; const times = [...delayed.querySelectorAll('time')].map(t => Math.round(t.getBoundingClientRect().left)); const card = delayed.closest('.grid'); const dep = card?.querySelector('time'); return { delayedTimesLeft: times, departTimeLeft: dep ? Math.round(dep.getBoundingClientRect().left) : null, alignItems: getComputedStyle(delayed).alignItems }; });
    await p.screenshot({ path: `${OUT}/${LABEL}-j3-320-delayed-alignment.png`, fullPage: false });
    const rep = r && r.delayedTimesLeft.some(x => x > (r.departTimeLeft ?? 0) + 4);
    rec('J3', 'P2', 'Delayed arrival right-aligned at 320px while other times left-aligned', rep ? 'REPRODUCES' : 'NOT-REPRODUCED', r); await close(p); });

  await step(async () => { const p = await open('/wallet/east-boston--miami--amtrak');
    const links = await p.evaluate(() => [...document.querySelectorAll('main a')].map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/journey')));
    rec('W3', 'P2', 'Wallet has no link back to /journey/<id>', links.some(h => /east-boston--miami--amtrak/.test(h)) ? 'NOT-REPRODUCED' : 'REPRODUCES', { journeyLinksInMain: links }); await close(p); });

  await step(async () => { const p = await open('/?from=Portland&to=Miami');
    const cards = await p.evaluate(() => [...document.querySelectorAll('#routes article')].map(a => ({ text: a.innerText.replace(/\s+/g, ' ').slice(0, 200), href: [...a.querySelectorAll('a')].map(x => x.getAttribute('href')).find(h => h && h.includes('/journey/')) })));
    const coach = cards.find(c => /coach/i.test(c.text)) || cards[1];
    const id = coach?.href?.split('/journey/')[1]?.split('?')[0];
    let legs = [];
    if (id) { await p.goto(BASE + '/journey/' + id, { waitUntil: 'networkidle' }); legs = await p.evaluate(() => [...document.querySelectorAll('p')].filter(e => /Journey segment \d+/.test(e.textContent)).map(e => e.closest('article,li,section,div.rounded-3xl,div')?.innerText.replace(/\s+/g, ' ').slice(0, 200))); }
    const long = legs.filter(t => /Intercity coach/i.test(t));
    rec('F8', 'P2', 'Very long coach leg rendered as one unbroken leg (Portland->Miami)', /33h 10m/.test(JSON.stringify(cards)) && legs.length <= 2 ? 'REPRODUCES' : 'CHECK', { cards: cards.map(c => c.text.slice(0, 120)), id, legCount: legs.length, legs: legs.slice(0, 3) }); await close(p); });

  await step(async () => { const p = await open('/journey/east-boston--miami--amtrak');
    const nexts = await p.evaluate(() => [...document.querySelectorAll('p')].filter(e => /^Next:/.test(e.textContent.trim())).map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    const timelineHasOct25 = await p.evaluate(() => /Oct 25/.test(document.body.innerText));
    rec('S4', 'P2', 'Transfer prompt shows next departure without a date on multi-day trip', timelineHasOct25 && nexts.length && nexts.every(t => !/Oct \d+/.test(t)) ? 'REPRODUCES' : 'NOT-REPRODUCED', { timelineHasOct25, nexts }); await close(p); });

  await step(async () => { const p = await open('/journey/amtrak-connection');
    const next = p.getByRole('button', { name: /^Next/ });
    const start = p.getByRole('button', { name: /^Start/ });
    if (await start.count()) await start.first().click();
    let clicks = 0;
    await next.focus();
    for (let i = 0; i < 40 && !(await next.isDisabled()); i++) { await p.keyboard.press('Enter'); clicks++; await p.waitForTimeout(60); }
    const nextDisabled = await next.isDisabled();
    const active = await p.evaluate(() => document.activeElement?.tagName + (document.activeElement?.textContent ? ':' + document.activeElement.textContent.trim().slice(0, 30) : ''));
    rec('P2-F1', 'P2', 'Demo focus drops to <body> at last step (keyboard Enter on Next)', nextDisabled && /^BODY/.test(active) ? 'REPRODUCES' : 'NOT-REPRODUCED', { keyboardActivations: clicks, nextDisabled, activeElement: active }); await close(p); });

  await step(async () => { const p = await open('/journey/east-new-york--stony-brook--amtrak');
    const btn = p.getByRole('button', { name: 'Simulate delay' });
    const has = await btn.count();
    if (has) { await btn.click(); await p.waitForTimeout(400); }
    const live = await p.evaluate(() => [...document.querySelectorAll('[aria-live]')].map(e => e.textContent.trim()).join(' | '));
    const badge = await p.evaluate(() => /\+12/.test(document.body.innerText));
    rec('P2-F6', 'P2', 'Single-leg delay: +12 badge but live region empty', has && badge && !/arriv/i.test(live) ? 'REPRODUCES' : 'CHECK', { simulateButton: has, plus12Badge: badge, liveRegions: live.slice(0, 200) }); await close(p); });

  // ---------- P3 findings ----------
  const journeyLegs = async (id) => { const p = await open('/journey/' + id); const s = await segs(p); const route = await p.evaluate(() => [...document.querySelectorAll('h3, p.text-lg')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 16)); const total = await p.evaluate(() => (document.body.innerText.match(/\b\d+h \d+m\b/) || [null])[0]); await close(p); return { id, segments: s, stops: route, firstDuration: total }; };
  await step(async () => { const r = [];
    for (const id of ['east-raleigh--fayetteville--amtrak', 'east-charlotte--charleston--amtrak', 'east-boston--albany--amtrak', 'east-albany--boston--amtrak']) r.push(await journeyLegs(id));
    const via = r.map(x => ({ id: x.id, dur: x.firstDuration, viaRichmondOrNY: x.stops.some(s => /Richmond|New York/.test(s)), stops: x.stops }));
    rec('P3-detours', 'P3', 'Rail detours via Richmond / New York', via.every(v => v.viaRichmondOrNY) ? 'REPRODUCES' : 'PARTIAL', via); });
  await step(async () => { const r = [];
    for (const id of ['east-new-york--raleigh--amtrak', 'east-new-york--miami--amtrak', 'east-new-york--norfolk--amtrak', 'east-hartford--new-york--amtrak']) r.push(await journeyLegs(id));
    rec('P3-oneseat', 'P3', 'One-seat rides shown as transfers', r.every(x => x.segments.length >= 2) ? 'REPRODUCES' : 'PARTIAL', r.map(x => ({ id: x.id, segments: x.segments }))); });
  await step(async () => { const r = [];
    for (const id of ['east-new-york--stony-brook--amtrak', 'east-richmond--raleigh--greyhound']) r.push(await journeyLegs(id));
    const p = await open('/journey/regional-connection'); const demo = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').match(/Huntington.{0,200}Stony Brook.{0,80}/)?.[0]); await close(p);
    rec('P3-times', 'P3', 'Segment times: NY-Stony Brook 180, Richmond-Raleigh bus 180, demo Huntington-Stony Brook 50/55', /3h 0m/.test(r[0].firstDuration || '') && /3h 0m|3h 30m/.test(r[1].firstDuration || '') ? 'REPRODUCES' : 'CHECK', { nyStonyBrook: r[0], richmondRaleighBus: r[1], demoSnippet: demo }); });
  await step(async () => { const p = await open('/');
    const fares = await p.evaluate(() => [...document.querySelectorAll('#routes article')].map(a => (a.innerText.match(/\$\d+(\.\d+)?/g) || []).join(' ')));
    await p.locator('.detail-toggle').first().click(); await p.waitForTimeout(200);
    const legFares = await p.evaluate(() => [...document.querySelectorAll('.leg-detail small')].map(s => s.textContent.replace(/\s+/g, ' ').trim()));
    const asOf = await p.evaluate(() => /as of 2026-10-25/i.test(document.body.innerText));
    const q = await open('/?from=Boston&to=Miami'); await q.waitForSelector('#routes article'); const gen = await q.evaluate(() => (document.body.innerText.match(/Check fares with the operator/g) || []).length); await close(q);
    rec('P3-fares', 'P3', 'Fares not shown as sourced "as of" ranges; generated routes have no fares', !asOf ? 'REPRODUCES' : 'NOT-REPRODUCED', { demoCardFares: fares, demoLegFares: legFares, asOfLabel: asOf, generatedCheckFaresCount: gen }); await close(p); });
  await step(async () => { const p = await open('/');
    const m = await p.evaluate(() => { const out = {}; const pick = (k, re) => { const el = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 || e.childElementCount < 3).find(e => re.test(e.textContent) && e.offsetParent !== null && e.textContent.length < 400); out[k] = el ? { contrast: window.__contrast(el), fontSize: getComputedStyle(el).fontSize, text: el.textContent.trim().slice(0, 60) } : null; };
      const rd = document.querySelector('.results-disclaimer'); out.resultsDisclaimer = rd ? { contrast: window.__contrast(rd), fontSize: getComputedStyle(rd).fontSize } : null;
      pick('hackathonNote', /hackathon/i); pick('realOperators', /REAL OPERATORS/); return out; });
    const low = Object.values(m).filter(Boolean).some(x => x.contrast < 4.5);
    rec('P3-contrast', 'P3', 'Small text below 4.5:1', low ? 'REPRODUCES' : 'NOT-REPRODUCED', m); await close(p); });

  // P3 behaviour items
  await step(async () => { const c = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await c.newPage();
    await p.goto(BASE + '/journey/amtrak-connection', { waitUntil: 'networkidle' });
    await p.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Search' }).click(); await p.waitForTimeout(300);
    await p.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Journey' }).click(); await p.waitForTimeout(400);
    const url = p.url().replace(BASE, '');
    rec('P3-nav-trip', 'P3', 'Header nav loses a shared trip (shared link -> Search -> Journey)', url === '/journey' ? 'REPRODUCES' : 'NOT-REPRODUCED', { landedOn: url }); await c.close(); });
  await step(async () => { const p = await open('/');
    const before = await p.evaluate(() => document.querySelector('p[role=status][aria-live]')?.textContent.trim());
    await p.getByRole('button', { name: 'Bus only' }).click(); await p.waitForTimeout(300);
    const after = await p.evaluate(() => document.querySelector('p[role=status][aria-live]')?.textContent.trim());
    const empty = await p.evaluate(() => /No sample journeys match/i.test(document.body.innerText));
    rec('P3-filter-live', 'P3', 'Filter result count not announced', empty && before === after ? 'REPRODUCES' : 'NOT-REPRODUCED', { before, after, emptyMessageShown: empty }); await close(p); });
  await step(async () => { const p = await open('/?from=Boston&to=Miami');
    const n3 = p.locator('.compare-route-check input'); const count = await n3.count();
    for (let i = 0; i < Math.min(3, count); i++) await n3.nth(i).check().catch(() => {});
    const states = await p.evaluate(() => [...document.querySelectorAll('.compare-route-check input')].map(i => i.checked));
    rec('P3-third-tick', 'P3', 'Third Compare tick silently unticks the first', count >= 3 && states[0] === false && states[2] === true ? 'REPRODUCES' : 'CHECK', { count, states }); await close(p); });
  await step(async () => { const p = await open('/');
    const a = await p.evaluate(() => { const el = [...document.querySelectorAll('a')].find(x => /Let.s go somewhere/.test(x.textContent)); return el ? { name: el.getAttribute('aria-label'), href: el.getAttribute('href'), text: el.textContent.trim() } : null; });
    rec('P3-letsgo', 'P3', '"Let\'s go somewhere" accessible name mismatch', a && a.name === 'Back to search' ? 'REPRODUCES' : 'CHECK', a); await close(p); });

  // ---------- general regression (expected to WORK) ----------
  await step(async () => { const p = await open('/');
    const nav = p.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'Journey' }).click(); await p.waitForTimeout(300); const j = p.url().replace(BASE, '');
    await nav.getByRole('link', { name: 'Wallet' }).click(); await p.waitForTimeout(300); const w = p.url().replace(BASE, '');
    await nav.getByRole('link', { name: 'Search' }).click(); await p.waitForTimeout(300); const s = p.url().replace(BASE, '');
    rec('R-nav', 'regression', 'Header nav Search/Journey/Wallet navigates', /^\/journey/.test(j) && /^\/wallet/.test(w) && s.startsWith('/') && !/journey|wallet/.test(s) ? 'PASS' : 'FAIL', { j, w, s }); await close(p); });
  await step(async () => { const p = await open('/');
    const checks = p.locator('.compare-route-check input'); for (let i = 0; i < 2; i++) await checks.nth(i).check();
    await p.getByRole('button', { name: /compare routes/i }).click(); await p.waitForTimeout(300);
    const openNow = await p.evaluate(() => document.querySelector('dialog.comparison-dialog')?.open);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const closed = await p.evaluate(() => !document.querySelector('dialog.comparison-dialog')?.open);
    rec('R-compare', 'regression', 'Compare dialog opens and closes with Escape', openNow && closed ? 'PASS' : 'FAIL', { openNow, closed }); await close(p); });
  await step(async () => { const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] }); const p = await c.newPage(); await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /Copy preview link/ }).first().click(); await p.waitForTimeout(400);
    const clip = await p.evaluate(() => navigator.clipboard.readText().catch(e => 'ERR ' + e));
    const feedback = await p.evaluate(() => document.querySelector('.share-feedback')?.textContent.trim().slice(0, 120) || null);
    rec('R-copy', 'regression', 'Copy preview link copies a /journey link', /\/journey\//.test(clip) || /journey/.test(feedback || '') ? 'PASS' : 'FAIL', { clipboard: clip, feedback }); await c.close(); });
  await step(async () => { const p = await open('/?from=Boston&to=Miami');
    const count = async () => p.evaluate(() => document.querySelectorAll('#routes article').length);
    const all = await count(); await p.getByRole('button', { name: 'Rail only' }).click(); await p.waitForTimeout(200); const rail = await count();
    await p.getByRole('button', { name: 'Bus only' }).click(); await p.waitForTimeout(200); const bus = await count();
    await p.getByRole('button', { name: 'All transport' }).click(); await p.waitForTimeout(200); const back = await count();
    rec('R-filters', 'regression', 'Mode filters change result counts and restore', all > 0 && back === all && rail + bus >= 1 ? 'PASS' : 'FAIL', { all, rail, bus, back }); await close(p); });
  await step(async () => { const out = {};
    for (const [k, handler] of [['unavailable500', r => r.fulfill({ status: 500, body: 'x' })], ['emptyList', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })], ['badShape', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"error":"no"}' })]]) {
      const c = await browser.newContext(); const p = await c.newPage(); await p.route('**/api/transit/septa/trains**', handler);
      await p.goto(BASE + '/wallet/regional-connection', { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      out[k] = await p.evaluate(() => { const t = document.body.innerText; const i = t.search(/SEPTA (live|status|trains)|TrainView|Live SEPTA/i); return t.slice(Math.max(0, i), i + 220).replace(/\s+/g, ' '); });
      await c.close(); }
    const ok = Object.values(out).every(t => !/999 min|undefined|NaN/.test(t) && t.length > 20);
    rec('R-septa-states', 'regression', 'SEPTA panel states (500 / empty / bad shape) render a message', ok ? 'PASS' : 'CHECK', out); });
  await step(async () => { const p = await open('/?from=Boston&to=Miami');
    await p.getByRole('link', { name: /Choose this route/ }).first().click(); await p.waitForTimeout(500); const j = p.url().replace(BASE, '');
    await p.goBack(); await p.waitForTimeout(500); const back = p.url().replace(BASE, '');
    const from = await p.locator('#origin').inputValue().catch(() => null);
    rec('R-back', 'regression', 'Back from Journey returns to the same search', /journey/.test(j) && /from=Boston/.test(back) && from === 'Boston' ? 'PASS' : 'FAIL', { journeyUrl: j, backUrl: back, originField: from }); await close(p); });
  await step(async () => { const out = [];
    for (const path of ['/journey/east-portland--boston--amtrak', '/wallet/east-portland--boston--amtrak', '/journey/east-portland--boston--greyhound', '/wallet/east-portland--boston--greyhound', '/journey/east-portland--boston--flixbus', '/wallet/east-portland--boston--flixbus', '/journey/east-portland--providence--amtrak', '/wallet/east-portland--providence--amtrak']) {
      const p = await open(path); await p.waitForTimeout(800); out.push({ path, len: (await p.evaluate(() => document.querySelector('main')?.innerText.length || 0)), h1: await p.evaluate(() => document.querySelector('h1')?.textContent.trim().slice(0, 60)) }); await close(p); }
    rec('R-sweep8', 'regression', 'Sweep B near-empty pages re-checked with a longer wait', out.every(x => x.len > 200) ? 'PASS' : 'FAIL', out); });

  await browser.close();
  fs.writeFileSync(`${OUT}/${LABEL}-regression.json`, JSON.stringify({ base: BASE, label: LABEL, at: new Date().toISOString(), results }, null, 2));
  const tally = results.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  console.log('TALLY', JSON.stringify(tally));
})();
