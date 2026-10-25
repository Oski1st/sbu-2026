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
  formatDuration,
  formatTime,
  shiftSampleTimeline,
} from "./tripUtils";
import { planTrips } from "./tripLookup";
describe("arrival-based ranking for generated concepts", () => {
  it("ranks Fastest and the comparison by final arrival, not ride length", () => {
    // Coach concepts start 30-60 minutes later, so a slightly shorter ride can still arrive later.
    const trips = planTrips("Albany", "Boston");
    const fastest = sortTrips(trips, "fastest");
    const arrivals = fastest.map((trip) => +new Date(trip.legs.at(-1)!.arrival));
    expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
    const rail = trips.find((trip) => trip.id.endsWith("--amtrak"))!;
    const coach = trips.find((trip) => trip.id.endsWith("--greyhound"))!;
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
  it("shifts all displayed sample alternatives from one selected Eastern planning preference", () => {
    const [regional, express] = demoTrips.map((trip) => shiftSampleTimeline(trip, "2026-11-03", "16:30"));
    expect(formatTime(regional.legs[0].departure)).toBe("4:30 PM");
    // Alternatives keep their sample stagger rather than pretending that both depart at the same instant.
    expect(formatTime(express.legs[0].departure)).toBe("5:00 PM");
    expect(regional.durationMinutes).toBe(demoTrips[0].durationMinutes);
    expect(+new Date(regional.legs.at(-1)!.arrival) - +new Date(regional.legs[0].departure)).toBe(regional.durationMinutes * 60_000);
    expect(demoTrips[0].legs[0].departure).toContain("2026-10-24");
  });
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
      // Express arrives 12:40 PM vs 1:15 PM: 35 minutes sooner (ride is 65 minutes shorter).
      expect(result.minutesSaved).toBe(35);
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
