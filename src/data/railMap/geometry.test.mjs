import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import geometry from "./geometry.json";
import provenance from "./provenance.json";
import audit from "./serviceAudit.json";
import { cities, getConceptEdges } from "../eastCoast";
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

  test("draws only source track, and only between the stations of OneLine's own rail network", () => {
    const rawStates = JSON.parse(readSource("states").toString()).features.filter((f) => f.properties.adm0_a3 === "USA" && !["Alaska", "Hawaii"].includes(f.properties.name));
    const rings = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat();
    const fit = fitProjection(rawStates.flatMap((f) => rings(f.geometry).flat().map(projectContiguous)), { x: 22, y: 26, width: 748, height: 372 });
    const source = JSON.parse(readSource("routes").toString());
    // Index every projected source vertex of the audited routes.
    const grid = new Map(), key = ([x, y]) => `${Math.floor(x)},${Math.floor(y)}`;
    for (const route of audit.routes) {
      const feature = source.features.find((f) => f.properties.OBJECTID === route.objectId);
      expect(feature.properties.name).toBe(route.name);
      const lines = feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const line of lines) for (const vertex of line) {
        const xy = fit(projectContiguous(vertex));
        grid.set(key(xy), [...(grid.get(key(xy)) ?? []), xy]);
      }
    }
    const onSource = ([x, y]) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => (grid.get(`${Math.floor(x) + dx},${Math.floor(y) + dy}`) ?? []).some((v) => Math.hypot(v[0] - x, v[1] - y) <= 0.01)));
    // The drawn network is exactly the app's Amtrak sample network (LIRR is drawn separately as a schematic).
    const drawn = geometry.routes.flatMap((route) => route.edges.map((edge) => [...edge].sort().join("|"))).sort();
    const app = [...new Set(getConceptEdges("AMTRAK").filter((e) => e.agency !== "LIRR").map((e) => [e.from, e.to].sort().join("|")))].sort();
    expect(drawn).toEqual(app);
    expect(drawn).toHaveLength(22);
    for (const route of geometry.routes) {
      expect(route.paths).toHaveLength(route.edges.length);
      route.paths.forEach((path, index) => {
        const points = coordinates(path);
        expect(path.match(/M/g)).toHaveLength(1);
        // Every drawn vertex is an original federal source vertex (Douglas-Peucker keeps source vertices).
        for (const point of points) expect(onSource(point), `${route.id} ${route.edges[index]}`).toBe(true);
        // Each path runs from a station of the first city to a station of the second.
        const [from, to] = route.edges[index];
        const nearest = (city, point) => Math.min(...geometry.stations.filter((s) => s.cityId === city).map((s) => Math.hypot(s.x - point[0], s.y - point[1])));
        expect(nearest(from, points[0])).toBeLessThan(0.8);
        expect(nearest(to, points.at(-1))).toBeLessThan(0.8);
        // No detours: track length stays close to the station-to-station distance.
        let length = 0;
        for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
        expect(length / Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1])).toBeLessThan(1.5);
      });
    }
  });

  test("draws nothing beyond our cities (no Chicago, Buffalo, Brunswick or Roanoke extensions)", () => {
    const stations = geometry.stations;
    const minX = Math.min(...stations.map((s) => s.x)), minY = Math.min(...stations.map((s) => s.y));
    const maxX = Math.max(...stations.map((s) => s.x)), maxY = Math.max(...stations.map((s) => s.y));
    for (const route of geometry.routes) for (const path of route.paths) for (const [x, y] of coordinates(path)) {
      // 1.5 SVG units (sub-pixel) allows terminal track curling just past a station, e.g. Tampa Union Station.
      expect(x).toBeGreaterThanOrEqual(minX - 1.5);
      expect(x).toBeLessThanOrEqual(maxX + 1.5);
      expect(y).toBeGreaterThanOrEqual(minY - 1.5);
      expect(y).toBeLessThanOrEqual(maxY + 1.5);
    }
  });

  test("marks Stony Brook's LIRR station from its cited coordinates, linked to New York as a schematic", () => {
    const rawStates = JSON.parse(readSource("states").toString()).features.filter((f) => f.properties.adm0_a3 === "USA" && !["Alaska", "Hawaii"].includes(f.properties.name));
    const rings = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flat();
    const fit = fitProjection(rawStates.flatMap((f) => rings(f.geometry).flat().map(projectContiguous)), { x: 22, y: 26, width: 748, height: 372 });
    const [x, y] = fit(projectContiguous([audit.lirr.longitude, audit.lirr.latitude]));
    expect(geometry.lirr.cityId).toBe("stony-brook");
    expect(geometry.lirr.x).toBeCloseTo(x, 1);
    expect(geometry.lirr.y).toBeCloseTo(y, 1);
    expect(audit.lirr.source).toMatch(/^https:\/\//);
    expect(geometry.lirr.schematicFrom.code).toBe("NYP");
    // Stony Brook is on Long Island, east of Manhattan.
    expect(geometry.lirr.x).toBeGreaterThan(geometry.lirr.schematicFrom.x);
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
      // Primary boarding stations sit on the drawn track. Secondary stations in multi-station cities
      // (Boston South Station beside Back Bay; Richmond Main Street, which our trains don't use) stay sub-pixel close.
      expect(min, station.code).toBeLessThan(["BOS", "RVM"].includes(station.code) ? 0.8 : 0.15);
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
