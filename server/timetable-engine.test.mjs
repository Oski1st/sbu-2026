import { describe, it, expect } from "vitest";
import {
  createTimetableEngine,
  isActive,
  localInstants,
  serviceEpoch,
} from "./timetable-engine.mjs";
import { AMTRAK_BOOKING_URL } from "../src/lib/amtrakHandoff";
const date = "2026-10-26",
  now = () => Date.parse("2026-10-25T12:00:00Z");
const time = (h, m = 0) => h * 3600 + m * 60;
const stop = (id, name = id) => ({
  id,
  name,
  timezone: "America/New_York",
  url: "https://agency.example/stations/" + id,
});
function fixture() {
  return {
    version: "fixture1",
    limits: ["Mock timetables only"],
    cities: [
      { id: "a", name: "Alpha", state: "NY", aliases: [] },
      { id: "b", name: "Bravo", state: "PA", aliases: [] },
      { id: "c", name: "Charlie", state: "NJ", aliases: [] },
      { id: "a-or", name: "Alpha", state: "OR", aliases: [] },
    ],
    cityStops: { a: ["f:A"], b: ["f:B"], c: ["f:C"] },
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
        stops: { A: stop("A"), B: stop("B"), C: stop("C") },
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
        trips: [],
      },
    ],
  };
}
function trip(id, stops, service = "daily", mode = "rail") {
  return {
    id,
    service,
    routeId: "r" + id,
    name: id,
    number: id,
    agencyName: "Fixture operator",
    mode,
    stops: stops.map(([s, a, d = a, p = 0, drop = 0]) => [s, a, d, p, drop]),
  };
}
const query = { fromId: "a", toId: "b", date, time: "08:00" };
function engine(data) {
  return createTimetableEngine(data, { now });
}

describe("calendar and local clock correctness", () => {
  it("weekly service is overridden by date additions/removals", () => {
    const f = fixture().feeds[0];
    f.calendar[0].monday = "0";
    expect(isActive(f, "daily", date)).toBe(false);
    f.exceptions.push({
      service_id: "daily",
      date: "20261026",
      exception_type: "1",
    });
    expect(isActive(f, "daily", date)).toBe(true);
    f.exceptions[0].exception_type = "2";
    expect(isActive(f, "daily", date)).toBe(false);
  });
  it("calendar_dates-only feeds have no invented weekday service", () => {
    const f = fixture().feeds[0];
    f.calendar = [];
    f.exceptions = [
      { service_id: "one", date: "20261026", exception_type: "1" },
    ];
    expect(isActive(f, "one", date)).toBe(true);
    expect(isActive(f, "one", "2026-10-27")).toBe(false);
  });
  it("DST nonexistent and repeated times are explicit, and GTFS uses noon-minus12h", () => {
    expect(localInstants("2026-03-08", "02:30", "America/New_York")).toEqual(
      [],
    );
    expect(
      localInstants("2026-11-01", "01:30", "America/New_York"),
    ).toHaveLength(2);
    expect(serviceEpoch("2026-11-01", "America/New_York")).toBe(
      localInstants("2026-11-01", "12:00", "America/New_York")[0] -
        12 * 3600000,
    );
  });
});

