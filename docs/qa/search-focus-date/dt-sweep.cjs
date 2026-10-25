// Sweep date/time input layout across widths. Usage: node dt-sweep.cjs <base> [shotDir]
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, shots] = [process.argv[2], process.argv[3]];
if (shots) fs.mkdirSync(shots, { recursive: true });
const widths = []; for (let w = 320; w <= 400; w += 5) widths.push(w); widths.push(361, 389, 414, 480, 640, 768, 1024, 1280);
(async () => {
  const browser = await chromium.launch(); let bad = 0;
  for (const w of widths.sort((a, b) => a - b)) {
    const p = await (await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: w < 640, hasTouch: w < 640, locale: "en-US" })).newPage();
    await p.goto(base + "/?date=2026-10-24&time=08:00"); await p.waitForSelector(".route-card");
    const d = await p.locator('input[name="departure-date"]').boundingBox();
    const t = await p.locator('input[name="departure-time"]').boundingBox();
    const c = await p.locator(".date-time-controls").boundingBox();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const stacked = t.y > d.y + d.height - 1;
    const ok = d.width >= 136 && t.width >= 136 && d.x + d.width <= w && t.x + t.width <= w && !overflow;
    if (!ok) bad++;
    console.log(`${ok ? "OK  " : "BAD "} ${w}px container=${c.width.toFixed(0)} ${stacked ? "stacked" : "side-by-side"} date=${d.width.toFixed(0)} time=${t.width.toFixed(0)} overflow=${overflow}`);
    if (shots && [320, 361, 375, 390, 400, 640, 1280].includes(w)) await p.locator(".date-field").screenshot({ path: `${shots}/datetime-${w}.png` });
    await p.context().close();
  }
  console.log(`${bad} bad widths`); await browser.close();
})();
