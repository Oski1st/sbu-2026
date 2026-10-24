import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import overview from "../../data/usOverviewMap.json";
import { CorridorMap } from "./CorridorMap";
import { projectContiguous, projectInset } from "./mapProjection";

function boundaryPoints(name: string) {
  const state = [...overview.contiguous, ...overview.alaska, ...overview.hawaii].find((item) => item.name === name);
  if (!state) throw new Error(`Missing boundary: ${name}`);
  return [...state.path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)]
    .map((match) => [Number(match[1]), Number(match[2])] as const);
}

function boundaryCentre(name: string) {
  const points = boundaryPoints(name);
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

describe("CorridorMap nationwide overview", () => {
  test("bundles all state boundaries with clear Alaska and Hawaii insets", () => {
    expect(overview.contiguous).toHaveLength(49);
    expect(overview.alaska).toHaveLength(1);
    expect(overview.hawaii).toHaveLength(1);
    expect(overview.source).toContain("Natural Earth");
  });

  test("does not present state geography as nationwide service or routes", () => {
    const html = renderToStaticMarkup(<CorridorMap />);

    expect(html).toContain("ALASKA");
    expect(html).toContain("HAWAII");
    expect(html).toContain("no nationwide service lines shown");
    expect(html).toContain("no nationwide connections are implied");
    expect(html).toContain("not a route, schedule, or service-coverage map");
    expect(html).toContain("Alaska and Hawaii: geographic insets, not to scale.");
  });

  test("bundled state geometry places northern states above southern states", () => {
    for (const [north, south] of [["Washington", "California"], ["North Dakota", "Texas"], ["Maine", "Florida"]]) {
      expect(boundaryCentre(north)[1]).toBeLessThan(boundaryCentre(south)[1]);
    }
    expect(boundaryCentre("California")[0]).toBeLessThan(boundaryCentre("Texas")[0]);
    expect(boundaryCentre("Texas")[0]).toBeLessThan(boundaryCentre("Florida")[0]);
  });

  test("Albers SVG projection points north up and retains west-east ordering", () => {
    expect(projectContiguous([-100, 48])[1]).toBeLessThan(projectContiguous([-100, 30])[1]);
    expect(projectContiguous([-120, 40])[0]).toBeLessThan(projectContiguous([-75, 40])[0]);
    // Florida's peninsula extends south and east from its panhandle.
    const panhandle = projectContiguous([-85.7, 30.2]);
    const peninsula = projectContiguous([-80.5, 25.2]);
    expect(peninsula[1]).toBeGreaterThan(panhandle[1]);
    expect(peninsula[0]).toBeGreaterThan(panhandle[0]);
  });

  test("both inset projections put northern points above southern points", () => {
    // Alaska: Utqiagvik above Anchorage; Hawaii: Kauai above the Big Island.
    expect(projectInset([-156.8, 71.3])[1]).toBeLessThan(projectInset([-149.9, 61.2])[1]);
    expect(projectInset([-159.5, 22.1])[1]).toBeLessThan(projectInset([-155.5, 19.6])[1]);
    expect(projectInset([179, 52])[0]).toBeLessThan(projectInset([-170, 52])[0]);
    for (const [name, left, right] of [["Alaska", 42, 312], ["Hawaii", 380, 580]] as const) {
      for (const [x, y] of boundaryPoints(name)) {
        expect(x).toBeGreaterThanOrEqual(left - 0.1);
        expect(x).toBeLessThanOrEqual(right + 0.1);
        expect(y).toBeGreaterThanOrEqual(443.9);
        expect(y).toBeLessThanOrEqual(554.1);
      }
    }
  });
});