describe("dated routing and exact transfers", () => {
  it("finds a faster real connection instead of a slower direct departure; preserves alternate direct option", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("slow", [
        ["A", time(8)],
        ["B", time(12)],
      ]),
      trip("first", [
        ["A", time(8, 10)],
        ["C", time(9)],
      ]),
      trip("second", [
        ["C", time(9, 10)],
        ["B", time(10)],
      ]),
    ];
    const r = engine(d).plan(query);
    expect(r.itineraries[0].legs.map((l) => l.tripId)).toEqual([
      "first",
      "second",
    ]);
    expect(r.itineraries[0].arrival).toBe("2026-10-26T14:00:00.000Z");
    // Amtrak legs hand off to the stable booking page (session URLs expire).
    expect(r.itineraries[0].legs[0].purchaseUrl).toBe(AMTRAK_BOOKING_URL);
    expect(r.itineraries[0].legs[0].purchaseUrl).toBe("https://www.amtrak.com/");
    expect(r.itineraries[0].legs[0].number).toBeTruthy();
    expect(
      engine(d)
        .plan({ ...query, order: "transfers" })
        .itineraries[0].legs.map((l) => l.tripId),
    ).toEqual(["slow"]);
  });
  it("respects departure time and changes the result when the requested date changes", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("morning", [
        ["A", time(8)],
        ["B", time(9)],
      ]),
      trip("later", [
        ["A", time(10)],
        ["B", time(11)],
      ]),
    ];
    const e = engine(d);
    expect(
      e.plan({ ...query, time: "09:00" }).itineraries[0].legs[0].tripId,
    ).toBe("later");
    d.feeds[0].exceptions = [
      { service_id: "daily", date: "20261026", exception_type: "2" },
    ];
    const a = engine(d).plan(query).itineraries[0];
    expect(a.departure.slice(0, 10)).toBe("2026-10-27");
  });
  it("uses GTFS times beyond24h and previous service-day trips", () => {
    const d = fixture();
    d.feeds[0].calendar[0].end_date = "20261025";
    d.feeds[0].trips = [
      trip("overnight", [
        ["A", time(25)],
        ["B", time(27)],
      ]),
    ];
    const r = engine(d).plan({ ...query, time: "00:30" });
    expect(r.itineraries[0].departure).toBe("2026-10-26T05:00:00.000Z");
    expect(r.itineraries[0].legs[0].serviceDate).toBe("2026-10-25");
  });
  it("never walks between different stations merely because a city or coordinates match", () => {
    const d = fixture();
    d.feeds[0].stops.C2 = stop("C2");
    d.feeds[0].trips = [
      trip("a", [
        ["A", time(8)],
        ["C", time(9)],
      ]),
      trip("b", [
        ["C2", time(10)],
        ["B", time(11)],
      ]),
    ];
    expect(engine(d).plan(query).itineraries).toEqual([]);
  });
  it("rejects missed transfers and honors explicit minimum/forbidden/timed rules", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("a", [
        ["A", time(8)],
        ["C", time(9)],
      ]),
      trip("b", [
        ["C", time(9, 5)],
        ["B", time(10)],
      ]),
    ];
    expect(engine(d).plan(query).itineraries[0]?.arrival.slice(0, 10)).not.toBe(
      date,
    );
    d.feeds[0].transfers = [
      {
        from_stop_id: "C",
        to_stop_id: "C",
        transfer_type: "2",
        min_transfer_time: "300",
      },
    ];
    expect(engine(d).plan(query).itineraries[0].arrival.slice(0, 10)).toBe(
      date,
    );
    d.feeds[0].transfers[0].transfer_type = "3";
    expect(engine(d).plan(query).itineraries).toEqual([]);
    d.feeds[0].transfers.push({
      from_stop_id: "C",
      to_stop_id: "C",
      from_trip_id: "a",
      to_trip_id: "b",
      transfer_type: "1",
    });
    expect(engine(d).plan(query).itineraries[0].arrival.slice(0, 10)).toBe(
      date,
    );
  });
  it("honors no-pickup and no-drop-off instead of inventing boarding rights", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("a", [
        ["A", time(8), time(8), 1],
        ["B", time(9)],
      ]),
      trip("b", [
        ["A", time(8)],
        ["B", time(9), time(9), 0, 1],
      ]),
    ];
    expect(engine(d).plan(query).itineraries).toEqual([]);
  });
  it("keeps one through train as one boarding with no fabricated transfers", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("a", [
        ["A", time(8)],
        ["C", time(9)],
        ["B", time(10)],
      ]),
    ];
    expect(engine(d).plan(query).itineraries[0]).toMatchObject({
      transfers: 0,
      durationMinutes: 120,
    });
  });
  it("does not use missing operator coverage or sample routes to fill gaps", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("a", [
        ["A", time(8)],
        ["B", time(9)],
      ]),
    ];
    expect(engine(d).plan({ ...query, operator: "NJ_TRANSIT" })).toMatchObject({
      reason: "operator-coverage-gap",
      itineraries: [],
    });
    expect(engine(d).plan({ ...query, includeAmtrak: false })).toMatchObject({
      itineraries: [],
    });
  });
});

