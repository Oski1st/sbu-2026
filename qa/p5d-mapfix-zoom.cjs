// High-zoom crops of the rail map (SVG viewBox regions) for visual inspection.
// Usage: node qa/p5d-mapfix-zoom.cjs <baseURL> <label> <outDir>
const { chromium } = require("playwright");
const [base, label, out] = process.argv.slice(2);
const regions = { ny: [625, 115, 45, 50], florida: [565, 330, 50, 55], carolinas: [570, 200, 45, 85] };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 8 })).newPage();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  const box = await p.locator(".passenger-rail-map svg").boundingBox();
  const s = box.width / 800;
  for (const [name, [x, y, w, h]] of Object.entries(regions)) {
    await p.screenshot({ path: `${out}/${label}-zoom-${name}.png`, clip: { x: box.x + x * s, y: box.y + y * s, width: w * s, height: h * s } });
  }
  await b.close();
})();
