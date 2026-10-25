import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import geometry from "./geometry.json";
import provenance from "./provenance.json";
import audit from "./serviceAudit.json";
import { cities } from "../eastCoast";
import { fitProjection, projectContiguous } from "../../components/search/mapProjection";

const readSource = (name) => gunzipSync(readFileSync(new URL(`./source/${name}.json.gz`, import.meta.url)));
const coordinates = (path) => [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((p) => [+p[1], +p[2]]);
function distance(p, a, b) {
  const dx = b[0]-a[0], dy = b[1]-a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))) : 0;
  return Math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy);
}

describe("rail geometry provenance and coverage", () => {
  test("reproduces the committed geometry offline from hashed public-domain snapshots", () => {
    for (const [name, source] of Object.entries(provenance.sources)) {
      expect(createHash("sha256").update(readSource(name)).digest("hex")).toBe(source.sha256);
    }
    expect(provenance.licence).toContain("unrestricted public use");
    expect(execFileSync(process.execPath, [fileURLToPath(new URL("./build.mjs", import.meta.url)), "--verify"], { encoding: "utf8", timeout: 10000 })).toContain('"verify":true');
  });

  test("preserves source route names, multipart breaks, endpoints and simplification error bound", () => {
    const rawStates = JSON.parse(readSource("states").toString()).features.filter((f) => f.properties.adm0_a3 === "USA" && !["Alaska", "Hawaii"].includes(f.properties.name));
    const rings = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat();
    const fit = fitProjection(rawStates.flatMap((f) => rings(f.geometry).flat().map(projectContiguous)), { x: 22, y: 26, width: 748, height: 372 });
    const source = JSON.parse(readSource("routes").toString());
    for (const route of geometry.routes) {
      const feature = source.features.find((f) => f.properties.OBJECTID === route.objectId);
      expect(feature.properties.name).toBe(route.name);
      const lines = feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      expect(route.paths).toHaveLength(lines.length);
      route.paths.forEach((path, index) => {
        const points = coordinates(path), line = lines[index];
        expect(points.length).toBeGreaterThanOrEqual(2);
        expect(path.match(/M/g)).toHaveLength(1);
        for (const [actual, input] of [[points[0], line[0]], [points.at(-1), line.at(-1)]]) {
          const expected = fit(projectContiguous(input));
          expect(actual[0]).toBeCloseTo(expected[0], 1);
          expect(actual[1]).toBeCloseTo(expected[1], 1);
        }
        let maximumDeviation = 0;
        for (const vertex of line) {
          const projected = fit(projectContiguous(vertex));
          let closest = Infinity;
          for (let i = 1; i < points.length; i++) {
            closest = Math.min(closest, distance(projected, points[i - 1], points[i]));
          }
          maximumDeviation = Math.max(maximumDeviation, closest);
        }
        // Every original source vertex remains within DP tolerance + coordinate rounding.
        expect(maximumDeviation, `${route.name} part ${index}`).toBeLessThanOrEqual(geometry.tolerance + 0.008);
      });
    }
    expect(geometry.routes.map((r) => r.objectId).sort((a,b) => a-b)).toEqual([11,16,20,32,34,39,48,49]);
  });

  test("audits every existing city, while excluding bus terminals and documenting missing LIRR geometry", () => {
    expect(audit.cities.map((c) => c.id).sort()).toEqual(cities.map((c) => c.id).sort());
    const source = JSON.parse(readSource("stations").toString());
    expect(geometry.stations).toHaveLength(26);
    expect(new Set(geometry.stations.map((s) => s.cityId)).size).toBe(23);
    for (const station of geometry.stations) {
      expect(source.features.find((f) => f.properties.Code === station.code).properties.StnType).toBe("TRAIN");
    }
    expect(audit.cities.find((c) => c.id === "stony-brook")?.codes).toEqual([]);
    expect(audit.operatorGaps.map((gap) => gap.operator)).toEqual(["SEPTA", "NJ TRANSIT", "LIRR", "Greyhound / FlixBus"]);
    expect(geometry.stations.find((s) => s.code === "ALB")?.locality).toBe("Rensselaer");
    expect(geometry.stations.find((s) => s.code === "CHS")?.locality).toBe("North Charleston");
  });

  test("keeps station markers geographically aligned without using proximity as service evidence", () => {
    const lines = geometry.routes.flatMap((route) => route.paths.map(coordinates));
    for (const station of geometry.stations) {
      const min = Math.min(...lines.flatMap((line) => line.slice(1).map((point, index) => distance([station.x, station.y], line[index], point))));
      expect(min).toBeLessThan(0.15); // SVG units, projection consistency only.
    }
    for (const route of audit.routes) expect(route.url).toMatch(/^https:\/\/www\.amtrak\.com\//);
    expect(audit.cities.find((c) => c.id === "boston")?.codes).toEqual(["BON", "BOS", "BBY"]);
  });

  test("has finite unclipped coordinates and genuinely shaped rail paths rather than two-point city links", () => {
    const all = [...geometry.boundaries.map((s) => s.path), ...geometry.routes.flatMap((r) => r.paths)];
    for (const path of all) for (const [x,y] of coordinates(path)) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(800);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(420);
    }
    for (const route of geometry.routes) expect(route.paths.some((path) => coordinates(path).length > 2)).toBe(true);
  });
});
