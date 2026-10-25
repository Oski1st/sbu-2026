import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SearchPage from "../../pages/SearchPage";
import { readSearchState, writeSearchState, defaultSearch } from "../../data/searchState";
import { getTripById } from "../../data/tripLookup";
import { formatTime } from "../../data/tripUtils";

function renderSearch(query: string) {
  // Only the hostname read during ShareTripButton SSR; this is not a browser test.
  vi.stubGlobal("window", { location: { hostname: "localhost" } });
  return renderToStaticMarkup(<MemoryRouter initialEntries={[`/?${query}`]}><SearchPage /></MemoryRouter>);
}
afterEach(() => vi.unstubAllGlobals());

describe("Search URL and controlled-input integration", () => {
  it("renders both real form inputs as comboboxes using submitted URL values", () => {
    const html = renderSearch("from=NYC&to=Boston&date=2026-11-03&time=17%3A45&mode=rail");
    expect(html.match(/role="combobox"/g)).toHaveLength(2);
    expect(html).toContain('id="origin"');
    expect(html).toContain('value="NYC"');
    expect(html).toContain('value="Boston"');
    expect(html).toContain('value="2026-11-03"');
    expect(html).toContain('value="17:45"');
    expect(html).toContain("Sample itinerary times do not change.");
    expect(html).not.toContain("station-options");
  });

  it("renders restored date/time states when only preferences differ between URLs", () => {
    const states = [
      { ...defaultSearch, departureDate: "2026-11-03", departureTime: "17:45" },
      { ...defaultSearch, departureDate: "2026-11-04", departureTime: "09:15" },
    ];
    const urls = states.map((state) => writeSearchState(state).toString());
    // Simulate reconstructing share/reload/history entries; P4 verifies actual popstate.
    for (const index of [0, 1, 0, 1]) {
      const restored = readSearchState(new URLSearchParams(urls[index]));
      expect(restored).toEqual(states[index]);
      const html = renderSearch(urls[index]);
      expect(html).toContain(`value="${states[index].departureDate}"`);
      expect(html).toContain(`value="${states[index].departureTime}"`);
    }
  });

  it("keeps original demo links and sample departure times for future preferences", () => {
    const html = renderSearch("date=2027-06-10&time=23%3A45");
    for (const id of ["regional-connection", "amtrak-connection"]) {
      const trip = getTripById(id)!;
      expect(html).toContain(`href="/journey/${id}"`);
      expect(html).toContain(formatTime(trip.legs[0].departure));
      expect(trip.legs[0].departure).toContain("2026-10-24");
    }
  });

  it("preserves unsupported typed cities with a usable no-route result", () => {
    const html = renderSearch("from=Atlantis&to=Boston");
    expect(html).toContain('value="Atlantis"');
    expect(html).toContain("not yet a supported sample city");
    expect(html).not.toContain('href="/journey/east-atlantis');
  });
});
