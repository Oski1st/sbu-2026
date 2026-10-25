// Node 24: node src/data/railMap/build.mjs --download (refresh), or --verify (offline).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fitProjection, projectContiguous } from '../../components/search/mapProjection.ts';

const directory = new URL('./', import.meta.url);
const audit = JSON.parse(readFileSync(new URL('serviceAudit.json', directory)));
const service = 'https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/';
const routeLayer = service + 'NTAD_Amtrak_Routes/FeatureServer/0';
const stationLayer = service + 'NTAD_Amtrak_Stations/FeatureServer/0';
const query = (layer, fields, where = '1=1') => layer + '/query?' + new URLSearchParams({ where, outFields: fields, outSR: '4326', f: 'geojson' });
const inputs = [
  ['states', 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson'],
  ['routes', query(routeLayer, 'OBJECTID,name,ROUTE_URL', 'OBJECTID IN (' + audit.routes.map(route => route.objectId).join(',') + ')')],
  ['stations', query(stationLayer, 'Code,City,State,Name,StaType,StnType,lon,lat')],
  ['route-metadata', routeLayer + '?f=json'], ['station-metadata', stationLayer + '?f=json'],
];
const hash = data => createHash('sha256').update(data).digest('hex');
const snapshots = {};
mkdirSync(new URL('source/', directory), { recursive: true });
for (const [id, url] of inputs) {
  const path = new URL(`source/${id}.json.gz`, directory);
  if (process.argv.includes('--download')) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const parsed = JSON.parse(bytes);
    if (parsed.error || parsed.exceededTransferLimit) throw new Error(`Incomplete source: ${id}`);
    writeFileSync(path, gzipSync(bytes, { level: 9 }));
  }
  const bytes = gunzipSync(readFileSync(path));
  snapshots[id] = { bytes, json: JSON.parse(bytes), url, sha256: hash(bytes) };
}
const rings = geometry => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat();
const states = snapshots.states.json.features.filter(feature => feature.properties.adm0_a3 === 'USA' && !['Alaska', 'Hawaii'].includes(feature.properties.name));
if (states.length !== 49) throw new Error('Expected 48 contiguous states and DC');
const fit = fitProjection(states.flatMap(feature => rings(feature.geometry).flat().map(projectContiguous)), { x: 22, y: 26, width: 748, height: 372 });
const project = point => fit(projectContiguous(point));

