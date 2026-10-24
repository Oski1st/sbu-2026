// P4-15: geographic-only full-US overview map (PR #22). Plan section E.
// Usage: node qa/p4-15-map-check.cjs <baseURL> <shotDir> <path/to/usOverviewMap.json>
// The JSON (from the tested checkout) names each rendered state path, in DOM order.
const { chromium } = require("playwright");
const fs = require("node:fs");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const shots = process.argv[3] ?? "qa-results/p4-15";
const data = JSON.parse(fs.readFileSync(process.argv[4] ?? "src/data/usOverviewMap.json", "utf8"));
const names = data.contiguous.map((s) => s.name);
fs.mkdirSync(shots, { recursive: true });
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
const TERRITORIES = /Puerto Rico|Guam|Virgin Islands|American Samoa|Northern Mariana/i;

(async () => {
  log("Data: 48 states + DC in the contiguous set, plus Alaska and Hawaii insets", names.length === 49 && names.includes("District of Columbia") && data.alaska?.length === 1 && data.hawaii?.length === 1, `${names.length} contiguous`);
  log("Data: source and projection documented; no territory entries", /Natural Earth/.test(data.source ?? "") && /Albers/.test(data.projection ?? "") && !TERRITORIES.test(JSON.stringify(Object.keys(data)) + names.join(",")), data.source);

  const browser = await chromium.launch();
  const errors = [];
  for (const width of [1280, 390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${width} ${e.message}`));
    page.on("console", (m) => m.type() === "error" && !m.location()?.url?.includes("/api/transit/septa/") && errors.push(`${width} ${m.text()}`));
    const external = [];
    page.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) external.push(r.url()); });
    await page.goto(base + "/");
    await page.waitForTimeout(700);
    const map = page.locator(".nationwide-map");
    const info = await map.evaluate((m, names) => {
      const svg = m.querySelector("svg");
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
      const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height }; };
      const states = {};
      [...svg.querySelectorAll(".us-map-states path")].forEach((p, i) => { states[names[i] ?? `#${i}`] = box(p); });
      const insets = {};
      for (const k of ["alaska", "hawaii"]) {
        const g = svg.querySelector(`.us-map-inset--${k}`);
        insets[k] = g ? { rect: box(g.querySelector("rect")), shape: box(g.querySelector("path")), text: [...g.querySelectorAll("text")].map((t) => t.textContent.trim()) } : null;
      }
      const texts = [...svg.querySelectorAll("text")].filter(vis).map((t) => ({ text: t.textContent.trim(), px: parseFloat(getComputedStyle(t).fontSize) * scale, ...box(t) }));
      const legend = m.parentElement.querySelector(".map-city-legend");
      const maskInfo = (() => {
        const mask = getComputedStyle(m).maskImage || "none";
        if (mask === "none" || !legend) return null;
        const lr = legend.getBoundingClientRect(), r = m.getBoundingClientRect();
        return { overlapsBox: lr.top < r.bottom && lr.bottom > r.top };
      })();
      return {
        scale, states, insets, texts, mapBox: box(m),
        role: m.getAttribute("role"), label: m.getAttribute("aria-label") ?? "", describedBy: m.getAttribute("aria-describedby"),
        svgHidden: svg.getAttribute("aria-hidden"),
        legend: legend && vis(legend) ? { id: legend.id, text: legend.textContent.trim(), px: parseFloat(getComputedStyle(legend).fontSize), ...box(legend) } : null,
        maskInfo,
        dashed: [...svg.querySelectorAll("*")].filter((e) => (e.getAttribute("stroke-dasharray") || getComputedStyle(e).strokeDasharray) && (e.getAttribute("stroke-dasharray") || getComputedStyle(e).strokeDasharray) !== "none").length,
        lines: svg.querySelectorAll("line, polyline").length,
        markers: [...svg.querySelectorAll("circle")].filter((c) => !c.closest("pattern, defs")).length,
        allText: m.parentElement.innerText,
      };
    }, names);

    const S = info.states;
    // Recognisable geography: west-to-east and north-to-south relationships between well-known states.
    const westEast = ["California", "Colorado", "Kansas", "Missouri", "Ohio", "Pennsylvania", "New Jersey"].every((n, i, a) => i === 0 || S[n].cx > S[a[i - 1]].cx);
    const northSouth = [["Washington", "California"], ["North Dakota", "Texas"], ["Michigan", "Alabama"], ["Maine", "Florida"], ["New York", "Georgia"]].every(([n, s]) => S[n].cy < S[s].cy);
    const maineNE = S["Maine"].cx > S["Vermont"].cx && S["Maine"].t <= Math.min(...Object.values(S).filter((b, i) => names[i] !== "Maine").map((b) => b.t)) + 40;
    const floridaSE = S["Florida"].b >= Math.max(S["Georgia"].b, S["Alabama"].b) && S["Florida"].cx > S["Louisiana"].cx;
    log(`${width}px: geography recognisable (west→east, north→south, Maine NE, Florida SE)`, westEast && northSouth && maineNE && floridaSE, `W→E ${westEast} N→S ${northSouth} ME ${maineNE} FL ${floridaSE}`);
    const all = Object.values(S);
    const span = { w: Math.max(...all.map((b) => b.r)) - Math.min(...all.map((b) => b.l)), h: Math.max(...all.map((b) => b.b)) - Math.min(...all.map((b) => b.t)) };
    const ratio = span.w / span.h;
    log(`${width}px: contiguous US aspect ratio plausible for Albers (1.4–1.9)`, ratio > 1.4 && ratio < 1.9, ratio.toFixed(2));

    const A = info.insets.alaska, H = info.insets.hawaii;
    log(`${width}px: Alaska and Hawaii insets present and labelled`, A && H && A.text.includes("ALASKA") && H.text.includes("HAWAII"), `${A?.text.join(" / ")} | ${H?.text.join(" / ")}`);
    const notToScale = (t) => t.some((x) => /not to scale/i.test(x));
    log(`${width}px: Alaska inset says not to scale`, A && notToScale(A.text));
    log(`${width}px: Hawaii inset says it is an inset (note: wording "geographic inset"; "not to scale" absent)`, H && H.text.some((x) => /inset/i.test(x)), H?.text.join(" / "));
    const inside = (s, r) => s.l >= r.l - 1 && s.r <= r.r + 1 && s.t >= r.t - 1 && s.b <= r.b + 1;
    log(`${width}px: inset shapes sit inside their frames`, A && H && inside(A.shape, A.rect) && inside(H.shape, H.rect));
    const intrude = [];
    for (const [k, v] of Object.entries(info.insets)) for (const [n, b] of Object.entries(S)) {
      if (Math.min(b.r, v.rect.r) - Math.max(b.l, v.rect.l) > 2 && Math.min(b.b, v.rect.b) - Math.max(b.t, v.rect.t) > 2) intrude.push(`${k}×${n}`);
    }
    log(`${width}px: insets don't overlap contiguous-state bounding boxes`, intrude.length === 0, intrude.join(", "));

    const floor = width < 500 ? 11 : 10;
    const small = info.texts.filter((t) => t.px < floor);
    log(`${width}px: every visible map text ≥${floor}px rendered`, small.length === 0, info.texts.map((t) => `${t.text.slice(0, 22)} ${t.px.toFixed(1)}px`).join("; "));
    const clipped = info.texts.filter((t) => t.l < info.mapBox.l - 1 || t.r > info.mapBox.r + 1 || t.t < info.mapBox.t - 1 || t.b > info.mapBox.b + 1);
    log(`${width}px: map text inside the map box`, clipped.length === 0, clipped.map((t) => t.text).join(", "));
    const over = [];
    for (let i = 0; i < info.texts.length; i++) for (let j = i + 1; j < info.texts.length; j++) {
      const a = info.texts[i], b = info.texts[j];
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 4 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 4) over.push(`${a.text}×${b.text}`);
    }
    log(`${width}px: map texts don't overlap`, over.length === 0, over.join(", "));

    const L = info.legend;
    log(`${width}px: visible disclosure (geographic only, no nationwide connections), ≥11px`, L && /geographic overview only/i.test(L.text) && /no nationwide connections are implied/i.test(L.text) && L.px >= 11, L ? `${L.px}px` : "no visible legend");
    log(`${width}px: disclosure outside any mask fade`, !info.maskInfo || !info.maskInfo.overlapsBox, info.maskInfo ? JSON.stringify(info.maskInfo) : "no mask on map");
    log(`${width}px: accessibility (role=img, name says not a route/schedule/coverage map, described by the visible note, SVG hidden)`,
      info.role === "img" && /not a route, schedule, or service-coverage map/i.test(info.label) && L && info.describedBy === L.id && info.svgHidden === "true", info.label.slice(0, 80));
    log(`${width}px: geographic only (no dashed lines, line elements or markers)`, info.dashed === 0 && info.lines === 0 && info.markers === 0, `dashed ${info.dashed}, lines ${info.lines}, markers ${info.markers}`);
    log(`${width}px: no territory implied`, !TERRITORIES.test(info.allText + info.label));
    log(`${width}px: no horizontal page overflow`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
    log(`${width}px: no external network requests`, external.length === 0, external.slice(0, 3).join(", "));
    await page.locator(".nationwide-map-wrap").screenshot({ path: `${shots}/national-map-${width}.png` });
    await ctx.close();
  }
  await browser.close();
  log("No page or console errors", errors.length === 0, errors.slice(0, 4).join(" ; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} P4-15 map checks passed`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
