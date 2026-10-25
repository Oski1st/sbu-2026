import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const pw = require('playwright');
const engine = process.argv[2]; const out = process.argv[3];
const b = engine === 'chrome' ? await pw.chromium.launch({ channel: 'chrome' }) : await pw.webkit.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await p.goto('http://127.0.0.1:5174/?date=2026-11-15&time=17%3A30');
await p.locator('.swap-button').focus();
for (const [key, id] of [['Shift+Tab', 'origin'], ['Tab', 'swap'], ['Tab', 'destination']]) {
  await p.keyboard.press(key); await p.waitForTimeout(400);
  const s = await p.evaluate(() => { const el = document.activeElement, c = getComputedStyle(el); return { id: el.id || el.className, fv: el.matches(':focus-visible'), outline: `${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor} off ${c.outlineOffset}`, border: `${c.borderStyle} ${c.borderWidth} ${c.borderColor}`, shadow: c.boxShadow.slice(0, 90) }; });
  console.log(key, JSON.stringify(s));
  if (id !== 'swap') await p.locator('.location-field').filter({ has: p.locator('#' + id) }).screenshot({ path: `${out}/p5-02-${engine}-focus-${id}-keyboard.png` });
}
await b.close();
