// P4-35: keyboard focus indicator measurement for Search form controls (and reference controls).
// Usage: node qa/p4-35-search-focus-check.cjs <baseURL> <outDir>
// For each control: reach it with real Tab presses (so :focus-visible applies), record computed outline/border/box-shadow,
// the effective adjacent background, WCAG contrast of each indicator colour vs adjacent background (SC 1.4.11 / 2.4.7),
// and a pixel diff of focused vs unfocused screenshots (SC 2.4.13 area/change-contrast method, AAA, advisory).
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, out] = [process.argv[2] || "http://127.0.0.1:4173", process.argv[3] || "p4-35-out"];
fs.mkdirSync(out, { recursive: true });
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const parse = (s) => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
const blend = (fg, bg) => fg.rgb.map((c, i) => Math.round(c * fg.a + bg[i] * (1 - fg.a)));
const CONTROLS = [
  { name: "From (#origin)", sel: "#origin" }, { name: "To (#destination)", sel: "#destination" },
  { name: "Date", sel: 'input[name="departure-date"]' }, { name: "Time", sel: 'input[name="departure-time"]' },
  { name: "Swap button (reference)", sel: ".search-form > button[type=button]" }, { name: "Find my way (reference)", sel: ".search-button" },
];
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })).newPage();
  await page.goto(base + "/"); await page.waitForSelector(".route-card");
  const rows = [];
  for (const c of CONTROLS) {
    const el = page.locator(c.sel).first();
    await el.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press("Escape").catch(() => {});
    const box = await el.boundingBox();
    const pad = 12;
    const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + 2 * pad, height: box.height + 2 * pad };
    await page.mouse.move(1, 1);
    await page.waitForTimeout(500);
    const unf = await page.screenshot({ clip });
    // reach by keyboard: focus the previous focusable element programmatically, then Tab
    await page.evaluate((sel) => {
      const t = document.querySelector(sel); const all = [...document.querySelectorAll("a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter((e) => e.offsetParent);
      const i = all.indexOf(t); (all[i - 1] || document.body).focus();
    }, c.sel);
    // Tab until the target itself is focused (native date/time inputs have internal segments that take Tab stops)
    for (let k = 0; k < 8; k++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate((sel) => document.activeElement === document.querySelector(sel), c.sel)) break;
    }
    await page.waitForTimeout(500); // let CSS transitions (Tailwind `transition`) finish before reading styles/pixels
    const st = await page.evaluate((sel) => {
      const e = document.querySelector(sel); const s = getComputedStyle(e);
      let bgEl = e.parentElement, bg = null; while (bgEl) { const b = getComputedStyle(bgEl).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { bg = b; break; } bgEl = bgEl.parentElement; }
      return { focused: document.activeElement === e, focusVisible: e.matches(":focus-visible"), outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, outlineColor: s.outlineColor, outlineWidth: parseFloat(s.outlineWidth), outlineStyle: s.outlineStyle, outlineOffset: s.outlineOffset,
        borderBottom: `${s.borderBottomStyle} ${s.borderBottomWidth} ${s.borderBottomColor}`, borderBottomColor: s.borderBottomColor, borderBottomWidth: parseFloat(s.borderBottomWidth), border: `${s.borderTopWidth} ${s.borderTopColor}`,
        boxShadow: s.boxShadow, ownBg: s.backgroundColor, adjacentBg: bg, adjacentBgEl: bgEl ? (bgEl.className || bgEl.tagName).toString().slice(0, 40) : null };
    }, c.sel);
    await page.mouse.move(1, 1);
    const foc = await page.screenshot({ clip });
    fs.writeFileSync(`${out}/${c.name.split(" ")[0].toLowerCase()}-focused.png`, foc);
    fs.writeFileSync(`${out}/${c.name.split(" ")[0].toLowerCase()}-unfocused.png`, unf);
    // pixel diff via canvas in the page
    const diff = await page.evaluate(async ([a, b, w, h]) => {
      const load = (d) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = "data:image/png;base64," + d; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const px = (img) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const x = cv.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
      const A = px(ia), B = px(ib); const changed = [];
      for (let i = 0; i < A.length; i += 4) if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) changed.push([[A[i], A[i + 1], A[i + 2]], [B[i], B[i + 1], B[i + 2]]]);
      return changed;
    }, [unf.toString("base64"), foc.toString("base64"), Math.round(clip.width), Math.round(clip.height)]);
    const pairs = diff.map(([u, f]) => cr(u, f));
    const changeOK = pairs.filter((v) => v >= 3).length;
    const perimeter2px = Math.round(2 * (box.width + box.height) * 2 - 16); // area of a 2px-thick perimeter of the unfocused box
    const adj = parse(st.adjacentBg)?.rgb || [255, 255, 255];
    const own = parse(st.ownBg); const ownRgb = own && own.a > 0 ? blend(own, adj) : adj;
    const ind = [];
    if (st.outlineStyle !== "none" && st.outlineWidth > 0) { const oc = parse(st.outlineColor); ind.push({ kind: `outline ${st.outlineWidth}px (offset ${st.outlineOffset})`, color: st.outlineColor, vsAdjacent: cr(blend(oc, adj), adj) }); }
    const bc = parse(st.borderBottomColor);
    if (st.borderBottomWidth > 0 && bc && bc.a > 0) ind.push({ kind: `border-bottom ${st.borderBottomWidth}px`, color: st.borderBottomColor, vsAdjacent: cr(blend(bc, adj), adj), vsOwnBg: cr(blend(bc, adj), ownRgb) });
    if (st.boxShadow && st.boxShadow !== "none") ind.push({ kind: "box-shadow", color: st.boxShadow });
    rows.push({ control: c.name, focused: st.focused, focusVisible: st.focusVisible, computed: { outline: st.outline, borderBottom: st.borderBottom, boxShadow: st.boxShadow, ownBg: st.ownBg, adjacentBg: `${st.adjacentBg} (${st.adjacentBgEl})` }, indicators: ind,
      pixelDiff: { changedPx: diff.length, changedPxWith3to1Change: changeOK, required2pxPerimeterArea: perimeter2px, maxChangeContrast: pairs.length ? Math.max(...pairs) : 0 } });
  }
  fs.writeFileSync(`${out}/p4-35-focus.json`, JSON.stringify(rows, null, 2));
  for (const r of rows) {
    console.log(`\n== ${r.control}: focused=${r.focused} :focus-visible=${r.focusVisible}`);
    console.log("   computed:", JSON.stringify(r.computed));
    for (const i of r.indicators) console.log("   indicator:", JSON.stringify(i));
    console.log("   pixel diff:", JSON.stringify(r.pixelDiff));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