describe("contracts, cache, links and independent reference", () => {
  it("rejects ambiguous names, same-city, malformed/past dates and invalid times", () => {
    const e = engine(fixture());
    for (const q of [
      { ...query, fromId: undefined, from: "Alpha" },
      { ...query, toId: "a" },
      { ...query, date: "2026-02-31" },
      { ...query, date: "2026-10-24" },
      { ...query, time: "25:00" },
    ])
      expect(() => e.plan(q)).toThrow();
  });
  it("returns honest no-coverage and out-of-snapshot results", () => {
    const d = fixture();
    expect(engine(d).plan({ ...query, toId: "a-or" })).toMatchObject({
      reason: "coverage-gap",
    });
    expect(engine(d).plan({ ...query, date: "2027-01-01" })).toMatchObject({
      reason: "date-outside-snapshot",
    });
  });
  it("reconstructs canonical IDs on a cold engine and rejects tampered or obsolete links", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("one", [
        ["A", time(8)],
        ["B", time(9)],
      ]),
    ];
    const r = engine(d).plan(query).itineraries[0];
    expect(engine(d).itinerary(r.id).itinerary).toEqual(r);
    expect(() => engine({ ...d, version: "new" }).itinerary(r.id)).toThrow(
      /snapshot has changed/,
    );
    const p = JSON.parse(Buffer.from(r.id.slice(4), "base64url"));
    p.pick = "wrong";
    expect(() =>
      engine(d).itinerary(
        "tt1-" + Buffer.from(JSON.stringify(p)).toString("base64url"),
      ),
    ).toThrow();
  });
  it("keys every result input and returns isolated cache values", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("one", [
        ["A", time(8)],
        ["B", time(9)],
      ]),
    ];
    const e = engine(d);
    const a = e.plan(query);
    a.itineraries[0].legs[0].from.name = "tampered";
    expect(e.plan(query).itineraries[0].legs[0].from.name).toBe("A");
    expect(e.diagnostics().computations).toBe(1);
    e.plan({ ...query, time: "09:00" });
    e.plan({ ...query, mode: "rail" });
    expect(e.diagnostics().computations).toBe(3);
  });
  it("matches exhaustive two-leg reference on a small grid of requested times", () => {
    const d = fixture();
    d.feeds[0].trips = [
      trip("direct", [
        ["A", time(9)],
        ["B", time(12)],
      ]),
      trip("a1", [
        ["A", time(8)],
        ["C", time(9)],
      ]),
      trip("b1", [
        ["C", time(9, 10)],
        ["B", time(10)],
      ]),
      trip("a2", [
        ["A", time(10)],
        ["C", time(11)],
      ]),
      trip("b2", [
        ["C", time(11, 15)],
        ["B", time(11, 50)],
      ]),
    ];
    d.feeds[0].calendar[0].end_date = "20261026";
    const e = engine(d);
    for (const hour of [7, 8, 9, 10, 11]) {
      let best = Infinity;
      for (const t of d.feeds[0].trips) {
        const a = t.stops.find((x) => x[0] === "A"),
          b = t.stops.find((x) => x[0] === "B");
        if (a && b && a[2] >= time(hour)) best = Math.min(best, b[1]);
        if (a && a[2] >= time(hour)) {
          const c = t.stops.find((x) => x[0] === "C");
          for (const t2 of d.feeds[0].trips) {
            const c2 = t2.stops.find((x) => x[0] === "C"),
              b2 = t2.stops.find((x) => x[0] === "B");
            if (c && c2 && b2 && c[1] + 600 <= c2[2])
              best = Math.min(best, b2[1]);
          }
        }
      }
      const r = e.plan({
        ...query,
        time: String(hour).padStart(2, "0") + ":00",
      });
      expect(
        r.itineraries[0]
          ? Date.parse(r.itineraries[0].arrival) -
              serviceEpoch(date, "America/New_York")
          : Infinity,
      ).toBe(best * 1000);
    }
  });
});

