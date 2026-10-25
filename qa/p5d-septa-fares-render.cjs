// Normal headless Chrome; read the Regional Rail fare tab content from septa.org/fares (no bypass).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage();
  await p.goto('https://www.septa.org/fares/#tab-regionalrail', { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(2000);
  const t = await p.evaluate(() => {
    const el = document.body;
    return el ? el.textContent.replace(/\s+/g, ' ') : 'NO TAB ELEMENT; ids=' + [...document.querySelectorAll('[id]')].map(e => e.id).filter(i => /tab/i.test(i)).join(',');
  });
  fs.writeFileSync(process.argv[2], `URL https://www.septa.org/fares/#tab-regionalrail\nFETCHED ${new Date().toISOString()}\n\n${t}`);
  console.log(t.slice(0, 4000));
  await b.close();
})();
