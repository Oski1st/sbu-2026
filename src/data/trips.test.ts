import { describe, expect, it } from "vitest";
import { demoTrips } from "./demoTrips";
import { findTrips, sampleTotal, sortTrips, transferCount } from "./tripUtils";
describe("demo route planning", () => {
  it("matches the demo corridor case-insensitively and trims whitespace", () => {
    expect(
      findTrips(demoTrips, "  PHILADELPHIA ", "stony   brook"),
    ).toHaveLength(2);
    expect(findTrips(demoTrips, "Stony Brook", "Philadelphia")).toEqual([]);
    expect(findTrips(demoTrips, "New York", "Stony Brook")).toEqual([]);
  });
  it("sorts by duration and complete sample fare without mutating the shared data", () => {
    expect(sortTrips(demoTrips, "fastest")[0].id).toBe("amtrak-connection");
    expect(sortTrips(demoTrips, "fare")[0].id).toBe("regional-connection");
    expect(demoTrips[0].id).toBe("regional-connection");
    expect(
      sampleTotal({
        ...demoTrips[0],
        legs: [{ ...demoTrips[0].legs[0], fare: undefined }],
      }),
    ).toBeNull();
  });
  it("keeps all journeys explicitly sample and models every actual train change", () => {
    for (const trip of demoTrips) {
      expect(trip.dataStatus).toBe("sample");
      expect(transferCount(trip)).toBe(trip.legs.length - 1);
      const elapsed =
        (+new Date(trip.legs.at(-1)!.arrival) -
          +new Date(trip.legs[0].departure)) /
        60000;
      expect(elapsed).toBe(trip.durationMinutes);
      expect(trip.legs.at(-1)?.from).toBe("Huntington");
      expect(trip.legs.at(-1)?.to).toBe("Stony Brook");
      trip.legs.forEach((leg, i) => {
        expect(+new Date(leg.arrival)).toBeGreaterThan(
          +new Date(leg.departure),
        );
        expect(leg.fare?.status).toBe("sample");
        expect(new URL(leg.purchaseUrl).protocol).toBe("https:");
        if (i > 0) {
          expect(trip.legs[i - 1].to).toBe(leg.from);
          expect(+new Date(leg.departure)).toBeGreaterThan(
            +new Date(trip.legs[i - 1].arrival),
          );
        }
      });
    }
  });
  it("includes all four supported agencies across the available options", () => {
    expect(
      new Set(demoTrips.flatMap((trip) => trip.legs.map((leg) => leg.agency))),
    ).toEqual(new Set(["SEPTA", "NJ_TRANSIT", "LIRR", "AMTRAK"]));
  });
});
