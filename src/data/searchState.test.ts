import { describe, expect, it } from "vitest";
import {
  defaultSearch,
  readSearchState,
  writeSearchState,
} from "./searchState";

describe("search URL state", () => {
  it("restores the original demo for an empty URL", () => {
    expect(readSearchState(new URLSearchParams())).toEqual(defaultSearch);
    expect(writeSearchState(defaultSearch).toString()).toBe("");
  });
  it("round-trips city names, all filters and sorting across refresh links", () => {
    const state = {
      origin: "New York",
      destination: "Washington, DC",
      mode: "bus",
      operator: "FLIXBUS",
      order: "fastest",
      includeAmtrak: false,
    };
    const params = writeSearchState(state);
    expect(params.get("from")).toBe("New York");
    expect(params.get("to")).toBe("Washington, DC");
    expect(readSearchState(new URLSearchParams(params.toString()))).toEqual(
      state,
    );
  });
  it("rejects unknown filters and bounds city values without inventing supported cities", () => {
    const state = readSearchState(
      new URLSearchParams({
        from: "  Atlantis  ",
        to: " ",
        mode: "plane",
        operator: "__proto__",
        sort: "malicious",
        amtrak: "invalid",
      }),
    );
    expect(state).toEqual({ ...defaultSearch, origin: "Atlantis" });
    expect(
      readSearchState(new URLSearchParams({ from: "x".repeat(101) })).origin,
    ).toHaveLength(100);
  });
  it("resets supported search keys while preserving unrelated parameters", () => {
    const params = writeSearchState(
      defaultSearch,
      new URLSearchParams(
        "from=Boston&to=Miami&mode=bus&operator=FLIXBUS&sort=fastest&amtrak=0&source=demo",
      ),
    );
    expect(params.toString()).toBe("source=demo");
  });
});
