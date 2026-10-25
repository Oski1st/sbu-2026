// Is the Stony Brook LIRR hollow marker actually painted? Zero-length "M x,y h0" paths only paint with a
// round/square line cap. Compares the shipped CSS with a one-rule override (.prm-lirr path {stroke-linecap:round}).
// Usage: node qa/p5d-lirr-marker-check.cjs <baseURL> <outDir>
const { chromium } = require("playwright");
const [base, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  for (const [w, dpr] of [[1440, 8], [390, 8], [320, 8]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: dpr })).newPage();
    await p.goto(base + "/", { waitUntil: "networkidle" });
    for (const variant of ["shipped", "linecap-round"]) {
      if (variant !== "shipped") await p.addStyleTag({ content: ".passenger-rail-map .prm-lirr path { stroke-linecap: round; }" });
      const info = await p.evaluate(() => {
        const svg = document.querySelector(".passenger-rail-map svg"), m = svg.getScreenCTM();
        const ring = document.querySelector(".prm-lirr-ring");
        const [x, y] = ring.getAttribute("d").slice(1).split("h")[0].split(",").map(Number);
        // Sample the painted colour of the ring centre via elementFromPoint is not possible for strokes; return geometry only.
        return { cx: m.a * x + m.e, cy: m.d * y + m.f, unit: m.a, cap: getComputedStyle(ring).strokeLinecap };
      });
      const r = 9;
      await p.screenshot({ path: `${out}/lirr-${variant}-${w}.png`, clip: { x: info.cx - r * 2, y: info.cy - r, width: r * 3, height: r * 2 } });
      console.log(`${w}px ${variant}: ring cap=${info.cap}, centre (${info.cx.toFixed(1)},${info.cy.toFixed(1)}) css px, ${info.unit.toFixed(3)} px/unit`);
    }
  }
  await b.close();
})();
