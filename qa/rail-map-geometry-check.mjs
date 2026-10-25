// Independent geometry check (P4-36 protocol row M6) for the CONUS passenger-rail map.
// Usage: node qa/rail-map-geometry-check.mjs
//
// Deliberately does NOT import build.mjs or mapProjection.ts: the Albers equal-area projection
// (standard parallels 29.5/45.5, origin 38N 96W) and the uniform fit to the 49 state outlines in
// the {x:22,y:26,w:748,h:372} frame are re-implemented here from the documented parameters.
// The clipped network has corridor.edges/paths, not one full source feature per route.
// Check each retained vertex against the audited federal source vertices, sample every
// drawn segment against the source track, and check each edge's city-station endpoints.
// Deliberately do not require excluded Chicago/Buffalo/etc. source track to be drawn.
// Station coordinates and the LIRR schematic are checked independently as well.
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
const CELL = 1, SAMPLE_STEP = 0.05;
let fail = 0, maxTrack = 0, maxVertex = 0, sourceVertices = 0, drawnVertices = 0, maxEnd = 0, samples = 0;
const reject = (message) => { fail++; console.log(`FAIL ${message}`); };
const vertexGrid = new Map(), segmentGrid = new Map();
const gridKey = (x, y) => `${x},${y}`;
const put = (grid, x, y, value) => {
  const key = gridKey(x, y);
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(value);
};
const routes = snap("routes").features;
for (const entry of audit.routes) {
  const f = routes.find((feature) => feature.properties.OBJECTID === entry.objectId);
  if (!f || f.properties.name !== entry.name) { reject(`${entry.id}: missing/mismatched audited source`); continue; }
  const lines = f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const coordinates of lines) {
    const points = coordinates.map(project);
    sourceVertices += points.length;
    for (const point of points) put(vertexGrid, Math.floor(point[0] / CELL), Math.floor(point[1] / CELL), point);
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index];
      for (let x = Math.floor(Math.min(a[0], b[0]) / CELL); x <= Math.floor(Math.max(a[0], b[0]) / CELL); x++) {
        for (let y = Math.floor(Math.min(a[1], b[1]) / CELL); y <= Math.floor(Math.max(a[1], b[1]) / CELL); y++) put(segmentGrid, x, y, [a, b]);
      }
    }
  }
}
const nearby = (grid, [x, y]) => {
  const items = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) items.push(...(grid.get(gridKey(Math.floor(x / CELL) + dx, Math.floor(y / CELL) + dy)) ?? []));
  return items;
};
const vertexDistance = (point) => Math.min(...nearby(vertexGrid, point).map((source) => Math.hypot(source[0] - point[0], source[1] - point[1])));
const trackDistance = (point) => Math.min(...nearby(segmentGrid, point).map(([a, b]) => seg(point, a, b)));
const stationDistance = (cityId, point) => Math.min(...geometry.stations.filter((station) => station.cityId === cityId).map((station) => Math.hypot(station.x - point[0], station.y - point[1])));
const expectedEdges = new Set(audit.network.corridors.flatMap((corridor) => corridor.edges.map((edge) => edge.join("|"))));
const observedEdges = new Set();
for (const route of geometry.routes) {
  if (!Array.isArray(route.edges) || route.paths.length !== route.edges.length) { reject(`${route.id}: corridor edge/path count mismatch`); continue; }
  let routeTrack = 0, routeVertex = 0;
  route.paths.forEach((path, index) => {
    const drawn = parse(path), [from, to] = route.edges[index];
    const edge = [from, to].join("|");
    if (!expectedEdges.has(edge) || observedEdges.has(edge)) reject(`${route.id}: unexpected or duplicate edge ${edge}`);
    observedEdges.add(edge);
    if (drawn.length < 2 || [...path.matchAll(/M/g)].length !== 1) { reject(`${edge}: expected one connected polyline`); return; }
    drawnVertices += drawn.length;
    for (const point of drawn) routeVertex = Math.max(routeVertex, vertexDistance(point));
    for (let part = 1; part < drawn.length; part++) {
      const a = drawn[part - 1], b = drawn[part];
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / SAMPLE_STEP));
      for (let sample = 0; sample <= steps; sample++) {
        const point = [a[0] + (b[0] - a[0]) * sample / steps, a[1] + (b[1] - a[1]) * sample / steps];
        routeTrack = Math.max(routeTrack, trackDistance(point));
        samples++;
      }
    }
    maxEnd = Math.max(maxEnd, stationDistance(from, drawn[0]), stationDistance(to, drawn.at(-1)));
  });
  if (routeVertex > ROUND) reject(`${route.id}: retained vertex is not an original source vertex (${routeVertex.toFixed(4)})`);
  // All samples must meet the simplification-plus-rounding limit. Distance to a
  // polyline is 1-Lipschitz, so unsampled points are at most half a step farther.
  if (routeTrack > TOL + ROUND) reject(`${route.id}: drawn track deviates from audited track (${routeTrack.toFixed(4)})`);
  console.log(`${routeVertex <= ROUND && routeTrack <= TOL + ROUND ? "PASS" : "FAIL"} ${route.id.padEnd(20)} edges=${route.paths.length} retained-vertex offset=${routeVertex.toFixed(4)} sampled-track offset=${routeTrack.toFixed(4)}`);
  maxVertex = Math.max(maxVertex, routeVertex); maxTrack = Math.max(maxTrack, routeTrack);
}
for (const edge of expectedEdges) if (!observedEdges.has(edge)) reject(`missing network edge ${edge}`);
if (observedEdges.size !== 22) reject(`expected 22 sample-network edges, got ${observedEdges.size}`);
if (maxEnd >= 0.8) reject(`city-station endpoint offset ${maxEnd.toFixed(4)} exceeds 0.8 SVG units`);
const stations = snap("stations").features;
let maxStation = 0;
for (const s of geometry.stations) {
  const f = stations.find((x) => x.properties.Code === s.code);
  if (!f || f.properties.StnType !== "TRAIN") { reject(`${s.code}: missing source train station`); continue; }
  const [x, y] = project(f.geometry.coordinates);
  maxStation = Math.max(maxStation, Math.hypot(x - s.x, y - s.y));
}
if (maxStation > ROUND) reject(`station source-coordinate offset ${maxStation.toFixed(4)}`);
const lirr = geometry.lirr, lirrSource = audit.lirr;
if (!lirr || !lirrSource) reject("missing LIRR marker/schematic metadata");
else {
  const [x, y] = project([lirrSource.longitude, lirrSource.latitude]);
  if (Math.hypot(x - lirr.x, y - lirr.y) > ROUND || lirr.cityId !== "stony-brook") reject("LIRR marker differs from cited station coordinates");
  const origin = geometry.stations.find((station) => station.code === lirr.schematicFrom?.code);
  if (!origin || origin.cityId !== "new-york" || origin.x !== lirr.schematicFrom.x || origin.y !== lirr.schematicFrom.y) reject("LIRR schematic does not originate at New York Penn Station");
}
const kmPerUnit = (() => { // scale check: one SVG unit along the 38N parallel near 96W, in km
  const a = project([-96, 38]), b = project([-95, 38]);
  return (111.32 * Math.cos(38 * D)) / Math.hypot(b[0] - a[0], b[1] - a[1]);
})();
console.log(`\nIndependent projection: ${states.length} boundaries; ${geometry.routes.length} corridors / ${observedEdges.size} network edges; ${sourceVertices} source vertices; ${drawnVertices} drawn vertices; ${samples} track samples; ${geometry.stations.length} Amtrak stations plus the LIRR schematic (${audit.cities.length} audited cities).`);
console.log(`Max sampled drawn->source track deviation ${maxTrack.toFixed(4)} SVG units (sample limit ${(TOL + ROUND).toFixed(4)}; unsampled-point bound ${(maxTrack + SAMPLE_STEP / 2).toFixed(4)}) ~ ${(maxTrack * kmPerUnit).toFixed(2)} km; max retained-vertex offset ${maxVertex.toFixed(4)}; max city-station endpoint offset ${maxEnd.toFixed(4)}; max station-coordinate offset ${maxStation.toFixed(4)}. 1 unit ~ ${kmPerUnit.toFixed(2)} km.`);
console.log(fail ? `${fail} FAIL` : "ALL PASS");
process.exit(fail ? 1 : 0);
