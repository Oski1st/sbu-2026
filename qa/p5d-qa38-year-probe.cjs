// Probe how Chrome's date control handles typing a 5-digit year (records value after each keystroke).
const { chromium } = require('playwright');
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  for (const variant of ['MMDDYYYYY', 'year-segment-only', 'slashes']) {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await p.goto(BASE + '/?from=Boston&to=Miami', { waitUntil: 'networkidle' });
    const d = p.locator('input[name=departure-date]');
    const box = await d.boundingBox();
    const trace = [];
    const snap = async (k) => trace.push(`${k}=>${await d.evaluate(e => `${e.value}|ovf:${e.validity.rangeOverflow}|valid:${e.validity.valid}`)}`);
    if (variant === 'year-segment-only') {
      await p.mouse.click(box.x + 14, box.y + box.height / 2);
      await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); // month -> day -> year (Chrome moves segment with Tab? fallback ArrowRight)
      await snap('afterTab');
      for (const ch of '20270') { await p.keyboard.type(ch); await snap(ch); }
    } else {
      await p.mouse.click(box.x + 14, box.y + box.height / 2);
      const keys = variant === 'slashes' ? '01/01/20270' : '010120270';
      for (const ch of keys) { await p.keyboard.type(ch); await snap(ch); }
    }
    await p.getByRole('button', { name: /find my way/i }).click();
    await p.waitForTimeout(500);
    const msg = await d.evaluate(e => e.validationMessage);
    console.log(JSON.stringify({ base: BASE, variant, trace, validationMessage: msg, url: p.url().replace(BASE, '') }));
    await p.context().close();
  }
  await b.close();
})();
