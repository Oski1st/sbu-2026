// Render official pages in a normal headless Chrome (no stealth / no challenge bypass) and dump visible text.
const { chromium } = require('playwright');
const fs = require('fs');
const out = process.argv[2];
const urls = process.argv.slice(3);
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  for (const [i, u] of urls.entries()) {
    let status = null, text = '', title = '', err = null;
    try {
      const r = await p.goto(u, { waitUntil: 'networkidle', timeout: 45000 });
      status = r && r.status();
      await p.waitForTimeout(3000);
      title = await p.title();
      text = await p.evaluate(() => document.body.innerText);
    } catch (e) { err = String(e).slice(0, 300); }
    fs.writeFileSync(`${out}/render-${i}.txt`, `URL ${u}\nFETCHED ${new Date().toISOString()}\nSTATUS ${status}\nTITLE ${title}\nERR ${err}\n\n${text}`);
    console.log(i, u, status, title, err, text.length);
  }
  await b.close();
})();
