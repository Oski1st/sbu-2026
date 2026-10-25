import { describe, expect, it } from "vitest";
import { demoTrips as allDemoTrips } from "./demoTrips";
const demoTrips = allDemoTrips.filter((trip) =>
  ["regional-connection", "amtrak-connection"].includes(trip.id),
);
import {
  findTrips,
  formatMoney,
  sampleTotal,
  sortTrips,
  transferCount,
  tripMetrics,
  compareTrips,
  formatDuration,
} from "./tripUtils";
import { planTrips } from "./tripLookup";
describe("arrival-based ranking for generated concepts", () => {
  it("ranks Fastest and the comparison by final arrival, not ride length", () => {
    // Coach concepts start 30-60 minutes later, so a slightly shorter ride can still arrive later.
    // Portland-Boston: coach 135 min from 8:30 vs Downeaster 150 min from 8:00.
    const trips = planTrips("Portland, ME", "Boston");
    const fastest = sortTrips(trips, "fastest");
    const arrivals = fastest.map((trip) => +new Date(trip.legs.at(-1)!.arrival));
    expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
    const rail = trips.find((trip) => trip.id.endsWith("--amtrak"))!;
    const coach = trips.find((trip) => trip.id.endsWith("--greyhound"))!;
    expect(coach.durationMinutes).toBeLessThan(rail.durationMinutes);
    const result = compareTrips(coach, rail);
    expect(result.faster.id).toBe(rail.id);
    expect(result.minutesSaved).toBe(
      (+new Date(coach.legs.at(-1)!.arrival) - +new Date(rail.legs.at(-1)!.arrival)) / 60000,
    );
  });
  it("formats sub-hour durations without a 0h prefix", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(60)).toBe("1h 0m");
    expect(formatDuration(1800)).toBe("30h 0m");
  });
});
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
    // Official run times: SEPTA 52, NJ TRANSIT 90, LIRR 73 + 9-minute Huntington change + 35.
    expect(regional).toEqual({
      rideMinutes: 250,
      transferMinutes: 47,
      shortestTransferMinutes: 9,
    });
    expect(express).toEqual({
      rideMinutes: 188,
      transferMinutes: 29,
      shortestTransferMinutes: 9,
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
      // Express arrives 12:07 PM vs 12:57 PM: 50 minutes sooner. That is arrival, not ride time:
      // the express is 62 minutes shorter on board and its whole journey is 80 minutes shorter.
      expect(result.minutesSaved).toBe(50);
      expect(result.slower.durationMinutes - result.faster.durationMinutes).toBe(80);
      // $61 vs $47.35 ($11 SEPTA + $20.35 NJ TRANSIT + $16 LIRR off-peak).
      expect(result.fareDifference).toBeCloseTo(13.65, 2);
      expect(result.transfersSaved).toBe(1);
    }
    // The express card's copy must match the data it summarises.
    const onBoardGap = tripMetrics(demoTrips[0])!.rideMinutes - tripMetrics(demoTrips[1])!.rideMinutes;
    const fareGap = compareTrips(demoTrips[0], demoTrips[1]).fareDifference!;
    expect(demoTrips[1].description).toBe(
      `Amtrak to New York, then LIRR. ${onBoardGap} minutes less time on board, ${formatMoney(fareGap)} more in sample fares.`,
    );
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
