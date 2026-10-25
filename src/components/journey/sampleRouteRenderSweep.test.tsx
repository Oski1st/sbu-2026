import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { cities } from "../../data/eastCoast";
import { originalDemoTrips } from "../../data/originalDemoTrips";
import { getConceptTrip, getTripById, routingProfiles } from "../../data/tripLookup";
import JourneyPage from "../../pages/JourneyPage";
import WalletPage from "../../pages/WalletPage";

describe("owner-requested final sample-route render sweep", () => {
  it("renders every supported pair/profile Journey and Wallet without invalid timestamps or a silent fallback", () => {
    const ids = new Set(originalDemoTrips.map((trip) => trip.id));
    for (const from of cities) for (const to of cities) {
      if (from.id === to.id) continue;
      for (const profile of routingProfiles) {
        const trip = getConceptTrip(from.id, to.id, profile);
        if (trip) ids.add(trip.id);
      }
    }
    expect(ids.size).toBeGreaterThan(1600);
    let rendered = 0;
    for (const id of ids) {
      const trip = getTripById(id)!;
      expect(trip.legs.length, id).toBeGreaterThan(0);
      const first = Date.parse(trip.legs[0].departure);
      const last = Date.parse(trip.legs.at(-1)!.arrival);
      expect((last - first) / 60000, id).toBe(trip.durationMinutes);
      let previousArrival = first;
      for (const leg of trip.legs) {
        const departure = Date.parse(leg.departure), arrival = Date.parse(leg.arrival);
        expect(Number.isFinite(departure) && Number.isFinite(arrival), leg.id).toBe(true);
        expect(departure, leg.id).toBeGreaterThanOrEqual(previousArrival);
        expect(arrival, leg.id).toBeGreaterThanOrEqual(departure);
        previousArrival = arrival;
      }
      for (const kind of ["journey", "wallet"] as const) {
        const html = renderToStaticMarkup(<MemoryRouter initialEntries={[`/${kind}/${id}`]}><Routes>
          <Route path="/journey/:tripId" element={<JourneyPage />} />
          <Route path="/wallet/:tripId" element={<WalletPage />} />
        </Routes></MemoryRouter>);
        expect(html, id).not.toMatch(/Journey not found|Invalid Date|\bNaN\b/);
        if (kind === "journey") {
          expect(html).toContain(`href="/wallet/${id}"`);
          expect(html.match(/<main\b/g)).toHaveLength(1);
          expect(html).toContain("Manual demo");
        } else {
          expect(html.match(/type="checkbox"/g)).toHaveLength(trip.legs.length);
          expect(html).toContain("Times are simulated itinerary data");
        }
        rendered++;
      }
    }
    expect(rendered).toBe(ids.size * 2);
    console.info(`SSR-only sweep: ${ids.size} sample itineraries / ${rendered} Journey+Wallet renders. No browser interaction or service-accuracy claim.`);
  }, 30000);
});
