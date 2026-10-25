// Independent geometry check (P4-36 protocol row M6) for the CONUS passenger-rail map.
// Usage: node qa/rail-map-geometry-check.mjs
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
let fail = 0, maxA = 0, maxB = 0, sourceVertices = 0, drawnVertices = 0, maxEnd = 0;
const routes = snap("routes").features;
for (const r of geometry.routes) {
  const f = routes.find((x) => x.properties.OBJECTID === r.objectId);
  const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
  if (f.properties.name !== r.name || lines.length !== r.paths.length) { fail++; console.log(`FAIL ${r.id}: name/part mismatch`); continue; }
  let rA = 0, rB = 0;
  r.paths.forEach((d, i) => {
    const drawn = parse(d), src = lines[i].map(project);
    sourceVertices += src.length; drawnVertices += drawn.length;
    for (const p of src) { let m = Infinity; for (let j = 1; j < drawn.length; j++) m = Math.min(m, seg(p, drawn[j - 1], drawn[j])); rA = Math.max(rA, m); }
    for (const q of drawn) { let m = Infinity; for (const p of src) m = Math.min(m, Math.hypot(p[0] - q[0], p[1] - q[1])); rB = Math.max(rB, m); }
    maxEnd = Math.max(maxEnd, Math.hypot(drawn[0][0] - src[0][0], drawn[0][1] - src[0][1]), Math.hypot(drawn.at(-1)[0] - src.at(-1)[0], drawn.at(-1)[1] - src.at(-1)[1]));
  });
  const ok = rA <= TOL + ROUND && rB <= ROUND;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${r.id.padEnd(20)} parts=${String(r.paths.length).padStart(2)} source->drawn max=${rA.toFixed(4)} drawn->source max=${rB.toFixed(4)}`);
  maxA = Math.max(maxA, rA); maxB = Math.max(maxB, rB);
}
if (maxEnd > ROUND) { fail++; console.log(`FAIL endpoints max offset ${maxEnd.toFixed(4)}`); }
const stations = snap("stations").features;
let maxStation = 0;
for (const s of geometry.stations) {
  const f = stations.find((x) => x.properties.Code === s.code);
  if (f.properties.StnType !== "TRAIN") { fail++; console.log(`FAIL ${s.code} not TRAIN`); }
  const [x, y] = project(f.geometry.coordinates);
  maxStation = Math.max(maxStation, Math.hypot(x - s.x, y - s.y));
}
if (maxStation > ROUND) fail++;
const kmPerUnit = (() => { // scale check: one SVG unit along the 38N parallel near 96W, in km
  const a = project([-96, 38]), b = project([-95, 38]);
  return (111.32 * Math.cos(38 * D)) / Math.hypot(b[0] - a[0], b[1] - a[1]);
})();
console.log(`\nIndependent projection: ${states.length} boundaries; ${geometry.routes.length} routes; ${sourceVertices} source vertices; ${drawnVertices} drawn vertices; ${geometry.stations.length} stations (${audit.cities.length} audited cities).`);
console.log(`Max source->drawn deviation ${maxA.toFixed(4)} SVG units (limit ${(TOL + ROUND).toFixed(4)}) ~ ${(maxA * kmPerUnit).toFixed(2)} km; max drawn->source ${maxB.toFixed(4)}; max endpoint offset ${maxEnd.toFixed(4)}; max station offset ${maxStation.toFixed(4)}. 1 unit ~ ${kmPerUnit.toFixed(2)} km.`);
console.log(fail ? `${fail} FAIL` : "ALL PASS");
process.exit(fail ? 1 : 0);
