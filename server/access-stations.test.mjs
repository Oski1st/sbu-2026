import { describe, it, expect } from "vitest";
import {
  ACCESS_POLICY,
  chooseAccessStations,
  roundKm,
  stationsInRange,
  straightLineKm,
} from "./access-stations.mjs";
import { createTimetableEngine } from "./timetable-engine.mjs";

describe("nearest published station selection", () => {
  it("uses great-circle km and a named radius/candidate policy", () => {
    // Philadelphia 30th St to New York Penn is ~130 km straight-line.
    const km = straightLineKm(
      { latitude: 39.9557, longitude: -75.182 },
      { latitude: 40.7506, longitude: -73.9935 },
    );
    expect(km).toBeGreaterThan(125);
    expect(km).toBeLessThan(135);
    expect(ACCESS_POLICY).toEqual({ radiusKm: 100, maxStations: 3 });
    expect(Object.isFrozen(ACCESS_POLICY)).toBe(true);
    expect(roundKm(0.2)).toBe(1);
    expect(roundKm(45.6)).toBe(46);
  });
  it("orders by distance, breaks exact ties by ID, and excludes out-of-range or invalid points", () => {
    const stops = {
      far: { latitude: 41.5, longitude: -75 },
      b: { latitude: 40.1, longitude: -75 },
      a: { latitude: 40.1, longitude: -75 },
      near: { latitude: 40.05, longitude: -75 },
      broken: { latitude: Number.NaN, longitude: -75 },
    };
    const lookup = (id) => stops[id];
    const point = { latitude: 40, longitude: -75 };
    expect(
      stationsInRange(point, ["far", "b", "a", "near", "broken"], lookup).map(
        (s) => s.id,
      ),
    ).toEqual(["near", "a", "b"]);
    expect(stationsInRange(null, ["a"], lookup)).toEqual([]);
    expect(stationsInRange({ latitude: 95, longitude: 0 }, ["a"], lookup)).toEqual([]);
    expect(stationsInRange(point, ["far"], lookup)).toEqual([]);
  });
  it("reports every honest outcome and caps candidates", () => {
    const inRange = ["s1", "s2", "s3", "s4", "s5"].map((id, i) => ({ id, km: 10 + i }));
    const base = {
      inRange,
      covered: () => true,
      included: () => true,
      otherStationIds: [],
      distanceTo: () => Infinity,
    };
    expect(chooseAccessStations({ ...base, inRange: [] }).status).toBe("none-in-range");
    expect(chooseAccessStations({ ...base, covered: () => false }).status).toBe("outside-snapshot");
    expect(chooseAccessStations({ ...base, included: () => false }).status).toBe("filtered-out");
    const ok = chooseAccessStations(base);
    expect(ok.status).toBe("ok");
    expect(ok.stations.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    // The other place's own station is excluded, and only stations nearer than it remain.
    const other = chooseAccessStations({
      ...base,
      otherStationIds: ["s3"],
      distanceTo: () => 12,
    });
    expect(other.stations.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(
      chooseAccessStations({ ...base, otherStationIds: ["x"], distanceTo: () => 5 }).status,
    ).toBe("no-useful-leg");
  });
});

// Engine-level access legs on a small deterministic fixture.
const date = "2026-10-26",
  now = () => Date.parse("2026-10-25T12:00:00Z");
const stop = (id, latitude, longitude) => ({
  id,
  name: "Station " + id,
  timezone: "America/New_York",
  url: "",
  latitude,
  longitude,
});
function fixture() {
  const trip = (id, stops) => ({
    id,
    service: "daily",
    routeId: "r" + id,
    name: "Route " + id,
    number: id,
    agencyName: "Fixture rail",
    mode: "rail",
    stops: stops.map(([s, t]) => [s, t, t, 0, 0]),
  });
  return {
    version: "access1",
    limits: [],
    cities: [
      { id: "a", name: "Alpha", state: "PA", aliases: [] },
      { id: "c", name: "Charlie", state: "NY", aliases: [] },
      { id: "q", name: "Quaker", state: "PA", aliases: [] },
      { id: "n", name: "Neighbour", state: "PA", aliases: [] },
      { id: "far", name: "Faraway", state: "PA", aliases: [] },
      { id: "nopoint", name: "Pointless", state: "PA", aliases: [] },
    ],
    cityStops: { a: ["f:A"], c: ["f:C"] },
    links: [],
    feeds: [
      {
        id: "f",
        operator: "AMTRAK",
        timezone: "America/New_York",
        sourceUrl: "https://agency.example/feed.zip",
        checkedAt: "2026-10-25T00:00:00Z",
        sha256: "a".repeat(64),
        version: "1",
        startDate: "20261025",
        endDate: "20261130",
        // P and P2 are near Quaker; A belongs to Alpha; C to Charlie.
        stops: {
          A: stop("A", 39.95, -75.18),
          P: stop("P", 40.1, -75.5),
          P2: stop("P2", 40.05, -75.0),
          C: stop("C", 40.75, -73.99),
        },
        calendar: [
          {
            service_id: "daily",
            start_date: "20261025",
            end_date: "20261130",
            monday: "1",
            tuesday: "1",
            wednesday: "1",
            thursday: "1",
            friday: "1",
            saturday: "1",
            sunday: "1",
          },
        ],
        exceptions: [],
        transfers: [],
        trips: [
          trip("1", [["P", 9 * 3600], ["A", 9.5 * 3600], ["C", 11 * 3600]]),
          trip("2", [["C", 13 * 3600], ["A", 14.5 * 3600], ["P", 15 * 3600]]),
          trip("3", [["P2", 10 * 3600], ["A", 10.3 * 3600]]),
        ],
      },
    ],
  };
}
const places = [
  { id: "a", latitude: 39.95, longitude: -75.16 },
  { id: "c", latitude: 40.71, longitude: -74.0 },
  {
    id: "q",
    latitude: 40.44,
    longitude: -75.35,
    listings: [{ operator: "FLIXBUS", url: "https://www.flixbus.com/bus/quakertown-pa" }],
  },
  { id: "n", latitude: 40.45, longitude: -75.34 },
  { id: "far", latitude: 47.6, longitude: -122.3, listings: [] },
];
const engine = (data = fixture()) => createTimetableEngine(data, { now, places });

describe("unscheduled access legs for places without a timetable stop", () => {
  it("plans from the nearest real stations and labels the access step without times", () => {
    const r = engine().plan({ fromId: "q", toId: "c", date, time: "07:00" });
    expect(r.reason).toBeUndefined();
    expect(r.access.origin.status).toBe("ok");
    // A (Alpha's own station) is also a real published station within range.
    expect(r.access.origin.stations.map((s) => s.stationId)).toEqual(["f:P", "f:P2", "f:A"]);
    expect(r.access.origin.listings).toEqual(places[2].listings);
    expect(r.access).toMatchObject({ radiusKm: 100, scheduled: false });
    expect(r.access.destination).toBeNull();
    const first = r.itineraries[0];
    const used = first.legs[0].fromStop;
    expect(["f:P", "f:A"]).toContain(used);
    expect(first.access.before.straightLineKm).toBe(
      roundKm(straightLineKm(places[2], fixture().feeds[0].stops[used.slice(2)])),
    );
    expect(first.access.before).toMatchObject({
      place: "Quaker, PA",
      station: { stationId: used },
      scheduled: false,
      distanceReference: "catalogue-representative-point",
    });
    expect(first.access.before.straightLineKm).toBeGreaterThan(30);
    expect(first.access.after).toBeNull();
    // No times, fares, durations or modes are produced for the access step.
    for (const key of ["departure", "arrival", "durationMinutes", "fare", "mode"])
      expect(first.access.before).not.toHaveProperty(key);
    // The planned timetable legs are unchanged source events.
    expect(first.legs.map((l) => l.tripId)).toEqual(["1"]);
  });
  it("supports a destination without a stop and reconstructs the same access choice from the ID", () => {
    const e = engine();
    const r = e.plan({ fromId: "c", toId: "q", date, time: "12:00" });
    const trip = r.itineraries[0];
    expect(trip.access.before).toBeNull();
    expect(trip.access.after.station.stationId).toBe(trip.legs.at(-1).toStop);
    const payload = JSON.parse(Buffer.from(trip.id.slice(4), "base64url"));
    // P2 has no published drop-off, so it is not a destination candidate.
    expect(payload.access).toEqual([null, ["f:P", "f:A"]]);
    // Same train reaches A before P: the earlier arrival dominates (engine rule unchanged).
    for (const t of r.itineraries)
      expect(t.access.after.station.stationId).toBe("f:A");
    expect(engine().itinerary(trip.id).itinerary).toEqual(trip);
    const tamper = (access) =>
      "tt1-" + Buffer.from(JSON.stringify({ ...payload, access })).toString("base64url");
    for (const bad of [[["f:C"], null], [null, ["f:C"]], [null, []], "x", [null, ["f:P", "f:P", "f:P2"]]])
      expect(() => engine().itinerary(tamper(bad))).toThrow(/Invalid itinerary/);
  });
  it("keeps mapped-city results free of access fields", () => {
    const r = engine().plan({ fromId: "a", toId: "c", date, time: "07:00" });
    expect(r).not.toHaveProperty("access");
    expect(r.itineraries[0]).not.toHaveProperty("access");
    expect(JSON.parse(Buffer.from(r.itineraries[0].id.slice(4), "base64url"))).not.toHaveProperty("access");
  });
  it("explains a place with no station in range instead of inventing a route", () => {
    const r = engine().plan({ fromId: "far", toId: "a", date, time: "07:00" });
    expect(r.reason).toBe("no-station-in-range");
    expect(r.message).toContain("within 100 km");
    expect(r.message).toContain("Faraway, PA");
    expect(r.itineraries).toEqual([]);
    expect(r.access.origin).toMatchObject({ status: "none-in-range", stations: [] });
  });
  it("reports outside-snapshot dates, operator exclusion and neighbouring places honestly", () => {
    const outside = engine().plan({ fromId: "q", toId: "c", date: "2026-12-15", time: "07:00" });
    expect(outside.reason).toBe("date-outside-snapshot");
    const filtered = engine().plan({ fromId: "q", toId: "c", date, time: "07:00", includeAmtrak: "0" });
    expect(filtered.reason).toBe("access-filtered-out");
    const neighbours = engine().plan({ fromId: "q", toId: "n", date, time: "07:00" });
    expect(neighbours.reason).toBe("no-useful-scheduled-leg");
    expect(neighbours.itineraries).toEqual([]);
  });
  it("does not offer a station farther than the other place's own station", () => {
    // Only stations strictly nearer to Quaker than Alpha's own station A are used.
    const r = engine().plan({ fromId: "q", toId: "a", date, time: "07:00" });
    const toA = straightLineKm(places[2], fixture().feeds[0].stops.A);
    for (const s of r.access.origin.stations)
      expect(s.straightLineKm).toBeLessThanOrEqual(Math.round(toA));
    expect(r.access.origin.stations.map((s) => s.stationId)).toEqual(["f:P", "f:P2"]);
    expect(r.itineraries.length).toBeGreaterThan(0);
  });
  it("keeps the generic coverage gap for a place without a representative point", () => {
    const r = engine().plan({ fromId: "nopoint", toId: "a", date, time: "07:00" });
    expect(r.reason).toBe("coverage-gap");
  });
  it("flags nearby-station coverage in catalogue metadata without exposing coordinates", () => {
    const m = engine().metadata();
    const byId = Object.fromEntries(m.cities.map((c) => [c.id, c]));
    expect(byId.q).toEqual({
      id: "q",
      name: "Quaker",
      state: "PA",
      aliases: [],
      hasTimetableStops: false,
      hasNearbyTimetableStation: true,
    });
    expect(byId.far.hasNearbyTimetableStation).toBe(false);
    expect(byId.a.hasNearbyTimetableStation).toBe(true);
    expect(m.accessPolicy).toEqual(ACCESS_POLICY);
  });
});
