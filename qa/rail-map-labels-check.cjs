// Usage: node qa/rail-map-labels-check.cjs <baseURL>
// Rail map label layout: measures label boxes vs frame, label/label overlap, and dot/label overlap
const { chromium } = require("playwright");
const [base] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const w of [1280, 1024, 900, 768, 640, 390, 375, 360, 320]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    await p.goto(base + "/"); await p.waitForSelector(".passenger-rail-map svg");
    const r = await p.evaluate(() => {
      const f = document.querySelector(".passenger-rail-map .prm-frame").getBoundingClientRect();
      const labels = [...document.querySelectorAll(".prm-label")].filter((l) => getComputedStyle(l).display !== "none").map((l) => { const b = l.getBoundingClientRect(); return { t: l.textContent, l: b.left, r: b.right, top: b.top, bot: b.bottom, fs: getComputedStyle(l).fontSize }; });
      const dots = [...document.querySelectorAll(".prm-station-dot")].map((d) => { const b = d.getBoundingClientRect(); return { rad: parseFloat(getComputedStyle(d.parentElement.querySelector(".prm-station-halo")).strokeWidth) / 2, code: d.parentElement.dataset.stationCode, x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2, size: b.width }; });
      const issues = [];
      for (const a of labels) {
        if (a.l < f.left - 0.5 || a.r > f.right + 0.5 || a.top < f.top || a.bot > f.bottom) issues.push(`${a.t} outside frame (${a.l.toFixed(1)}-${a.r.toFixed(1)} vs ${f.left.toFixed(1)}-${f.right.toFixed(1)})`);
        for (const c of labels) if (a !== c && a.t < c.t && a.l < c.r && c.l < a.r && a.top < c.bot && c.top < a.bot) issues.push(`${a.t} overlaps ${c.t}`);
        for (const d of dots) if (d.x + d.rad > a.l && d.x - d.rad < a.r && d.y + d.rad > a.top && d.y - d.rad < a.bot) issues.push(`${a.t} covers dot ${d.code}`);
      }
      return { frameW: f.width, labels: labels.map((a) => `${a.t}:${(a.r - a.l).toFixed(0)}px/${a.fs}`).join(" "), dot: dots[0]?.size, issues };
    });
    bad += r.issues.length;
    console.log(w, `frame=${r.frameW.toFixed(0)} dotBox=${r.dot?.toFixed(1)}`, r.labels, r.issues.length ? "ISSUES: " + r.issues.join("; ") : "ok");
    await p.close();
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
