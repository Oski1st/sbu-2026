/** Independent source-event validation and real-feed city-pair/date matrix, no external requests. */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import {
  createTimetableEngine,
  isActive,
  serviceEpoch,
  localInstants,
} from "../server/timetable-engine.mjs";
const data = JSON.parse(
  gunzipSync(
    readFileSync(new URL("../server/data/timetables.json.gz", import.meta.url)),
  ),
);
const engine = createTimetableEngine(data, {
  now: () => Date.parse("2026-10-25T04:00:00Z"),
});
const cases = [
  ["Boston, MA", "Philadelphia, PA", "2026-10-25", "08:00", "routes"],
  ["Boston, MA", "Philadelphia, PA", "2026-10-26", "08:00", "routes"],
  ["Boston, MA", "Philadelphia, PA", "2026-10-26", "12:00", "routes"],
  ["Boston, MA", "Philadelphia, PA", "2026-10-26", "23:50", "routes"],
  ["Philadelphia, PA", "Stony Brook, NY", "2026-10-25", "08:00", "routes"],
  ["Stony Brook, NY", "Philadelphia, PA", "2026-10-25", "08:00", "routes"],
  ["Philadelphia, PA", "Stony Brook, NY", "2026-10-26", "08:00", "routes"],
  ["Philadelphia, PA", "Stony Brook, NY", "2026-11-01", "08:00", "routes"],
  ["New York, NY", "Boston, MA", "2026-10-26", "08:00", "routes"],
  ["New York, NY", "Stony Brook, NY", "2026-10-25", "08:00", "routes"],
  ["Portland, OR", "Seattle, WA", "2026-10-26", "08:00", "routes"],
  ["New York, NY", "Los Angeles, CA", "2026-10-26", "08:00", "routes"],
  ["Boston, MA", "Miami, FL", "2026-10-26", "08:00", "routes"],
  [
    "Philadelphia, PA",
    "Stony Brook, NY",
    "2026-11-09",
    "08:00",
    "date-outside-snapshot",
  ],
  ["Anchorage, AK", "Philadelphia, PA", "2026-10-26", "08:00", "unknown-city"],
  ["Atlantis", "Boston, MA", "2026-10-26", "08:00", "unknown-city"],
  ["Portland", "Boston, MA", "2026-10-26", "08:00", "ambiguous-city"],
  ["Boston, MA", "Boston, MA", "2026-10-26", "08:00", "same-city"],
  ["Boston, MA", "Philadelphia, PA", "2026-02-31", "08:00", "invalid-date"],
  ["Boston, MA", "Philadelphia, PA", "2020-01-01", "08:00", "past-date"],
];
let checks = 0;
const results = [];
for (const [from, to, date, time, expected] of cases) {
  const started = performance.now();
  let result;
  try {
    result = engine.plan({ from, to, date, time });
    if (expected === "routes")
      assert.ok(
        result.itineraries.length > 0,
        `${from}→${to}: ${result.reason}`,
      );
    else assert.equal(result.reason, expected);
    if (result.itineraries.length) {
      assert.deepEqual(
        result.itineraries.map((t) => Date.parse(t.arrival)),
        result.itineraries
          .map((t) => Date.parse(t.arrival))
          .sort((a, b) => a - b),
      );
      for (const itinerary of result.itineraries) {
        assert.ok(
          Date.parse(itinerary.departure) >=
            localInstants(date, time, result.query.timezone)[0],
        );
        for (const leg of itinerary.legs) {
          const feed = data.feeds.find((f) => f.id === leg.feed),
            trip = feed.trips.find((t) => t.id === leg.tripId);
          assert.ok(isActive(feed, trip.service, leg.serviceDate));
          const epoch = serviceEpoch(leg.serviceDate, feed.timezone);
          const fi = trip.stops.findIndex(
            (s) =>
              `${feed.id}:${s[0]}` === leg.fromStop &&
              epoch + s[2] * 1000 === Date.parse(leg.departure) &&
              s[3] === 0,
          );
          const ti = trip.stops.findIndex(
            (s, i) =>
              i > fi &&
              `${feed.id}:${s[0]}` === leg.toStop &&
              epoch + s[1] * 1000 === Date.parse(leg.arrival) &&
              s[4] === 0,
          );
          assert.ok(
            fi >= 0 && ti > fi,
            "Every leg must match a published boardable source segment",
          );
          assert.equal(leg.mode, trip.mode);
          checks++;
        }
      }
      const picked = result.itineraries[0];
      assert.deepEqual(engine.itinerary(picked.id).itinerary, picked);
      checks++;
    }
    results.push({
      from,
      to,
      date,
      time,
      expected,
      options: result.itineraries.length,
      firstArrival: result.itineraries[0]?.arrival,
      ms: Math.round(performance.now() - started),
    });
  } catch (error) {
    if (expected === "routes") {
      console.error("FAILED CASE", from, to, date, time, error.code);
      throw error;
    }
    assert.equal(error.code, expected);
    results.push({ from, to, date, time, expected, error: error.code });
  }
  checks++;
}
for (const operator of ["NJ_TRANSIT", "SEPTA", "GREYHOUND", "FLIXBUS"]) {
  assert.equal(
    engine.plan({
      from: "Boston, MA",
      to: "Philadelphia, PA",
      date: "2026-10-26",
      time: "08:00",
      operator,
    }).reason,
    "operator-coverage-gap",
  );
  checks++;
}
const excluded = engine.plan({
  from: "Boston, MA",
  to: "Philadelphia, PA",
  date: "2026-10-26",
  time: "08:00",
  includeAmtrak: false,
});
assert.equal(excluded.itineraries.length, 0);
checks++;
console.log(
  JSON.stringify(
    { version: data.version, matrixCases: cases.length, checks, results },
    null,
    2,
  ),
);
