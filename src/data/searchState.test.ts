import { describe, expect, it } from "vitest";
import {
  defaultSearch,
  newSearchPatch,
  readSearchState,
  todayInNewYork,
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
      departureDate: "2026-11-03",
      departureTime: "17:45",
      mode: "bus",
      operator: "FLIXBUS",
      order: "fastest",
      includeAmtrak: false,
    };
    const params = writeSearchState(state);
    expect(params.get("from")).toBe("New York");
    expect(params.get("to")).toBe("Washington, DC");
    expect(params.get("date")).toBe("2026-11-03");
    expect(params.get("time")).toBe("17:45");
    expect(readSearchState(new URLSearchParams(params.toString()))).toEqual(
      state,
    );
  });
  it("keeps four-digit years 0001-0099 literal and rejects five-digit years", () => {
    const read = (date: string) =>
      readSearchState(new URLSearchParams({ date })).departureDate;
    expect(read("0001-01-01")).toBe("0001-01-01");
    expect(read("0050-06-01")).toBe("0050-06-01");
    expect(read("0099-02-29")).toBe(defaultSearch.departureDate);
    expect(read("20270-01-01")).toBe(defaultSearch.departureDate);
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
  it("keeps only safely formatted planning preferences in share links", () => {
    expect(
      readSearchState(new URLSearchParams({ date: "not-a-date", time: "27:99" })),
    ).toMatchObject({
      departureDate: defaultSearch.departureDate,
      departureTime: defaultSearch.departureTime,
    });
  });
  it("resets supported search keys while preserving unrelated parameters", () => {
    const params = writeSearchState(
      defaultSearch,
      new URLSearchParams(
        "from=Boston&to=Miami&date=2026-11-03&time=17%3A45&mode=bus&operator=FLIXBUS&sort=fastest&amtrak=0&source=demo",
      ),
    );
    expect(params.toString()).toBe("source=demo");
  });
  it("validates leap days, calendar dates and clock boundaries", () => {
    expect(readSearchState(new URLSearchParams("date=2028-02-29&time=23%3A59"))).toMatchObject({ departureDate: "2028-02-29", departureTime: "23:59" });
    for (const value of ["2027-02-29", "2026-02-30", "2026-13-01", "2026-00-10", "2026-10-00"]) {
      expect(readSearchState(new URLSearchParams({ date: value })).departureDate).toBe(defaultSearch.departureDate);
    }
    for (const value of ["24:00", "23:60", "-1:00", "8:00"]) {
      expect(readSearchState(new URLSearchParams({ time: value })).departureTime).toBe(defaultSearch.departureTime);
    }
  });

  it("reconstructs different preferences for back/forward URLs even when cities match", () => {
    const first = { ...defaultSearch, departureDate: "2026-11-01", departureTime: "09:30" };
    const second = { ...first, departureDate: "2026-11-02", departureTime: "19:15" };
    const urls = [first, second].map((state) => writeSearchState(state).toString());
    expect(readSearchState(new URLSearchParams(urls[0]))).toEqual(first);
    expect(readSearchState(new URLSearchParams(urls[1]))).toEqual(second);
  });

  it("defaults the date preference to today in New York, not a fixed past date (W3)", () => {
    // 03:30 UTC on Oct 25 is still Oct 24 in New York (EDT, UTC-4).
    expect(todayInNewYork(new Date("2026-10-25T03:30:00Z"))).toBe("2026-10-24");
    expect(todayInNewYork(new Date("2026-10-25T04:30:00Z"))).toBe("2026-10-25");
    expect(todayInNewYork(new Date("2027-01-01T04:59:00Z"))).toBe("2026-12-31");
    expect(defaultSearch.departureDate).toBe(todayInNewYork());
    expect(readSearchState(new URLSearchParams()).departureDate).toBe(todayInNewYork());
    // Explicit deep links still win.
    expect(readSearchState(new URLSearchParams({ date: "2026-11-03" })).departureDate).toBe("2026-11-03");
  });

  it("clears mode/operator filters on a new search but keeps sort and preferences (W10)", () => {
    const filtered = readSearchState(
      new URLSearchParams("from=Boston&to=New+York&mode=mixed&operator=AMTRAK&amtrak=0&sort=fastest"),
    );
    const next = { ...filtered, ...newSearchPatch(" New York ", "Washington, DC", { departureDate: "2026-11-03", departureTime: "14:30" }) };
    expect(next).toMatchObject({ origin: "New York", destination: "Washington, DC", mode: "all", operator: "all", includeAmtrak: true, order: "fastest" });
    expect(writeSearchState(next).toString()).toBe("from=New+York&to=Washington%2C+DC&date=2026-11-03&time=14%3A30&sort=fastest");
  });
});