it("suppresses needless train changes dominated by a through train", () => {
  const d = fixture();
  d.feeds[0].trips = [
    trip("through", [
      ["A", time(8)],
      ["C", time(9)],
      ["B", time(10)],
    ]),
    trip("slower", [
      ["C", time(9, 30)],
      ["B", time(11)],
    ]),
  ];
  const r = engine(d).plan(query);
  expect(r.itineraries.every((t) => t.transfers === 0)).toBe(true);
});
it("keeps the query cache bounded after many different times", () => {
  const d = fixture();
  d.feeds[0].trips = [
    trip("a", [
      ["A", time(8)],
      ["B", time(9)],
    ]),
  ];
  const e = engine(d);
  for (let i = 0; i < 70; i++)
    e.plan({
      ...query,
      time: `${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}`,
    });
  expect(e.diagnostics().cacheSize).toBe(64);
});

it("returns an explicit work-limit error rather than incomplete optimized claims", () => {
  const d = fixture();
  d.feeds[0].trips = [
    trip("a", [
      ["A", time(8)],
      ["B", time(9)],
    ]),
  ];
  expect(() =>
    createTimetableEngine(d, { now, maxWork: 1 }).plan(query),
  ).toThrow(/work limit/);
});

it("prefix transfer indexing preserves a later origin departure for the same arrival", () => {
  const d = fixture();
  d.feeds[0].trips = [
    trip("early", [
      ["A", time(8)],
      ["C", time(9)],
    ]),
    trip("later", [
      ["A", time(8, 45)],
      ["C", time(9, 30)],
    ]),
    trip("connection", [
      ["C", time(10)],
      ["B", time(11)],
    ]),
  ];
  const r = engine(d).plan(query);
  expect(r.itineraries[0].legs[0].tripId).toBe("later");
  expect(r.itineraries[0].arrival).toBe("2026-10-26T15:00:00.000Z");
});

it("keeps a published itinerary readable after departure while rejecting new past-date searches", () => {
  const d = fixture();
  d.feeds[0].trips = [
    trip("one", [
      ["A", time(8)],
      ["B", time(9)],
    ]),
  ];
  const booked = engine(d).plan(query).itineraries[0];
  const later = createTimetableEngine(d, {
    now: () => Date.parse("2026-10-28T12:00:00Z"),
  });
  expect(() => later.plan(query)).toThrow(/today or a future date/);
  expect(later.itinerary(booked.id).itinerary).toEqual(booked);
});

it("changing the requested clock time excludes earlier trains and updates dated IDs, including midnight", () => {
  const data = fixture();
  data.feeds[0].trips = [
    trip("early", [["A",time(8)],["B",time(9)]]),
    trip("late", [["A",time(12)],["B",time(13)]]),
    trip("night", [["A",time(24,10)],["B",time(25)]])
  ];
  const e=engine(data);
  const first=e.plan(query), later=e.plan({...query,time:"08:01"}), night=e.plan({...query,time:"23:59"});
  expect(first.itineraries[0].legs[0].tripId).toBe("early");
  expect(later.itineraries[0].legs[0].tripId).toBe("late");
  expect(later.itineraries[0].id).not.toBe(first.itineraries[0].id);
  expect(later.itineraries.every(t=>Date.parse(t.departure)>=Date.parse("2026-10-26T12:01:00Z"))).toBe(true);
  expect(night.itineraries[0].legs[0].tripId).toBe("night");
  expect(night.itineraries[0].departure).toBe("2026-10-27T04:10:00.000Z");
});
