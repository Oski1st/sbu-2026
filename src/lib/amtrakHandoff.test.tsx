import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getTripById } from "../data/tripLookup";
import JourneyPage from "../pages/JourneyPage";
import WalletPage from "../pages/WalletPage";
import { AppLayout } from "../components/layout/AppLayout";
import { IntegrationPage } from "../components/layout/IntegrationPage";
import { RouteCard } from "../components/search/RouteCard";
import { officialPurchaseUrl } from "../components/wallet/ticketing";
import { AMTRAK_BOOKING_URL, AMTRAK_HANDOFF_NOTE, amtrakTripText, copyTripText } from "./amtrakHandoff";
import { AMTRAK_DEEP_LINK_NOTE } from "./purchase";
import { SegmentCard } from "../components/journey/SegmentCard";

// SSR cannot click disclosures; open RouteCard details through their initial state only.
const fixture = vi.hoisted(() => ({ expand: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(fixture.expand && initial === false ? true : initial) };
});

afterEach(() => { fixture.expand = false; vi.unstubAllGlobals(); });

const trip = getTripById("amtrak-connection")!;
const amtrakLeg = trip.legs.find((leg) => leg.agency === "AMTRAK")!;

/** Every rendered amtrak.com href except informational station and route pages. */
function amtrakBookingHrefs(html: string) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(([, href]) => href.replace(/&amp;/g, "&"))
    .filter((href) => /amtrak\.com/i.test(href) && !/\/stations\/|\/routes\/|-train\.html/.test(href));
}

function page(url: string) {
  vi.stubGlobal("window", { location: { hostname: "localhost" } });
  return renderToStaticMarkup(<MemoryRouter initialEntries={[url]}><Routes><Route element={<AppLayout />}>
    <Route path="/journey/:tripId" element={<JourneyPage />} />
    <Route path="/wallet/:tripId" element={<WalletPage />} />
  </Route></Routes></MemoryRouter>);
}

describe("Amtrak booking handoff", () => {
  it("renders every Amtrak booking href as the non-expiring From/To/Date search for the Search date, with the backup note", () => {
    fixture.expand = true;
    const date = "2026-11-12";
    const screens = [
      page(`/journey/${trip.id}?date=${date}`),
      page(`/wallet/${trip.id}?date=${date}`),
      renderToStaticMarkup(<MemoryRouter initialEntries={[`/wallet?trip=${trip.id}&date=${date}`]}><IntegrationPage kind="wallet" /></MemoryRouter>),
      renderToStaticMarkup(<MemoryRouter initialEntries={[`/?date=${date}`]}><RouteCard trip={trip} index={0} comparing={false} onCompare={() => {}} /></MemoryRouter>),
    ];
    for (const html of screens) {
      const hrefs = amtrakBookingHrefs(html);
      expect(hrefs.length).toBeGreaterThanOrEqual(1);
      for (const href of hrefs) {
        // Each value is a URL-encoded single-item JSON array; no session, cmp= or channel= parameters.
        expect(href).toBe("https://www.amtrak.com/tickets/departure.html?from_ticketing_stop_time_id=%5B%22PHL%22%5D&to_ticketing_stop_time_id=%5B%22NYP%22%5D&service_date=%5B%222026-11-12%22%5D");
        const url = new URL(href);
        expect([...url.searchParams.keys()]).toEqual(["from_ticketing_stop_time_id", "to_ticketing_stop_time_id", "service_date"]);
        expect([...url.searchParams.values()].map((value) => JSON.parse(value))).toEqual([["PHL"], ["NYP"], [date]]);
        expect(url.hash).toBe("");
        expect(href).not.toMatch(/cmp=|channel=|session|token/i);
      }
      expect(html).toContain('data-amtrak-handoff=""');
      expect(html).toContain('target="_blank"');
      expect(html).toContain("opens in a new tab");
      expect(html).toContain("Open Philadelphia, 30th Street → New York Penn Station on Amtrak (Nov 12)");
      expect(html).toContain(AMTRAK_DEEP_LINK_NOTE.replace(/'/g, "&#x27;"));
      // The copied backup carries the Search date, not the sample Oct 24 date.
      expect(html).toContain("Thu, Nov 12, 2026");
      expect(html).toContain('role="status"');
      expect(html).not.toContain("amtrak.com/mobile");
    }
    expect(AMTRAK_BOOKING_URL).toBe("https://www.amtrak.com/");
  });

  it("falls back to the stable homepage with the copy handoff when a station code is missing", () => {
    const html = renderToStaticMarkup(<SegmentCard leg={{ ...amtrakLeg, from: "Stony Brook" }} index={0} isExpanded isDelayed={false} isCurrent={false} onToggle={() => {}} />);
    expect(amtrakBookingHrefs(html)).toEqual(["https://www.amtrak.com/"]);
    expect(html).toContain("Copy details &amp; open Amtrak");
    expect(html).toContain(AMTRAK_HANDOFF_NOTE.replace(/'/g, "&#x27;"));
  });

  it("never passes an expiring Amtrak session URL through", () => {
    for (const stored of ["https://www.amtrak.com/tickets/departure.html#df=10/26/2026", "https://www.amtrak.com/home.html?session=abc", "https://www.amtrak.com/mobile"]) {
      expect(officialPurchaseUrl("AMTRAK", stored)).toBe("https://www.amtrak.com/");
    }
  });

  it("copies from/to, the date and departure time, omitting missing fields", () => {
    const text = amtrakTripText(amtrakLeg);
    expect(text).toContain("Philadelphia, 30th Street → New York Penn Station");
    expect(text).toContain("Sat, Oct 24, 2026");
    expect(text).toMatch(/dep \d{1,2}:\d{2} [AP]M/);
    expect(amtrakTripText({ from: "PHL", to: "NYP", departure: "2026-10-26T13:42:00-04:00", train: "1135" }))
      .toBe("Amtrak · PHL → NYP · Mon, Oct 26, 2026 · dep 1:42 PM · Train 1135");
    expect(amtrakTripText({ from: "PHL", to: "NYP", departure: "08:30" })).toBe("Amtrak · PHL → NYP");
    // The Search date replaces the sample date; the sample departure time stays.
    expect(amtrakTripText({ from: "PHL", to: "NYP", departure: "2026-10-24T08:30:00-04:00", date: "2026-11-12" }))
      .toBe("Amtrak · PHL → NYP · Thu, Nov 12, 2026 · dep 8:30 AM");
  });

  it("uses navigator.clipboard and reports failure so the visible field can be used", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await expect(copyTripText("Amtrak · PHL → NYP")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("Amtrak · PHL → NYP");
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    await expect(copyTripText("x", null)).resolves.toBe(false);
  });
});