export function pointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((point[0]-a[0])*dx + (point[1]-a[1])*dy)/(dx*dx + dy*dy))) : 0;
  return Math.hypot(point[0]-a[0]-t*dx, point[1]-a[1]-t*dy);
}
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Set([0, points.length - 1]);
  const work = [[0, points.length - 1]];
  while (work.length) {
    const [start, end] = work.pop();
    let distance = tolerance, selected = -1;
    for (let i = start + 1; i < end; i++) {
      const current = pointSegmentDistance(points[i], points[start], points[end]);
      if (current > distance) { distance = current; selected = i; }
    }
    if (selected !== -1) { keep.add(selected); work.push([start, selected], [selected, end]); }
  }
  return [...keep].sort((a, b) => a-b).map(index => points[index]);
}
const path = points => points.map(([x,y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
const geometry = {
  viewBox: [0, 0, 800, 420],
  projection: 'North-up Albers equal-area; standard parallels 29.5/45.5; central meridian -96.',
  tolerance: 0.12,
  boundaries: states.map(feature => ({ name: feature.properties.name, path: rings(feature.geometry).map(ring => path(simplify(ring.map(project), 0.12)) + 'Z').join('') })),
  routes: [], stations: [],
};
let inputPoints = 0, retainedPoints = 0;
// Merge every audited route's source parts into one track graph (vertex = source vertex).
const vertices = [], neighbours = [];
const link = (a, b, w) => { neighbours[a].push([b, w]); neighbours[b].push([a, w]); };
const byCoordinate = new Map();
const partRanges = [];
for (const entry of audit.routes) {
  const feature = snapshots.routes.json.features.find(feature => feature.properties.OBJECTID === entry.objectId);
  if (!feature || feature.properties.name !== entry.name) throw new Error(`Missing/mismatched route: ${entry.id}`);
  if (!['LineString', 'MultiLineString'].includes(feature.geometry.type)) throw new Error('Expected rail polylines');
  const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const line of lines) {
    if (!line.every(([lon, lat]) => lon >= -125 && lon <= -66 && lat >= 24 && lat <= 50)) throw new Error('Route outside contiguous-U.S. extent');
    inputPoints += line.length;
    const start = vertices.length;
    line.forEach((coordinate, index) => {
      const id = vertices.push({ xy: project(coordinate), lonLat: coordinate }) - 1;
      neighbours.push([]);
      if (index) link(id - 1, id, Math.hypot(vertices[id].xy[0] - vertices[id - 1].xy[0], vertices[id].xy[1] - vertices[id - 1].xy[1]));
      const key = coordinate.map(value => value.toFixed(6)).join(',');
      for (const other of byCoordinate.get(key) ?? []) link(other, id, 0); // shared source vertex = track junction
      byCoordinate.set(key, [...(byCoordinate.get(key) ?? []), id]);
    });
    partRanges.push([start, vertices.length - 1]);
  }
}
// Part ends that touch another part without an identical vertex are source digitising seams (largest: 0.114
// SVG units near Raleigh): join within 0.15 units, sub-pixel at this scale. Boston North and South stations
// (0.229 apart, no through track) deliberately stay unjoined.
const grid = new Map(), cell = 0.5, cellKey = ([x, y]) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
vertices.forEach((vertex, id) => grid.set(cellKey(vertex.xy), [...(grid.get(cellKey(vertex.xy)) ?? []), id]));
const near = (xy, radius) => {
  const found = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const id of grid.get(`${Math.floor(xy[0] / cell) + dx},${Math.floor(xy[1] / cell) + dy}`) ?? []) {
      const d = Math.hypot(vertices[id].xy[0] - xy[0], vertices[id].xy[1] - xy[1]);
      if (d <= radius) found.push([id, d]);
    }
  }
  return found;
};
for (const [start, end] of partRanges) for (const id of [start, end]) {
  for (const [other, d] of near(vertices[id].xy, 0.15)) if (other < start || other > end) link(id, other, d);
}
for (const city of audit.cities) for (const code of city.codes) {
  const feature = snapshots.stations.json.features.find(feature => feature.properties.Code === code);
  if (!feature || feature.properties.StnType !== 'TRAIN') throw new Error(`Missing train station: ${code}`);
  const [x,y] = project(feature.geometry.coordinates);
  geometry.stations.push({ code, cityId: city.id, locality: feature.properties.City, name: feature.properties.Name.trim() || city.name, x: +x.toFixed(2), y: +y.toFixed(2), longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] });
}
// Draw only where OneLine runs: for each network edge, the shortest source track between the two cities' stations.
const attach = station => {
  const hits = near([station.x, station.y], 0.8);
  if (!hits.length) throw new Error(`Station ${station.code} is not on audited track`);
  // Start and end exactly at the track point(s) closest to the station so lines meet their markers.
  const closest = Math.min(...hits.map(([, d]) => d));
  return hits.filter(([, d]) => d <= closest + 0.02);
};
const shortestTrack = (fromCity, toCity) => {
  const sources = geometry.stations.filter(station => station.cityId === fromCity).flatMap(attach);
  const targets = new Set(geometry.stations.filter(station => station.cityId === toCity).flatMap(attach).map(([id]) => id));
  const distance = new Map(), previous = new Map(), heap = [];
  const push = (id, d) => { heap.push([d, id]); let i = heap.length - 1; while (i && heap[(i - 1) >> 1][0] > heap[i][0]) { [heap[i], heap[(i - 1) >> 1]] = [heap[(i - 1) >> 1], heap[i]]; i = (i - 1) >> 1; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  for (const [id, d] of sources) if (d < (distance.get(id) ?? Infinity)) { distance.set(id, d); push(id, d); }
  while (heap.length) {
    const [d, id] = pop();
    if (d > distance.get(id)) continue;
    if (targets.has(id)) {
      const ids = [id];
      while (previous.has(ids[0])) ids.unshift(previous.get(ids[0]));
      return ids.map(vertex => vertices[vertex].xy).filter((xy, index, all) => !index || xy[0] !== all[index - 1][0] || xy[1] !== all[index - 1][1]);
    }
    for (const [next, w] of neighbours[id]) if (d + w < (distance.get(next) ?? Infinity)) { distance.set(next, d + w); previous.set(next, id); push(next, d + w); }
  }
  throw new Error(`No audited track between ${fromCity} and ${toCity}`);
};
for (const corridor of audit.network.corridors) {
  const paths = corridor.edges.map(([from, to]) => {
    const result = simplify(shortestTrack(from, to), geometry.tolerance);
    retainedPoints += result.length;
    return path(result);
  });
  geometry.routes.push({ id: corridor.id, name: corridor.name, edges: corridor.edges, paths });
}
// Stony Brook: LIRR station from its cited coordinates; no LIRR track exists in the bundled federal data.
{
  const [x, y] = project([audit.lirr.longitude, audit.lirr.latitude]);
  const from = geometry.stations.find(station => station.cityId === audit.lirr.from);
  geometry.lirr = { id: audit.lirr.id, cityId: audit.lirr.cityId, name: audit.lirr.name, x: +x.toFixed(2), y: +y.toFixed(2), longitude: audit.lirr.longitude, latitude: audit.lirr.latitude, schematicFrom: { code: from.code, x: from.x, y: from.y } };
}
const provenance = {
  retrievedDate: audit.checkedDate,
  routeVersion: snapshots['route-metadata'].json.description,
  stationVersion: snapshots['station-metadata'].json.description,
  routeLastEdit: snapshots['route-metadata'].json.editingInfo?.lastEditDate,
  licence: snapshots['route-metadata'].json.copyrightText,
  stateLicence: 'Natural Earth: public domain',
  sources: Object.fromEntries(inputs.map(([id]) => [id, { url: snapshots[id].url, sha256: snapshots[id].sha256 }])),
  preprocessing: 'Select explicitly audited route OBJECTIDs; project every source vertex with the same state-boundary fit; merge all parts into one track graph (identical source vertices are junctions; part ends within 0.15 SVG units are joined, Boston North/South stay separate); for each OneLine network edge keep only the shortest source track between the two cities\' Amtrak stations, so no track beyond our cities is drawn; simplify each kept path with Douglas-Peucker tolerance 0.12 SVG units; round to 0.01 SVG units. No new track geometry. Stony Brook is a single LIRR station marker from cited coordinates; its link to New York is rendered as a dashed schematic, not track.',
  inputPoints, retainedPoints,
};
for (const [name, data] of [['geometry.json', geometry], ['provenance.json', provenance]]) {
  const result = JSON.stringify(data);
  const destination = new URL(name, directory);
  if (process.argv.includes('--verify')) {
    if (readFileSync(destination, 'utf8') !== result) throw new Error(`Reproduction mismatch: ${name}`);
  } else writeFileSync(destination, result);
}
console.log(JSON.stringify({ states: states.length, routes: geometry.routes.length, stations: geometry.stations.length, inputPoints, retainedPoints, verify: process.argv.includes('--verify'), output: fileURLToPath(directory) }));
