import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import geometry from "../../data/railMap/geometry.json";
import { CorridorMap } from "./CorridorMap";
import { projectContiguous } from "./mapProjection";

function centre(name: string) {
  const state = geometry.boundaries.find((entry) => entry.name === name)!;
  const points = [...state.path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((point) => [Number(point[1]), Number(point[2])]);
  return [0, 1].map((axis) => (Math.min(...points.map((p) => p[axis])) + Math.max(...points.map((p) => p[axis]))) / 2);
}

describe("contiguous-U.S. passenger rail map", () => {
  test("refits only the 48 contiguous states plus DC, with no inset polygons or space", () => {
    expect(geometry.boundaries).toHaveLength(49);
    expect(geometry.boundaries.map((state) => state.name)).not.toContain("Alaska");
    expect(geometry.boundaries.map((state) => state.name)).not.toContain("Hawaii");
    expect(geometry.viewBox).toEqual([0, 0, 800, 420]);
    const ys = geometry.boundaries.flatMap((state) => [...state.path.matchAll(/[ML]-?[\d.]+,(-?[\d.]+)/g)].map((point) => Number(point[1])));
    // The refitted country uses the full vertical frame, not the old inset layout.
    expect(Math.min(...ys)).toBe(26);
    expect(Math.max(...ys)).toBe(398);
  });

  test("preserves north-up and west-east orientation in the actual generated boundaries", () => {
    for (const [north, south] of [["Washington", "California"], ["North Dakota", "Texas"], ["Maine", "Florida"]]) {
      expect(centre(north)[1]).toBeLessThan(centre(south)[1]);
    }
    expect(centre("California")[0]).toBeLessThan(centre("Texas")[0]);
    expect(centre("Texas")[0]).toBeLessThan(centre("Florida")[0]);
    expect(projectContiguous([-100, 48])[1]).toBeLessThan(projectContiguous([-100, 30])[1]);
    const panhandle = projectContiguous([-85.7, 30.2]), peninsula = projectContiguous([-80.5, 25.2]);
    expect(peninsula[0]).toBeGreaterThan(panhandle[0]);
    expect(peninsula[1]).toBeGreaterThan(panhandle[1]);
  });

  test("provides native keyboard-accessible evidence and honest rail/coverage descriptions", () => {
    const html = renderToStaticMarkup(<CorridorMap />);
    expect(html).toContain("<summary>Corridors, cities &amp; coverage gaps</summary>");
    expect(html).toContain("Amtrak track between our cities");
    expect(html).toContain("LIRR to Stony Brook (track not drawn)");
    expect(html).toContain("track beyond our cities is not drawn");
    expect(html).toContain(`data-station-code="${geometry.lirr.id}"`);
    expect(html).toContain(`d="M${geometry.lirr.x},${geometry.lirr.y}h0"`);
    expect(html).not.toContain("generalized rail alignment");
    expect(html).toContain("Stony Brook");
    expect(html).toContain("MTA station details · alignment not mapped");
    expect(html).toContain("These lines do not change the sample itineraries");
    expect(html).toContain("Not shown on this map");
    expect(html).toContain("This rail-only view includes only the corridors in the legend.");
    expect(html).toContain("Coach services use roads, so they are outside this rail layer.");
    expect(html).toContain("Boarding notes:");
    expect(html).toContain("North Station");
    expect(html).toContain("not a timetable");
    expect(html).not.toContain("us-map-inset");
    expect(html).not.toContain("<image");
  });

  test("draws one constant-size marker per bundled station and labels only real station positions", () => {
    const html = renderToStaticMarkup(<CorridorMap />);
    const markers = [...html.matchAll(/data-station-code="([A-Z]+)"/g)].map((match) => match[1]);
    expect(markers).toEqual(geometry.stations.map((station) => station.code));
    // Each marker is a zero-length, round-capped, non-scaling stroke drawn exactly at the station coordinate.
    for (const station of geometry.stations) {
      expect(html).toContain(`d="M${station.x},${station.y}h0" vector-effect="non-scaling-stroke"`);
    }
    // Labels are decorative HTML (hidden from assistive tech; the SVG description and details carry the content).
    const labels = html.match(/<ul class="prm-labels" aria-hidden="true">(.*?)<\/ul>/)?.[1] ?? "";
    for (const name of ["Boston", "New York", "Washington", "Charlotte", "Savannah", "Tampa", "Miami"]) expect(labels).toContain(`>${name}</li>`);
    const positions = [...labels.matchAll(/left:([\d.]+)%;top:([\d.]+)%/g)];
    expect(positions).toHaveLength(7);
    for (const [, x, y] of positions) {
      expect(geometry.stations.some((s) => Math.abs((s.x / 800) * 100 - Number(x)) < 1e-9 && Math.abs((s.y / 420) * 100 - Number(y)) < 1e-9)).toBe(true);
    }
  });

  test("keeps the opened audit in a bounded, keyboard-focusable, named region", () => {
    const html = renderToStaticMarkup(<CorridorMap />);
    expect(html).toContain('<div class="prm-details-content" role="region" aria-label="Corridor, city and coverage-gap details" tabindex="0">');
  });

  test("keeps map and description IDs unique for multiple instances", () => {
    const html = renderToStaticMarkup(<><CorridorMap /><CorridorMap /></>);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
