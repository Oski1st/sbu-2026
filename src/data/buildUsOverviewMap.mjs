// Reproduce: node src/data/buildUsOverviewMap.mjs <Natural Earth GeoJSON file>
// Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_1_states_provinces.geojson
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fitProjection, projectContiguous, projectInset } from '../components/search/mapProjection.ts';

const input = readFileSync(process.argv[2]);
const source = JSON.parse(input);
const states = source.features.filter(feature => feature.properties.adm0_a3 === 'USA');
const rings = geometry => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).flat();

function build(features, project, frame) {
  const fit = fitProjection(features.flatMap(feature => rings(feature.geometry).flat().map(project)), frame);
  return features.map(feature => ({
    name: feature.properties.name,
    path: rings(feature.geometry).map(ring => ring.map((point, index) => {
      const [x, y] = fit(project(point));
      return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join('') + 'Z').join(''),
  }));
}

const output = {
  source: 'Natural Earth 1:50m Admin 1 — States, Provinces (public domain), 2026-10-24 snapshot',
  sourceUrl: 'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-1-states-provinces/',
  sourceSha256: createHash('sha256').update(input).digest('hex'),
  projection: 'North-up Albers equal-area for the contiguous U.S.; north-up geographic Alaska/Hawaii insets, not to scale.',
  contiguous: build(states.filter(feature => !['Alaska', 'Hawaii'].includes(feature.properties.name)), projectContiguous, { x: 28, y: 45, width: 730, height: 335 }),
  alaska: build(states.filter(feature => feature.properties.name === 'Alaska'), projectInset, { x: 42, y: 444, width: 270, height: 110 }),
  hawaii: build(states.filter(feature => feature.properties.name === 'Hawaii'), projectInset, { x: 380, y: 444, width: 200, height: 110 }),
};
writeFileSync(new URL('./usOverviewMap.json', import.meta.url), JSON.stringify(output));
