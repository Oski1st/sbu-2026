// P5D-QA38: verify each #38 fix against a running build (run against #38 and #33 baseline).
// Usage: node qa/p5d-qa38-fixes.cjs <baseUrl> <outDir> <label>
// Automated Chrome check, not a human test.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2];
const OUT = process.argv[3];
const LABEL = process.argv[4] || 'run';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const rec = (id, name, pass, observed) => { results.push({ id, name, result: pass ? 'PASS' : 'FAIL', observed }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} :: ${JSON.stringify(observed).slice(0, 300)}`); };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const newPage = async (w = 1280, h = 900) => { const c = await browser.newContext({ viewport: { width: w, height: h } }); return [c, await c.newPage()]; };

  // F1 typed 5-digit year is blocked
  {
    const [c, p] = await newPage();
    await p.goto(BASE + '/?from=Boston&to=Miami', { waitUntil: 'networkidle' });
    const date = p.locator('input[name=departure-date]');
    // click the left edge (month segment), then type MM DD YYYYY like a person would
    const box = await date.boundingBox();
    await p.mouse.click(box.x + 14, box.y + box.height / 2);
    await p.keyboard.type('01', { delay: 40 });
    await p.keyboard.type('01', { delay: 40 });
    await p.keyboard.type('20270', { delay: 40 });
    const before = p.url();
    const v = await date.evaluate(e => ({ value: e.value, max: e.max, min: e.min, rangeOverflow: e.validity.rangeOverflow, valid: e.validity.valid, msg: e.validationMessage }));
    await p.getByRole('button', { name: /find my way/i }).click();
    await p.waitForTimeout(600);
    const after = p.url();
    const urlDate = new URL(after).searchParams.get('date');
    const shownAfterSubmit = await date.inputValue();
    const msgAfterSubmit = await date.evaluate(e => e.validationMessage);
    await p.screenshot({ path: `${OUT}/${LABEL}-f1-5digit-year.png` });
    rec('F1', 'typing 01/01/20270 is blocked', v.rangeOverflow === true && !/20270/.test(after), { ...v, urlBefore: before.replace(BASE, ''), urlAfter: after.replace(BASE, ''), urlDate, shownAfterSubmit, msgAfterSubmit, urlAndFormAgree: urlDate === shownAfterSubmit });
    await c.close();
  }
  // F2 ?date=0050-06-01 keeps the year
  {
    const [c, p] = await newPage();
    await p.goto(BASE + '/?from=Boston&to=Miami&date=0050-06-01', { waitUntil: 'networkidle' });
    const v = await p.locator('input[name=departure-date]').inputValue();
    rec('F2', '?date=0050-06-01 keeps the year', v === '0050-06-01', { shown: v });
    await c.close();
  }
  // F3 no /favicon.ico 404
  {
    const [c, p] = await newPage();
    const fav = [];
    p.on('response', r => { if (/favicon/.test(r.url())) fav.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
    const consoleErr = [];
    p.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 160)); });
    for (const path of ['/', '/journey/amtrak-connection', '/wallet/regional-connection']) await p.goto(BASE + path, { waitUntil: 'networkidle' });
    const icon = await p.evaluate(() => document.querySelector('link[rel~=icon]')?.getAttribute('href')?.slice(0, 40) || null);
    rec('F3', 'no /favicon.ico 404', !fav.some(f => f.startsWith('404')) && !consoleErr.some(e => /404/.test(e)), { faviconResponses: fav, iconHref: icon, consoleErrors: consoleErr });
    await c.close();
  }
  // F4 SEPTA links go to www.septa.org
  {
    const [c, p] = await newPage();
    const hrefs = [];
    for (const path of ['/', '/journey/regional-connection', '/wallet/regional-connection']) {
      await p.goto(BASE + path, { waitUntil: 'networkidle' });
      await p.waitForTimeout(400);
      hrefs.push(...(await p.evaluate(() => [...document.querySelectorAll('a[href*="septa.org"]')].map(a => a.href))).map(h => `${path} -> ${h}`));
    }
    const bad = hrefs.filter(h => /wwww\./.test(h));
    rec('F4', 'SEPTA links go to www.septa.org', hrefs.length > 0 && bad.length === 0, { count: hrefs.length, unique: [...new Set(hrefs)], bad });
    await c.close();
  }
  // F5 Albany -> Boston fastest: Amtrak arriving 3:30 PM first
  {
    const [c, p] = await newPage();
    await p.goto(BASE + '/?from=Albany&to=Boston&sort=fastest', { waitUntil: 'networkidle' });
    const cards = await p.evaluate(() => [...document.querySelectorAll('#routes article')].map(a => a.innerText.replace(/\s+/g, ' ').slice(0, 260)));
    await p.screenshot({ path: `${OUT}/${LABEL}-f5-albany-boston-fastest.png`, fullPage: false });
    rec('F5', 'Albany->Boston fastest lists Amtrak (arrives 3:30 PM) first', /amtrak/i.test(cards[0] || '') && /3:30\s*PM/i.test(cards[0] || ''), { first: cards[0], second: cards[1], third: cards[2] });
    await c.close();
  }
  // F6 demo comparison says "35 minutes sooner"
  {
    const [c, p] = await newPage();
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    const checks = p.locator('.compare-route-check input');
    const n = await checks.count();
    for (let i = 0; i < Math.min(2, n); i++) await checks.nth(i).check();
    await p.getByRole('button', { name: /compare routes/i }).click();
    await p.waitForTimeout(500);
    const t = await p.locator('dialog.comparison-dialog').innerText();
    const m = t.match(/[^.\n]*(sooner|same time|same total journey time)[^.\n]*/i);
    await p.screenshot({ path: `${OUT}/${LABEL}-f6-demo-comparison.png` });
    rec('F6', 'demo comparison says "35 minutes sooner"', /35 minutes sooner/.test(t), { sentence: m && m[0] });
    await c.close();
  }
  // F7 Wallet SEPTA panel never shows "999 min" (mocked TrainView payload incl. 999 and '999')
  {
    const [c, p] = await newPage();
    const payload = [
      { trainno: '9001', line: 'Trenton', dest: 'Trenton', nextstop: 'Cornwells Heights', late: 999 },
      { trainno: '9002', line: 'Trenton', dest: 'Temple U', nextstop: 'Bristol', late: '999' },
      { trainno: '9003', line: 'Paoli/Thorndale', dest: 'Thorndale', nextstop: 'Ardmore', late: 4 },
    ];
    await p.route('**/api/transit/septa/trains**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
    await p.route('**/api.septa.org/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }));
    await p.goto(BASE + '/wallet/regional-connection', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const txt = await p.evaluate(() => document.body.innerText);
    const lines = txt.split('\n').filter(l => /Reported delay|Delay not reported|9001|9002|9003/.test(l));
    await p.screenshot({ path: `${OUT}/${LABEL}-f7-wallet-septa-999.png`, fullPage: true });
    rec('F7', 'Wallet SEPTA panel never shows "999 min"', !/999 min/.test(txt) && /Reported delay: 4 min/.test(txt), { lines });
    await c.close();
  }
  // F8 Wallet header reads "5h 15m"
  {
    const [c, p] = await newPage();
    await p.goto(BASE + '/wallet/regional-connection', { waitUntil: 'networkidle' });
    const h = await p.locator('.ol-header .ol-muted').first().innerText();
    rec('F8', 'Wallet header reads "5h 15m"', /5h 15m/.test(h), { header: h });
    await c.close();
  }
  // F9 "booking. Sample" has its space
  {
    const [c, p] = await newPage();
    await p.goto(BASE + '/?from=Boston&to=Miami', { waitUntil: 'networkidle' });
    await p.locator('.detail-toggle').first().click();
    await p.waitForTimeout(300);
    const t = await p.evaluate(() => [...document.querySelectorAll('.fare-disclaimer')].map(e => e.textContent));
    const joined = t.join(' || ');
    rec('F9', '"booking. Sample" has its space', t.length > 0 && /booking\. Sample/.test(joined) && !/booking\.Sample/.test(joined), { count: t.length, sample: (t[0] || '').slice(140, 230) });
    await c.close();
  }
  // F10 at 320px comparison shows "Unavailable" on one line
  {
    const [c, p] = await newPage(320, 740);
    await p.goto(BASE + '/?from=Boston&to=Miami', { waitUntil: 'networkidle' });
    const checks = p.locator('.compare-route-check input');
    for (let i = 0; i < 2; i++) await checks.nth(i).check();
    await p.getByRole('button', { name: /compare routes/i }).click();
    await p.waitForTimeout(500);
    const cells = await p.evaluate(() => [...document.querySelectorAll('dialog.comparison-dialog td strong')].filter(s => /Unavailable/.test(s.textContent)).map(s => {
      const r = document.createRange(); r.selectNodeContents(s);
      const tops = new Set([...r.getClientRects()].map(x => Math.round(x.top)));
      return { text: s.textContent, lines: tops.size, width: Math.round(s.getBoundingClientRect().width), fontSize: getComputedStyle(s).fontSize };
    }));
    const overflow = await p.evaluate(() => { const d = document.querySelector('dialog.comparison-dialog'); return d ? d.scrollWidth - d.clientWidth : null; });
    await p.locator('dialog.comparison-dialog').screenshot({ path: `${OUT}/${LABEL}-f10-320-unavailable.png` }).catch(() => p.screenshot({ path: `${OUT}/${LABEL}-f10-320-unavailable.png` }));
    rec('F10', 'at 320px comparison shows "Unavailable" on one line', cells.length > 0 && cells.every(x => x.lines === 1), { cells, dialogHorizontalOverflowPx: overflow });
    await c.close();
  }
  // F11 /journey with no trip shows new preview notice
  {
    const [c, p] = await newPage();
    await p.goto(BASE + '/journey', { waitUntil: 'networkidle' });
    const t = await p.evaluate(() => document.querySelector('.integration-notice')?.textContent?.trim() || document.body.innerText.slice(0, 300));
    rec('F11', '/journey (no trip) shows "Journey preview · Choose this route on Search…" and not "being built"', /Choose this route on Search/.test(t) && !/being built/.test(t), { notice: t });
    await c.close();
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/${LABEL}-fixes.json`, JSON.stringify({ base: BASE, label: LABEL, at: new Date().toISOString(), results }, null, 2));
  console.log(`TOTAL ${results.filter(r => r.result === 'PASS').length}/${results.length} PASS`);
})();
