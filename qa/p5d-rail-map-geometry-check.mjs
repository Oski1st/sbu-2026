// P5d adaptation of qa/rail-map-geometry-check.mjs (origin/fix/rail-map-polish) for PR #50, where routes are
// per-network-edge shortest-track paths (no objectId / part correspondence any more).
// Usage: copy into <checkout>/qa/ and run: node qa/p5d-rail-map-geometry-check.mjs
// Checks, in SVG units, with the independently re-implemented projection below:
//   B. drawn -> source: every drawn vertex is a projected vertex of an audited NTAD route (<= rounding 0.0071; no new points)
//   S. every drawn segment stays within DP tolerance 0.12 + rounding of the audited source track (no straight connectors)
//   E. each path's ends sit at the two network cities' stations (<= 0.8, the builder's attach radius)
//   T. station dots sit on their source coordinates; LIRR marker sits on its cited lon/lat
// Original header follows (sections A-C below are replaced).
// Independent geometry check (P4-36 protocol row M6) for the CONUS passenger-rail map.
//
// Deliberately does NOT import build.mjs or mapProjection.ts: the Albers equal-area projection
// (standard parallels 29.5/45.5, origin 38N 96W) and the uniform fit to the 49 state outlines in
// the {x:22,y:26,w:748,h:372} frame are re-implemented here from the documented parameters.
// For every route part it then measures, in SVG units:
//   A. source -> drawn: distance from every projected source vertex to the drawn polyline
//      (must be <= tolerance 0.12 + rounding 0.0071);
//   B. drawn -> source: distance from every drawn vertex to the nearest projected source vertex
//      (Douglas-Peucker keeps original vertices, so this must be <= rounding 0.0071, i.e. no new points);
//   C. endpoints and part counts match; station dots sit on their source coordinates.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const dir = new URL("../src/data/railMap/", import.meta.url);
const snap = (name) => JSON.parse(gunzipSync(readFileSync(new URL(`source/${name}.json.gz`, dir))));
const geometry = JSON.parse(readFileSync(new URL("geometry.json", dir)));
const audit = JSON.parse(readFileSync(new URL("serviceAudit.json", dir)));

const D = Math.PI / 180;
const n = (Math.sin(29.5 * D) + Math.sin(45.5 * D)) / 2;
const C = Math.cos(29.5 * D) ** 2 + 2 * n * Math.sin(29.5 * D);
const rho = (lat) => Math.sqrt(C - 2 * n * Math.sin(lat * D)) / n;
const albers = ([lon, lat]) => { const t = n * (lon + 96) * D; return [rho(lat) * Math.sin(t), rho(38) - rho(lat) * Math.cos(t)]; };
// SVG y grows downward: use -northing.
const toSvgSpace = (p) => { const [x, y] = albers(p); return [x, -y]; };

