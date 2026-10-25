// Tab through every focusable element on several pages; for each focused element with a CSS outline,
// sample the rendered screenshot at the ring centre (actual drawn colour) and just outside / inside the ring
// (the adjacent colours the ring sits on). Reports contrast of the computed outline colour vs adjacent pixels.
// Usage: node ring-sweep.cjs <base> <outJson>
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, out] = [process.argv[2], process.argv[3]];
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const PAGES = ["/#compare", "/#dialog", "/", "/search?from=philadelphia&to=new-york", "/journey/regional-connection", "/wallet/regional-connection", "/wallet/amtrak-connection", "/journey/bogus"];
(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const width of [1280, 390]) for (const p of PAGES) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })).newPage();
    await page.goto(base + p.replace(/#.*/, "")); await page.waitForTimeout(1500);
    if (p.includes("#")) { // compare tray (dark surface) and comparison dialog
      const checks = page.locator(".compare-route-check input[type=checkbox]");
      await checks.nth(0).check(); await checks.nth(1).check();
      if (p === "/#dialog") { await page.locator(".compare-tray-action").focus(); await page.keyboard.press("Enter"); await page.locator("dialog.comparison-dialog[open]").waitFor(); await page.waitForTimeout(400); }
      else { await page.locator(".compare-tray-action").focus(); await page.keyboard.press("Shift+Tab"); }
    } else await page.evaluate(() => document.body.focus());
    let first = null, prev = null;
    const seen = new Set();
    for (let k = 0; k < 160; k++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(60);
      const info = await page.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        e.scrollIntoView({ block: "center", inline: "nearest" });
        const s = getComputedStyle(e); const r = e.getBoundingClientRect();
        const id = (e.tagName + "#" + (e.id || "") + "." + (typeof e.className === "string" ? e.className.split(" ").slice(0, 3).join(".") : "") + " " + (e.getAttribute("aria-label") || e.innerText || e.value || "").trim().slice(0, 30)).replace(/\s+/g, " ");
        return { id, fv: e.matches(":focus-visible"), style: s.outlineStyle, w: parseFloat(s.outlineWidth), off: parseFloat(s.outlineOffset), color: s.outlineColor, shadow: s.boxShadow, r: { x: r.x, y: r.y, w: r.width, h: r.height }, path: location.pathname };
      });
      if (!info) continue;
      const key = info.id + info.r.w;
      if (key === first) break; // wrapped round
      if (!first) first = key;
      if (key === prev) continue; // native date/time segments
      prev = key;
      if (seen.has(key)) continue;
      seen.add(key);
      await page.waitForTimeout(350); // transitions
      let info2 = null; // wait for smooth scrolling to settle
      for (let t = 0; t < 40; t++) { const r2 = await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }); if (info2 && JSON.stringify(r2) === JSON.stringify(info2)) break; info2 = r2; await page.waitForTimeout(100); }
      info.r = info2;
      const row = { width, page: p, ...info };
      if (info.style !== "none" && info.w > 0) {
        const shot = await page.screenshot();
        const res = await page.evaluate(async ([b64, r, w, off, color]) => {
          const img = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = "data:image/png;base64," + b64; });
          const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, img.width, img.height).data;
          const px = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= img.width || y >= img.height) return null; const i = (y * img.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
          const ring = (dist) => { const pts = []; const x0 = r.x - dist, y0 = r.y - dist, x1 = r.x + r.w + dist, y1 = r.y + r.h + dist;
            const corner = 10 + dist; // skip rounded corners
            for (let x = x0 + corner; x <= x1 - corner; x += 3) { pts.push(px(x, y0)); pts.push(px(x, y1 - 1)); }
            for (let y = y0 + corner; y <= y1 - corner; y += 3) { pts.push(px(x0, y)); pts.push(px(x1 - 1, y)); }
            return pts.filter(Boolean); };
          return { centre: ring(off + w / 2), outside: ring(off + w + 2), inside: off >= 2 ? ring(Math.max(off - 1, 0.5)) : [] };
        }, [shot.toString("base64"), info.r, info.w, info.off, info.color]);
        const oc = info.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
        const stat = (pts) => { if (!pts.length) return null; const cs = pts.map((q) => cr(oc, q)).sort((a, b) => a - b); const counts = {}; for (const q of pts) { const h = "#" + q.map((v) => v.toString(16).padStart(2, "0")).join(""); counts[h] = (counts[h] || 0) + 1; }
          const dom = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, n]) => `${h}x${n}`).join(" ");
          return { n: pts.length, min: cs[0], p10: cs[Math.floor(cs.length * 0.1)], median: cs[Math.floor(cs.length / 2)], pctBelow3: +(100 * cs.filter((c) => c < 3).length / cs.length).toFixed(1), dominant: dom }; };
        const centreMatch = res.centre.filter((q) => Math.max(...q.map((v, i) => Math.abs(v - oc[i]))) <= 8).length;
        row.drawn = { centrePts: res.centre.length, centreMatchingColour: centreMatch };
        row.outside = stat(res.outside); row.inside = stat(res.inside);
      }
      rows.push(row);
    }
    await page.close();
  }
  fs.writeFileSync(out, JSON.stringify(rows, null, 2));
  for (const r of rows) {
    if (r.style === "none" || !r.w) { console.log(`[${r.width} ${r.page}] ${r.id} fv=${r.fv} NO OUTLINE shadow=${r.shadow === "none" ? "none" : "yes"}`); continue; }
    console.log(`[${r.width} ${r.page}] ${r.id} fv=${r.fv} ${r.w}px off${r.off} ${r.color} drawn=${r.drawn.centreMatchingColour}/${r.drawn.centrePts} outside=${JSON.stringify(r.outside)} inside=${JSON.stringify(r.inside)}`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
