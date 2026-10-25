import { describe, expect, test } from "vitest";
import { originalDemoTrips } from "../../data/originalDemoTrips";
import {
  commuterOfficialTicketPages,
  commuterPurchaseLink,
  findCommuterStation,
  type CommuterOperator,
} from "./commuter";

// Formats below were opened in Chromium on 2026-10-25 and showed the stations pre-filled.
describe("commuterPurchaseLink", () => {
  test("SEPTA deep-links the trip planner with stations and date", () => {
    expect(
      commuterPurchaseLink("SEPTA", "Philadelphia · 30th Street", "Trenton Transit Center", "2026-10-27"),
    ).toEqual({
      href: "https://plan.septa.org/#/?fromPlace=Gray%2030th%20St%20Station%3A%3A39.95667%2C-75.18166&toPlace=Trenton%20Transit%20Center%3A%3A40.21851%2C-74.75393&date=2026-10-27&mode=WALK%2CTRANSIT",
      kind: "exact-trip-planner",
      note: expect.stringContaining("Gray 30th St Station → Trenton Transit Center on 2026-10-27"),
    });
  });

  test("NJ TRANSIT opens WebTicketing with both stations pre-selected, in either direction", () => {
    const out = commuterPurchaseLink("NJ_TRANSIT", "Trenton Transit Center", "New York Penn Station", "2026-10-27");
    expect(out).toMatchObject({
      href: "https://webtickets.njtransit.com/?origin=180&destination=0",
      kind: "exact-purchase",
    });
    expect(out.note).toContain("valid 30 days");
    expect(commuterPurchaseLink("NJ_TRANSIT", "New York Penn Station", "Trenton", "2026-10-27").href).toBe(
      "https://webtickets.njtransit.com/?origin=0&destination=180",
    );
  });

  test("LIRR falls back to the official TrainTime page and names the stations", () => {
    const out = commuterPurchaseLink("LIRR", "New York Penn Station", "Huntington", "2026-10-27");
    expect(out).toMatchObject({ href: "https://www.mta.info/traintime", kind: "official-ticket-page" });
    expect(out.note).toContain("Penn Station → Huntington for 2026-10-27");
    expect(commuterPurchaseLink("LIRR", "Huntington", "Stony Brook", "2026-10-27").note).toContain(
      "Huntington → Stony Brook",
    );
  });

  test("every commuter leg in the original demo trips resolves to mapped stations", () => {
    const legs = originalDemoTrips
      .flatMap((trip) => trip.legs)
      .filter((leg) => ["SEPTA", "NJ_TRANSIT", "LIRR"].includes(leg.agency));
    expect(legs.length).toBeGreaterThan(0);
    for (const leg of legs) {
      const operator = leg.agency as CommuterOperator;
      expect(findCommuterStation(operator, leg.from), `${operator} ${leg.from}`).toBeDefined();
      expect(findCommuterStation(operator, leg.to), `${operator} ${leg.to}`).toBeDefined();
      const out = commuterPurchaseLink(operator, leg.from, leg.to, leg.departure.slice(0, 10));
      expect(out.kind).toBe(operator === "LIRR" ? "official-ticket-page" : operator === "SEPTA" ? "exact-trip-planner" : "exact-purchase");
    }
  });

  test("city-level concept LIRR legs (New York ↔ Stony Brook) resolve", () => {
    expect(commuterPurchaseLink("LIRR", "Stony Brook", "New York", "2026-10-24").note).toContain(
      "Stony Brook → Penn Station",
    );
  });

  test("unmapped stations, same station and bad SEPTA dates fall back to the official page", () => {
    for (const operator of ["SEPTA", "NJ_TRANSIT", "LIRR"] as const) {
      const unknown = commuterPurchaseLink(operator, "Nowhere Junction", "Trenton", "2026-10-27");
      expect(unknown).toMatchObject({ href: commuterOfficialTicketPages[operator], kind: "official-ticket-page" });
      expect(unknown.note).toContain("Nowhere Junction");
    }
    expect(commuterPurchaseLink("NJ_TRANSIT", "Trenton", "Trenton Transit Center", "2026-10-27").kind).toBe(
      "official-ticket-page",
    );
    for (const bad of ["2026-02-30", "10/27/2026", ""]) {
      expect(commuterPurchaseLink("SEPTA", "30th Street", "Trenton", bad)).toMatchObject({
        href: "https://www.septa.org/fares/",
        kind: "official-ticket-page",
      });
    }
  });

  test("generated links carry no session or search tokens", () => {
    const hrefs = [
      commuterPurchaseLink("SEPTA", "30th Street", "Trenton", "2026-10-27").href,
      commuterPurchaseLink("NJ_TRANSIT", "Trenton", "NY Penn", "2026-10-27").href,
    ];
    for (const href of hrefs) expect(href).not.toMatch(/ui_activeSearch|session|token|sid=/i);
  });
});
