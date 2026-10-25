import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import TimetableSearchPage from "../../pages/TimetableSearchPage";
import { SearchForm } from "./SearchForm";
import { ScheduledRouteCard } from "./ScheduledRouteCard";
import { createLocationCatalogue } from "./locationCatalogue";
import type { ScheduledItinerary } from "../../services/transit/timetables";
it("renders editable date/time and state-qualified cities from a share URL without relabelling samples", () => {
  const h = renderToStaticMarkup(
    <MemoryRouter
      initialEntries={[
        "/?from=Boston%2C+MA&to=Philadelphia%2C+PA&date=2026-10-26&time=09%3A30&search=1",
      ]}
    >
      <TimetableSearchPage />
    </MemoryRouter>,
  );
  for (const x of [
    'value="Boston, MA"',
    'value="Philadelphia, PA"',
    'value="2026-10-26"',
    'value="09:30"',
    'type="date"',
    'type="time"',
    "Published timetables",
    "No verified scheduled feed",
    "/demo",
  ])
    expect(h).toContain(x);
  expect(h).not.toContain("SAMPLE ITINERARY");
});
it("the real form retains both comboboxes, manual entry and accurate date semantics", () => {
  const h = renderToStaticMarkup(
    <SearchForm
      timetable
      catalogue={createLocationCatalogue([])}
      onSearch={() => {}}
      initialOrigin="Atlantis"
    />,
  );
  expect(h.match(/role="combobox"/g)).toHaveLength(2);
  expect(h).toContain('value="Atlantis"');
  expect(h).toContain("Choose a listed city and state");
  expect(h).toContain("Date and time are used to find published departures");
  expect(h).not.toContain("Sample itinerary times do not change");
});
it("scheduled cards show actual dated stations, no invented fares, and a reconstructable link", () => {
  const stop = {
    id: "BOS",
    feed: "amtrak",
    name: "Boston South Station",
    timezone: "America/New_York",
    url: "https://www.amtrak.com/stations/bos",
  };
  const trip: ScheduledItinerary = {
    id: "tt1-fixture",
    origin: "Boston, MA",
    destination: "Philadelphia, PA",
    departure: "2026-10-26T12:25:00Z",
    arrival: "2026-10-26T18:41:00Z",
    durationMinutes: 376,
    waitFromRequestedMinutes: 25,
    transfers: 0,
    legs: [
      {
        instance: "a",
        feed: "amtrak",
        operator: "AMTRAK",
        tripId: "a",
        routeId: "r",
        serviceDate: "2026-10-26",
        route: "Northeast Regional",
        number: "99",
        agencyName: "Amtrak",
        mode: "rail",
        fromStop: "BOS",
        toStop: "PHL",
        from: stop,
        to: { ...stop, id: "PHL", name: "Philadelphia 30th Street" },
        departure: "2026-10-26T12:25:00Z",
        arrival: "2026-10-26T18:41:00Z",
        sourceUrl: "https://content.amtrak.com/content/gtfs/GTFS.zip",
        purchaseUrl: "https://www.amtrak.com/tickets.html",
      },
    ],
  };
  const h = renderToStaticMarkup(
    <MemoryRouter>
      <ScheduledRouteCard trip={trip} />
    </MemoryRouter>,
  );
  for (const x of [
    "PUBLISHED TIMETABLE",
    "Oct 26",
    "Boston South Station",
    "Philadelphia 30th Street",
    "Check fares",
    'href="/itinerary/tt1-fixture"',
  ])
    expect(h).toContain(x);
  expect(h).not.toContain("SAMPLE ITINERARY");
  expect(h).not.toContain("$");
});
