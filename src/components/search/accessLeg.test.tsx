import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ScheduledRouteCard } from "./ScheduledRouteCard";
import { AccessSummaryPanel } from "./AccessLeg";
import type {
  AccessSummary,
  ScheduledItinerary,
} from "../../services/transit/timetables";

const listings = [
  { operator: "FLIXBUS", url: "https://www.flixbus.com/bus/quakertown-pa" },
];
const paoli = {
  stationId: "amtrak:PAO",
  id: "PAO",
  feed: "amtrak",
  name: "Paoli Amtrak Station",
};
const stop = (id: string, name: string) => ({
  id,
  feed: "amtrak",
  name,
  timezone: "America/New_York",
  url: "",
});
const trip: ScheduledItinerary = {
  id: "tt1-access",
  origin: "Quakertown, PA",
  destination: "Philadelphia, PA",
  departure: "2026-10-27T13:00:00Z",
  arrival: "2026-10-27T13:30:00Z",
  durationMinutes: 30,
  waitFromRequestedMinutes: 60,
  transfers: 0,
  access: {
    before: {
      place: "Quakertown, PA",
      placeId: "quakertown-pa",
      station: paoli,
      straightLineKm: 46,
      distanceReference: "catalogue-representative-point",
      scheduled: false,
      listings,
    },
    after: null,
  },
  legs: [
    {
      instance: "x",
      feed: "amtrak",
      operator: "AMTRAK",
      tripId: "644",
      routeId: "r",
      serviceDate: "2026-10-27",
      route: "Keystone",
      number: "644",
      agencyName: "Amtrak",
      mode: "rail",
      fromStop: "amtrak:PAO",
      toStop: "amtrak:PHL",
      from: stop("PAO", "Paoli Amtrak Station"),
      to: stop("PHL", "Philadelphia"),
      departure: "2026-10-27T13:00:00Z",
      arrival: "2026-10-27T13:30:00Z",
      sourceUrl: "https://content.amtrak.com/content/gtfs/GTFS.zip",
      purchaseUrl: "https://www.amtrak.com/tickets.html",
    },
  ],
};

it("shows the access step as unscheduled, with distance but no time, fare or duration", () => {
  const h = renderToStaticMarkup(
    <MemoryRouter>
      <ScheduledRouteCard trip={trip} />
    </MemoryRouter>,
  );
  for (const x of [
    "NOT IN PUBLISHED SCHEDULES",
    "Get from Quakertown, PA to Paoli Amtrak Station (PAO)",
    "About 46 km straight-line",
    "Not included in published schedules",
    "no time, fare or duration is shown for this part",
    "Your requested time is applied at the station",
    'role="note"',
  ])
    expect(h).toContain(x);
  // The access notice appears before the timetable summary.
  expect(h.indexOf("NOT IN PUBLISHED SCHEDULES")).toBeLessThan(
    h.indexOf('class="route-summary"'),
  );
  // Listings stay on the search panel/detail page, not repeated on every card.
  expect(h).not.toContain("flixbus.com");
  expect(h).not.toContain("$");
});

it("detail view lists catalogue operators with qualified wording, never as schedules", () => {
  const h = renderToStaticMarkup(
    <MemoryRouter>
      <ScheduledRouteCard trip={trip} detailsOnly />
    </MemoryRouter>,
  );
  expect(h).toContain("Listed service area — check boarding stop");
  expect(h).toContain('href="https://www.flixbus.com/bus/quakertown-pa"');
  expect(h).toContain("FlixBus city page for Quakertown, PA");
  expect(h).toContain("These listings are not schedules");
});

it("explains candidate stations and the no-station-in-range case", () => {
  const ok: AccessSummary = {
    radiusKm: 100,
    maxStations: 3,
    distanceReference: "catalogue-representative-point",
    scheduled: false,
    origin: {
      placeId: "quakertown-pa",
      place: "Quakertown, PA",
      status: "ok",
      stations: [{ ...paoli, straightLineKm: 46 }],
      listings,
    },
    destination: null,
  };
  const h = renderToStaticMarkup(<AccessSummaryPanel access={ok} />);
  expect(h).toContain("Quakertown, PA has no stop in the loaded Amtrak/LIRR timetables.");
  expect(h).toContain("Paoli Amtrak Station (PAO) — about 46 km");
  expect(h).toContain("within 100 km");
  expect(h).toContain("not included in published schedules");
  const none = renderToStaticMarkup(
    <AccessSummaryPanel
      access={{
        ...ok,
        origin: {
          placeId: "scranton-pa",
          place: "Scranton, PA",
          status: "none-in-range",
          stations: [],
          listings: [],
        },
      }}
    />,
  );
  expect(none).toContain("No published station in the loaded timetables is within 100 km.");
  expect(none).toContain("No operator listing is recorded for Scranton, PA");
});
