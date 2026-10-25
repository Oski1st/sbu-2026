// P5d spot-check: do the drawn network-edge paths pass through the intermediate stops Amtrak's own route pages
// list for that segment? (Fetched 2026-10-25: amtrak.com/carolinian-train, /piedmont-train,
// /silver-service-palmetto-train, /floridian-train.) Station positions come from the bundled NTAD station snapshot,
// projected with the same independently re-implemented Albers fit as qa/p5d-rail-map-geometry-check.mjs.
// Usage: copy into <checkout>/qa/ and run: node qa/p5d-official-stops-check.mjs
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const dir = new URL("../src/data/railMap/", import.meta.url);
const snap = (name) => JSON.parse(gunzipSync(readFileSync(new URL(`source/${name}.json.gz`, dir))));
const geometry = JSON.parse(readFileSync(new URL("geometry.json", dir)));
const D = Math.PI / 180;
const n = (Math.sin(29.5 * D) + Math.sin(45.5 * D)) / 2;
const C = Math.cos(29.5 * D) ** 2 + 2 * n * Math.sin(29.5 * D);
const rho = (lat) => Math.sqrt(C - 2 * n * Math.sin(lat * D)) / n;
const albers = ([lon, lat]) => { const t = n * (lon + 96) * D; return [rho(lat) * Math.sin(t), rho(38) - rho(lat) * Math.cos(t)]; };
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
const kmPerUnit = (111.32 * Math.cos(38 * D)) / Math.hypot(project([-95, 38])[0] - project([-96, 38])[0], project([-95, 38])[1] - project([-96, 38])[1]);

// Intermediate stops listed on the official pages (route order), per OneLine edge.
const checks = [
  { edge: ["richmond", "raleigh"], source: "amtrak.com/carolinian-train", stops: ["PTB", "RMT", "WLN", "SSM"] },
  { edge: ["raleigh", "charlotte"], source: "amtrak.com/piedmont-train + /carolinian-train", stops: ["CYN", "DNC", "BNC", "GRO", "HPT", "SAL", "KAN"] },
  { edge: ["fayetteville", "charleston"], source: "amtrak.com/silver-service-palmetto-train", stops: ["DIL", "FLO", "KTR"] },
  { edge: ["charleston", "savannah"], source: "amtrak.com/silver-service-palmetto-train", stops: ["YEM"] },
  { edge: ["orlando", "tampa"], source: "amtrak.com/floridian-train (Silver Star successor)", stops: ["KIS", "LAK"] },
];
const stationFeatures = snap("stations").features;
const LIMIT_KM = 3; // a stop counts as "on" the drawn path within ~3 km (sub-pixel at every width)
let fail = 0;
for (const { edge, source, stops } of checks) {
  const route = geometry.routes.find((r) => r.edges.some(([a, z]) => (a === edge[0] && z === edge[1]) || (a === edge[1] && z === edge[0])));
  const i = route.edges.findIndex(([a, z]) => (a === edge[0] && z === edge[1]) || (a === edge[1] && z === edge[0]));
  const drawn = parse(route.paths[i]);
  const rows = stops.map((code) => {
    const f = stationFeatures.find((x) => x.properties.Code === code && x.properties.StnType === "TRAIN") ?? stationFeatures.find((x) => x.properties.Code === code);
    if (!f) return `${code}:not-in-snapshot`;
    const pt = project(f.geometry.coordinates);
    let m = Infinity; for (let j = 1; j < drawn.length; j++) m = Math.min(m, seg(pt, drawn[j - 1], drawn[j]));
    const km = m * kmPerUnit;
    if (km > LIMIT_KM) fail++;
    return `${code}(${f.properties.City}) ${km.toFixed(2)}km${km > LIMIT_KM ? " FAR" : ""}`;
  });
  console.log(`${rows.some((r) => r.includes("FAR") || r.includes("not-in")) ? "FAIL" : "PASS"} ${edge.join("->")} [${route.id} path ${i}] vs ${source}: ${rows.join(", ")}`);
}
console.log(fail ? `${fail} stops off the drawn path` : `ALL PASS (1 unit ~ ${kmPerUnit.toFixed(2)} km)`);
process.exit(fail ? 1 : 0);