const states = snap("states").features.filter((f) => f.properties.adm0_a3 === "USA" && !["Alaska", "Hawaii"].includes(f.properties.name));
const rings = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat();
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const f of states) for (const ring of rings(f.geometry)) for (const v of ring) {
  const [x, y] = toSvgSpace(v); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const frame = { x: 22, y: 26, w: 748, h: 372 };
const k = Math.min(frame.w / (maxX - minX), frame.h / (maxY - minY));
const ox = frame.x + (frame.w - (maxX - minX) * k) / 2, oy = frame.y + (frame.h - (maxY - minY) * k) / 2;
const project = (p) => { const [x, y] = toSvgSpace(p); return [ox + (x - minX) * k, oy + (y - minY) * k]; };

const seg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const parse = (d) => [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);

const TOL = geometry.tolerance, ROUND = Math.SQRT2 * 0.005;
let fail = 0;
const routes = snap("routes").features;
const srcLines = audit.routes.flatMap((e) => { const f = routes.find((x) => x.properties.OBJECTID === e.objectId); return f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates; }).map((l) => l.map(project));
const cell = 1, key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
const vgrid = new Map(), sgrid = new Map();
const add = (g, k, v) => g.set(k, [...(g.get(k) ?? []), v]);
for (const l of srcLines) l.forEach((p, i) => {
  add(vgrid, key(...p), p);
  if (i) { const a = l[i - 1]; const x0 = Math.floor(Math.min(a[0], p[0]) / cell), x1 = Math.floor(Math.max(a[0], p[0]) / cell), y0 = Math.floor(Math.min(a[1], p[1]) / cell), y1 = Math.floor(Math.max(a[1], p[1]) / cell); for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) add(sgrid, `${x},${y}`, [a, p]); }
});
const around = (g, [x, y]) => { const out = []; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...(g.get(`${Math.floor(x / cell) + dx},${Math.floor(y / cell) + dy}`) ?? [])); return out; };
const stationXY = Object.fromEntries(geometry.stations.map((s) => [s.code, [s.x, s.y]]));
const cityCodes = (c) => geometry.stations.filter((s) => s.cityId === c).map((s) => s.code);
const near = (pt, c) => Math.min(...cityCodes(c).map((k) => Math.hypot(pt[0] - stationXY[k][0], pt[1] - stationXY[k][1])));
let maxB = 0, maxS = 0, maxE = 0, nPaths = 0, drawnVertices = 0;
for (const r of geometry.routes) {
  if (!r.edges || r.edges.length !== r.paths.length) { fail++; console.log(`FAIL ${r.id}: edges/paths mismatch`); continue; }
  let rB = 0, rS = 0, rE = 0;
  r.paths.forEach((d, i) => {
    nPaths++;
    const drawn = parse(d); drawnVertices += drawn.length;
    for (const q of drawn) { let m = Infinity; for (const p of around(vgrid, q)) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); rB = Math.max(rB, m); }
    for (let j = 1; j < drawn.length; j++) for (const t of [0.25, 0.5, 0.75]) {
      const q = [drawn[j - 1][0] + t * (drawn[j][0] - drawn[j - 1][0]), drawn[j - 1][1] + t * (drawn[j][1] - drawn[j - 1][1])];
      let m = Infinity; for (const [a, b] of around(sgrid, q)) m = Math.min(m, seg(q, a, b)); rS = Math.max(rS, m);
    }
    const [a, z] = r.edges[i];
    rE = Math.max(rE, Math.min(Math.max(near(drawn[0], a), near(drawn.at(-1), z)), Math.max(near(drawn[0], z), near(drawn.at(-1), a))));
  });
  const ok = rB <= ROUND && rS <= TOL + ROUND && rE <= 0.8;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${r.id.padEnd(20)} paths=${String(r.paths.length).padStart(2)} drawn->source vertex max=${rB.toFixed(4)} segment->track max=${rS.toFixed(4)} ends->stations max=${rE.toFixed(4)}`);
  maxB = Math.max(maxB, rB); maxS = Math.max(maxS, rS); maxE = Math.max(maxE, rE);
}
if (nPaths !== 22) { fail++; console.log(`FAIL expected 22 network-edge paths, got ${nPaths}`); }
const stations = snap("stations").features;
let maxStation = 0;
for (const s of geometry.stations) {
  const f = stations.find((x) => x.properties.Code === s.code);
  if (f.properties.StnType !== "TRAIN") { fail++; console.log(`FAIL ${s.code} not TRAIN`); }
  const [x, y] = project(f.geometry.coordinates);
  maxStation = Math.max(maxStation, Math.hypot(x - s.x, y - s.y));
}
if (maxStation > ROUND) fail++;
let lirrOff = NaN;
if (geometry.lirr) { const [x, y] = project([geometry.lirr.longitude, geometry.lirr.latitude]); lirrOff = Math.hypot(x - geometry.lirr.x, y - geometry.lirr.y); if (lirrOff > ROUND) { fail++; console.log("FAIL LIRR marker offset"); } }
console.log(`\nIndependent projection: ${states.length} boundaries; ${geometry.routes.length} route groups; ${nPaths} paths; ${srcLines.length} source parts; ${drawnVertices} drawn vertices; ${geometry.stations.length} stations.`);
console.log(`Max drawn->source vertex ${maxB.toFixed(4)} (limit ${ROUND.toFixed(4)}); max segment->track ${maxS.toFixed(4)} (limit ${(TOL + ROUND).toFixed(4)}); max path end->station ${maxE.toFixed(4)}; max station offset ${maxStation.toFixed(4)}; LIRR offset ${lirrOff.toFixed(4)}.`);
console.log(fail ? `${fail} FAIL` : "ALL PASS");
process.exit(fail ? 1 : 0);
