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
for (const entry of audit.routes) {
  const feature = snapshots.routes.json.features.find(feature => feature.properties.OBJECTID === entry.objectId);
  if (!feature || feature.properties.name !== entry.name) throw new Error(`Missing/mismatched route: ${entry.id}`);
  if (!['LineString', 'MultiLineString'].includes(feature.geometry.type)) throw new Error('Expected rail polylines');
  const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  const paths = lines.map(line => {
    if (!line.every(([lon, lat]) => lon >= -125 && lon <= -66 && lat >= 24 && lat <= 50)) throw new Error('Route outside contiguous-U.S. extent');
    inputPoints += line.length;
    const result = simplify(line.map(project), geometry.tolerance);
    retainedPoints += result.length;
    return path(result);
  });
  geometry.routes.push({ id: entry.id, objectId: entry.objectId, name: entry.name, paths });
}
for (const city of audit.cities) for (const code of city.codes) {
  const feature = snapshots.stations.json.features.find(feature => feature.properties.Code === code);
  if (!feature || feature.properties.StnType !== 'TRAIN') throw new Error(`Missing train station: ${code}`);
  const [x,y] = project(feature.geometry.coordinates);
  geometry.stations.push({ code, cityId: city.id, locality: feature.properties.City, name: feature.properties.Name.trim() || city.name, x: +x.toFixed(2), y: +y.toFixed(2), longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] });
}
const provenance = {
  retrievedDate: audit.checkedDate,
  routeVersion: snapshots['route-metadata'].json.description,
  stationVersion: snapshots['station-metadata'].json.description,
  routeLastEdit: snapshots['route-metadata'].json.editingInfo?.lastEditDate,
  licence: snapshots['route-metadata'].json.copyrightText,
  stateLicence: 'Natural Earth: public domain',
  sources: Object.fromEntries(inputs.map(([id]) => [id, { url: snapshots[id].url, sha256: snapshots[id].sha256 }])),
  preprocessing: 'Select explicitly audited route OBJECTIDs; project every source vertex with the same state-boundary fit; simplify each source part independently with Douglas-Peucker tolerance 0.12 SVG units; preserve endpoints and multipart breaks; round to 0.01 SVG units. No station-to-station connectors or new route geometry.',
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
