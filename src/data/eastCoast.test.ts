import { describe, expect, it } from "vitest";
import { demoTrips } from "./demoTrips";
import { cities, resolveCity } from "./eastCoast";
import { agencies } from "./agencies";
import {
  findTrips,
  formatJourneyTime,
  sampleTotal,
  tripMetrics,
} from "./tripUtils";

describe("East Coast sample planning", () => {
  it("resolves aliases and state-qualified cities without matching arbitrary places", () => {
    expect(resolveCity("  NYC ")?.name).toBe("New York");
    expect(resolveCity("Washington DC")?.state).toBe("DC");
    expect(resolveCity("Portland, ME")?.state).toBe("ME");
    expect(resolveCity("Portland, OR")).toBeUndefined();
    expect(findTrips(demoTrips, "NYC", "Boston, MA")).toHaveLength(3);
    expect(findTrips(demoTrips, "Boston", "Atlantis")).toEqual([]);
    expect(findTrips(demoTrips, "New York", "NYC")).toEqual([]);
  });
  it("preserves both original demo itineraries and their stable ordering", () => {
    expect(
      findTrips(demoTrips, "Philadelphia", "Stony Brook").map((t) => t.id),
    ).toEqual(["regional-connection", "amtrak-connection"]);
    expect(demoTrips.slice(0, 2).map((t) => t.durationMinutes)).toEqual([
      315, 250,
    ]);
  });
  it("offers bidirectional Maine-to-Florida concepts and genuine bus operator identities", () => {
    for (const [from, to] of [
      ["Portland", "Miami"],
      ["Miami", "Portland"],
      ["Raleigh", "Charlotte"],
      ["Boston", "Orlando"],
    ]) {
      const trips = findTrips(demoTrips, from, to);
      expect(trips).toHaveLength(3);
      expect(
        new Set(trips.flatMap((t) => t.legs.map((l) => l.agency))),
      ).toEqual(new Set(["AMTRAK", "GREYHOUND", "FLIXBUS"]));
    }
  });
  it("has connected sample coverage for every catalogue city, unique stable IDs and no unknown fares invented", () => {
    expect(new Set(demoTrips.map((t) => t.id)).size).toBe(demoTrips.length);
    for (const city of cities)
      expect(demoTrips.some((t) => t.origin === city.name)).toBe(true);
    for (const trip of demoTrips.filter((t) => t.id.startsWith("east-"))) {
      expect(trip.dataStatus).toBe("sample");
      expect(trip.planningNote).toContain("not verified services");
      expect(sampleTotal(trip)).toBeNull();
      expect(trip.durationMinutes).toBe(
        (Date.parse(trip.legs.at(-1)!.arrival) -
          Date.parse(trip.legs[0].departure)) /
          60000,
      );
      expect(tripMetrics(trip)).not.toBeNull();
      trip.legs.forEach((leg, i) => {
        expect(leg.mode).toBe(agencies[leg.agency].mode);
        expect(new URL(leg.purchaseUrl).protocol).toBe("https:");
        if (i) {
          expect(trip.legs[i - 1].to).toBe(leg.from);
          expect(Date.parse(leg.departure)).toBeGreaterThan(
            Date.parse(trip.legs[i - 1].arrival),
          );
        }
      });
    }
  });
  it("resolves mixed bus/rail concepts through the same exported Trip catalogue", () => {
    const trip = findTrips(demoTrips, "Boston", "Stony Brook").find((t) =>
      t.legs.some((l) => l.agency === "FLIXBUS"),
    )!;
    expect(trip.legs.some((l) => l.agency === "LIRR")).toBe(true);
    expect(demoTrips.find((t) => t.id === trip.id)).toBe(trip);
    expect(agencies.FLIXBUS.purchaseUrl).toBe("https://www.flixbus.com/");
    expect(agencies.GREYHOUND.purchaseUrl).toBe("https://www.greyhound.com/");
  });
  it("shows arrival calendar dates when a journey crosses midnight", () => {
    const trip = findTrips(demoTrips, "Portland", "Miami")[0];
    expect(
      formatJourneyTime(trip.legs.at(-1)!.arrival, trip.legs[0].departure),
    ).toContain("Oct 25");
    expect(
      formatJourneyTime("2026-10-24T13:00:00Z", "2026-10-24T12:00:00Z"),
    ).not.toContain("Oct");
  });
});

import { addMinutes, differenceInMinutes, legDuration } from "../components/journey/journeyUtils";
import { officialPurchaseUrl } from "../components/wallet/ticketing";

describe("expanded operator integration boundaries", () => {
  it("counts full multi-day timestamps instead of wrapping at midnight", () => {
    expect(differenceInMinutes("2026-10-24T08:00:00-04:00", "2026-10-26T10:00:00-04:00")).toBe(3000);
    expect(differenceInMinutes("2026-10-26T10:00:00-04:00", "2026-10-24T08:00:00-04:00")).toBeNull();
    expect(addMinutes("2026-10-24T23:55:00-04:00", 12)).toBe("2026-10-25T04:07:00.000Z");
    const leg = { ...demoTrips[0].legs[0], departure: "2026-10-24T08:00:00-04:00", arrival: "2026-10-26T10:00:00-04:00" };
    expect(legDuration(leg)).toBe("50h");
  });
  it("restricts bus ticket links to each operator's HTTPS domains", () => {
    for (const [agency, url] of [["GREYHOUND", "https://www.greyhound.com/"], ["FLIXBUS", "https://www.flixbus.com/"]] as const) {
      expect(officialPurchaseUrl(agency, url)).toBe(url);
      for (const unsafe of ["https://evil.example/", "https://greyhound.com.evil.example/", "javascript:alert(1)", "https://user:pass@www.flixbus.com/", "http://www.greyhound.com/"]) {
        expect(officialPurchaseUrl(agency, unsafe)).toBe(url);
      }
    }
  });
});
