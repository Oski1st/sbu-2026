// P5d QA of PR #50 (map network extent). Rendered-DOM geometry + screenshots of the "Amtrak corridors" map.
// Usage: node qa/p5d-mapfix-check.cjs <baseURL> <label> <geometry.json> <outDir>
// Checks (SVG user units, viewBox 0 0 800 420):
//   extent: no drawn route vertex west of min(CLT,TPA).x, north of POR.y, or (north of NYP) west of ALB.x
//   edges : (fix only, routes carry `edges`) each path starts/ends at a station of its two cities
//   dots  : every Amtrak station marker distance to nearest drawn route segment (report max)
//   lirr  : hollow ring + white hole + dashed link from NYP to Stony Brook
//   page  : no horizontal overflow, no console errors
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, label, geomFile, out] = process.argv.slice(2);
const geometry = JSON.parse(fs.readFileSync(geomFile, "utf8"));
fs.mkdirSync(out, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} [${label}] ${n}${d ? " — " + d : ""}`); };
const parse = (d) => [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
const seg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const TOL = 0.5; // SVG units for endpoints/extent (~2.2 km)
const DOT_TOL = 1.0; // SVG units for marker-on-line (<= ~1.5 CSS px at 1440, well inside the 3.25 px marker radius)
(async () => {
  const b = await chromium.launch();
  for (const w of [1440, 390, 320]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, isMobile: w < 640, hasTouch: w < 640 });
    const p = await ctx.newPage();
    const errors = [];
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(base + "/", { waitUntil: "networkidle" });
    await p.waitForSelector(".passenger-rail-map svg");
    const dom = await p.evaluate(() => {
      const svg = document.querySelector(".passenger-rail-map svg");
      const routes = [...svg.querySelectorAll(".prm-routes > g")].map((g) => ({ id: g.dataset.routeId, title: g.querySelector("title")?.textContent, paths: [...g.querySelectorAll("path")].map((q) => q.getAttribute("d")) }));
      const stations = [...svg.querySelectorAll(".prm-station")].map((g) => ({ code: g.dataset.stationCode, d: g.querySelector(".prm-station-dot").getAttribute("d") }));
      const l = svg.querySelector(".prm-lirr");
      const cs = (sel) => { const e = l?.querySelector(sel); if (!e) return null; const s = getComputedStyle(e); return { d: e.getAttribute("d"), stroke: s.stroke, width: s.strokeWidth, dash: s.strokeDasharray, fill: s.fill, cap: s.strokeLinecap }; };
      const lirr = l ? { code: l.dataset.stationCode, link: cs(".prm-lirr-link"), ring: cs(".prm-lirr-ring"), hole: cs(".prm-lirr-hole"), title: l.querySelector("title")?.textContent } : null;
      const legend = [...document.querySelectorAll(".prm-legend li")].map((li) => li.textContent);
      const map = document.querySelector(".passenger-rail-map").getBoundingClientRect();
      return { viewBox: svg.getAttribute("viewBox"), routes, stations, lirr, legend, overflow: document.documentElement.scrollWidth - innerWidth, mapRight: map.right, vw: innerWidth };
    });
    await p.locator(".passenger-rail-map .prm-frame").screenshot({ path: `${out}/${label}-${w}-map.png` });
    if (w === 1440) {
      // 3x zoom of the east-coast network so line ends and markers are inspectable.
      const box = await p.locator(".passenger-rail-map svg").boundingBox();
      const sx = box.width / 800, sy = box.height / 420;
      await p.screenshot({ path: `${out}/${label}-1440-zoom-ne.png`, clip: { x: box.x + 555 * sx, y: box.y + 90 * sy, width: 120 * sx, height: 300 * sy } });
    }
    const st = Object.fromEntries(dom.stations.map((s) => [s.code, parse(s.d)[0]]));
    const allPaths = dom.routes.flatMap((r) => r.paths.map(parse));
    const verts = allPaths.flat();
    const nPaths = allPaths.length;
    check(`${w}px route groups/paths`, true, `${dom.routes.length} groups, ${nPaths} paths, ${verts.length} vertices, ${dom.stations.length} station markers`);
    // DOM == data
    const same = JSON.stringify(dom.routes.map((r) => r.paths)) === JSON.stringify(geometry.routes.map((r) => r.paths));
    check(`${w}px rendered paths equal geometry.json`, same);
    // extent
    const westLimit = Math.min(st.CLT[0], st.TPA[0]) - TOL, northLimit = st.POR[1] - TOL;
    const west = verts.filter((v) => v[0] < westLimit), north = verts.filter((v) => v[1] < northLimit);
    const upstate = verts.filter((v) => v[1] < st.NYP[1] && v[0] < st.ALB[0] - TOL);
    const minX = Math.min(...verts.map((v) => v[0])), minY = Math.min(...verts.map((v) => v[1]));
    // SVG x is not longitude (Albers rotates meridians): vertices on an interior edge between two network cities
    // (e.g. Savannah-Jacksonville via Jesup, GA) can sit a little left of Tampa's x while being real in-network track.
    // Only vertices on paths that are NOT verified station-to-station network edges count as "beyond the network".
    const westBeyond = geometry.routes[0].edges ? west.filter((v) => !geometry.routes.some((r, ri) => r.edges.some(([a, z], i) => parse(dom.routes[ri].paths[i]).some((q) => q[0] === v[0] && q[1] === v[1]) && ![a, z].includes("charlotte") && ![a, z].includes("tampa")))) : west;
    const westEdges = geometry.routes[0].edges ? [...new Set(west.flatMap((v) => geometry.routes.flatMap((r, ri) => r.edges.filter((e, i) => parse(dom.routes[ri].paths[i]).some((q) => q[0] === v[0] && q[1] === v[1])).map((e) => e.join("-")))))] : [];
    check(`${w}px nothing west of Charlotte/Tampa beyond the network`, westBeyond.length === 0, `min x ${minX.toFixed(2)} vs CLT ${st.CLT[0]} / TPA ${st.TPA[0]}; ${west.length} vertices left of limit${westEdges.length ? " (all on interior edge " + westEdges.join(", ") + ")" : ""}; ${westBeyond.length} beyond network`);
    check(`${w}px nothing north of Portland ME`, north.length === 0, `min y ${minY.toFixed(2)} vs POR ${st.POR[1]}; ${north.length} vertices beyond`);
    check(`${w}px nothing west of Albany (north of NYC)`, upstate.length === 0, `${upstate.length} vertices west of ALB x ${st.ALB[0]}`);
    // edges station-to-station
    if (geometry.routes[0].edges) {
      const codesOf = Object.fromEntries([...new Set(geometry.stations.map((s) => s.cityId))].map((c) => [c, geometry.stations.filter((s) => s.cityId === c).map((s) => s.code)]));
      const near = (pt, city) => Math.min(...codesOf[city].map((c) => Math.hypot(pt[0] - st[c][0], pt[1] - st[c][1])));
      let maxEnd = 0, bad = [], n = 0;
      geometry.routes.forEach((r, ri) => r.edges.forEach(([a, z], i) => {
        n++;
        const pts = parse(dom.routes[ri].paths[i]);
        const e = Math.max(Math.min(near(pts[0], a), near(pts[0], z)), Math.min(near(pts.at(-1), a), near(pts.at(-1), z)));
        const both = Math.max(near(pts[0], a), near(pts.at(-1), z)) <= TOL || Math.max(near(pts[0], z), near(pts.at(-1), a)) <= TOL;
        maxEnd = Math.max(maxEnd, e);
        if (!both) bad.push(`${a}-${z}(${e.toFixed(2)})`);
      }));
      check(`${w}px all ${n} Amtrak city pairs drawn station-to-station`, n === 22 && bad.length === 0 && nPaths === 22, `max endpoint-to-station ${maxEnd.toFixed(3)} units${bad.length ? "; bad " + bad.join(" ") : ""}`);
    }
    // dots on lines
    const dots = Object.entries(st).map(([code, pt]) => {
      let m = Infinity;
      for (const poly of allPaths) for (let j = 1; j < poly.length; j++) m = Math.min(m, seg(pt, poly[j - 1], poly[j]));
      return [code, m];
    }).sort((x, y) => y[1] - x[1]);
    const pxPerUnit = await p.evaluate(() => document.querySelector(".passenger-rail-map svg").getScreenCTM().a);
    check(`${w}px every station marker on a drawn line (<= ${DOT_TOL} units)`, dots[0][1] <= DOT_TOL, `top: ${dots.slice(0, 3).map(([c, m]) => `${c} ${m.toFixed(3)}u=${(m * pxPerUnit).toFixed(2)}px`).join(", ")}`);
    // LIRR
    if (dom.lirr) {
      const link = parse(dom.lirr.link.d), ring = parse(dom.lirr.ring.d)[0];
      const fromNy = Math.hypot(link[0][0] - st.NYP[0], link[0][1] - st.NYP[1]) < 0.01 && Math.hypot(link[1][0] - ring[0], link[1][1] - ring[1]) < 0.01;
      check(`${w}px Stony Brook hollow blue LIRR marker + dashed NY link`,
        dom.lirr.ring.stroke === "rgb(31, 95, 139)" && dom.lirr.hole.stroke === "rgb(255, 255, 255)" && dom.lirr.link.dash !== "none" && fromNy
          // ring/hole are zero-length "M x,y h0" paths: with a butt cap they paint nothing.
          && dom.lirr.ring.cap !== "butt" && dom.lirr.hole.cap !== "butt",
        `ring ${dom.lirr.ring.stroke} w${dom.lirr.ring.width} cap=${dom.lirr.ring.cap}, hole ${dom.lirr.hole.cap} ${dom.lirr.hole.stroke} w${dom.lirr.hole.width}, link dash "${dom.lirr.link.dash}" ${dom.lirr.link.stroke}, NY->(${ring}) ${fromNy}`);
    } else check(`${w}px Stony Brook LIRR marker`, false, "absent");
    check(`${w}px no horizontal overflow`, dom.overflow <= 0 && dom.mapRight <= dom.vw, `overflow ${dom.overflow}, map right ${dom.mapRight.toFixed(1)}/${dom.vw}`);
    check(`${w}px no console errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
    if (w === 1440) console.log(`  legend: ${dom.legend.join(" / ")}`);
    await ctx.close();
  }
  await b.close();
  console.log(`[${label}] ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
