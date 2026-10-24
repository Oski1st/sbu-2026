import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import overview from "../../data/usOverviewMap.json";
import { CorridorMap } from "./CorridorMap";

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
  });
});
