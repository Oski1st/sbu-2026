import { describe, expect, it } from "vitest";
import { demoTrips as allDemoTrips } from "./demoTrips";
const demoTrips = allDemoTrips.filter((trip) =>
  ["regional-connection", "amtrak-connection"].includes(trip.id),
);
import {
  findTrips,
  sampleTotal,
  sortTrips,
  transferCount,
  tripMetrics,
  compareTrips,
} from "./tripUtils";
describe("original Philadelphia demo route planning", () => {
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

describe("route comparison", () => {
  it("separates time on trains from connection intervals", () => {
    const regional = tripMetrics(demoTrips[0])!;
    const express = tripMetrics(demoTrips[1])!;
    expect(regional).toEqual({
      rideMinutes: 265,
      transferMinutes: 50,
      shortestTransferMinutes: 15,
    });
    expect(express).toEqual({
      rideMinutes: 205,
      transferMinutes: 45,
      shortestTransferMinutes: 20,
    });
    for (const trip of demoTrips) {
      const metrics = tripMetrics(trip)!;
      expect(metrics.rideMinutes + metrics.transferMinutes).toBe(
        trip.durationMinutes,
      );
    }
  });
  it("compares both input orders consistently without assuming unknown fares", () => {
    for (const pair of [
      [demoTrips[0], demoTrips[1]],
      [demoTrips[1], demoTrips[0]],
    ]) {
      const result = compareTrips(pair[0], pair[1]);
      expect(result.faster.id).toBe("amtrak-connection");
      expect(result.minutesSaved).toBe(65);
      expect(result.fareDifference).toBe(15);
      expect(result.transfersSaved).toBe(1);
    }
    const unknownFare = {
      ...demoTrips[1],
      legs: demoTrips[1].legs.map((leg) => ({ ...leg, fare: undefined })),
    };
    expect(compareTrips(demoTrips[0], unknownFare).fareDifference).toBeNull();
  });
  it("does not present connection metrics for invalid or overlapping timestamps", () => {
    expect(tripMetrics({ ...demoTrips[0], legs: [] })).toBeNull();
    expect(sampleTotal({ ...demoTrips[0], legs: [] })).toBeNull();
    const invalid = {
      ...demoTrips[0],
      legs: demoTrips[0].legs.map((leg, index) =>
        index ? leg : { ...leg, arrival: "not-a-date" },
      ),
    };
    expect(tripMetrics(invalid)).toBeNull();
    const overlap = {
      ...demoTrips[0],
      legs: demoTrips[0].legs.map((leg, index) =>
        index === 1
          ? { ...leg, departure: demoTrips[0].legs[0].departure }
          : leg,
      ),
    };
    expect(tripMetrics(overlap)).toBeNull();
  });
});
