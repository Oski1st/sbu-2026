import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SearchPage from "../../pages/SearchPage";
import JourneyPage from "../../pages/JourneyPage";
import WalletPage from "../../pages/WalletPage";
import {
  describePlanningPreference,
  isPlanningDate,
  parsePlanningTime,
  readSearchState,
  todayInNewYork,
  writePlanningPreference,
} from "../../data/searchState";
import { getTripById } from "../../data/tripLookup";
import { formatTime, shiftSampleTimeline } from "../../data/tripUtils";
import { createPreferenceRefresh, PREFERENCE_DEBOUNCE_MS, type PlanningPreferences } from "./preferenceRefresh";

// Fixed future dates keep these tests independent of the day they run.
const DATE = "2027-06-10";

describe("Date/Time auto-refresh controller", () => {
  let sent: (PlanningPreferences | null)[];
  let refresh: ReturnType<typeof createPreferenceRefresh>;
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    refresh = createPreferenceRefresh((preferences) => sent.push(preferences));
  });
  afterEach(() => vi.useRealTimers());

  it("re-runs the search about 300 ms after a date change, once per burst of typing", () => {
    expect(PREFERENCE_DEBOUNCE_MS).toBe(300);
    refresh.change("2027-06-09", "08:00");
    vi.advanceTimersByTime(200);
    refresh.change(DATE, "08:00");
    vi.advanceTimersByTime(299);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual([{ departureDate: DATE, departureTime: "08:00" }]);
  });

  it("sends a complete time on change, normalized; blur sends a waiting change at once", () => {
    refresh.change(DATE, "4:30 PM");
    refresh.flush();
    expect(sent).toEqual([{ departureDate: DATE, departureTime: "16:30" }]);
    refresh.flush();
    vi.runAllTimers();
    expect(sent).toHaveLength(1);
  });

  it("D1: an incomplete time or out-of-range date hides results at once and is never applied", () => {
    refresh.change(DATE, "09:15");
    for (const [date, time] of [
      [DATE, ""],
      ["20270-06-10", "09:15"],
      ["0270-06-10", "09:15"],
      ["2026-01-01", "09:15"],
      ["2027-02-30", "09:15"],
      [DATE, "9:1"],
    ]) refresh.change(date, time);
    vi.runAllTimers();
    expect(sent).toEqual([null, null, null, null, null, null]);
  });

  it("Search trips (submit) cancels a waiting auto-refresh", () => {
    refresh.change(DATE, "10:00");
    refresh.cancel();
    vi.runAllTimers();
    expect(sent).toEqual([]);
  });
});

describe("planning preference helpers", () => {
  it("accepts only real dates from today through 9999-12-31", () => {
    const today = todayInNewYork();
    expect(isPlanningDate(today)).toBe(true);
    expect(isPlanningDate("9999-12-31")).toBe(true);
    for (const value of ["20270-01-01", "0270-11-03", "2026-02-30", "", "2027-6-1"]) expect(isPlanningDate(value)).toBe(false);
    expect(isPlanningDate("2026-11-02", "2026-11-03")).toBe(false);
  });

  it("parses complete times only", () => {
    expect(parsePlanningTime("23:45")).toBe("23:45");
    expect(parsePlanningTime("12:05 am")).toBe("00:05");
    for (const value of ["", "9:1", "24:00", "13:00 PM", "08:00:00"]) expect(parsePlanningTime(value)).toBeNull();
  });

  it("describes the preference for the live region", () => {
    expect(describePlanningPreference("2026-11-03", "16:30")).toBe("Tue, Nov 3, 2026 4:30 PM");
    expect(describePlanningPreference(DATE, "00:05")).toBe("Thu, Jun 10, 2027 12:05 AM");
  });

  it("writes both ?date and ?time, even today at 08:00, and keeps the rest of the search", () => {
    const current = new URLSearchParams("from=Boston&to=New+York&sort=fastest&mode=rail&amtrak=0");
    const next = writePlanningPreference({ departureDate: DATE, departureTime: "23:45" }, current);
    expect(Object.fromEntries(next)).toEqual({ from: "Boston", to: "New York", sort: "fastest", mode: "rail", amtrak: "0", date: DATE, time: "23:45" });
    const today = writePlanningPreference({ departureDate: todayInNewYork(), departureTime: "08:00" }, new URLSearchParams());
    expect(today.get("date")).toBe(todayInNewYork());
    expect(today.get("time")).toBe("08:00");
  });
});

describe("a date change re-runs the search (SSR of the refreshed URL)", () => {
  afterEach(() => vi.unstubAllGlobals());

  function refreshedUrl(start: string, date: string, time: string) {
    vi.useFakeTimers();
    let url = start;
    const refresh = createPreferenceRefresh((preferences) => {
      if (preferences) url = writePlanningPreference(preferences, new URLSearchParams(url)).toString();
    });
    refresh.change(date, time);
    vi.advanceTimersByTime(PREFERENCE_DEBOUNCE_MS);
    vi.useRealTimers();
    return url;
  }
  const renderSearch = (query: string) => {
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    return renderToStaticMarkup(<MemoryRouter initialEntries={[`/?${query}`]}><SearchPage /></MemoryRouter>);
  };

  it("shifts every route card and carries ?date&time into its Journey link", () => {
    const before = renderSearch("");
    const url = refreshedUrl("", DATE, "16:30");
    expect(url).toBe(`date=${DATE}&time=16%3A30`);
    const after = renderSearch(url);
    for (const id of ["regional-connection", "amtrak-connection"]) {
      const trip = getTripById(id)!;
      const shifted = shiftSampleTimeline(trip, DATE, "16:30");
      expect(before).toContain(`href="/journey/${id}"`);
      expect(after).toContain(`href="/journey/${id}?date=${DATE}&amp;time=16%3A30"`);
      expect(after).toContain(`<strong>${formatTime(shifted.legs[0].departure)}</strong>`);
    }
    expect(formatTime(shiftSampleTimeline(getTripById("regional-connection")!, DATE, "16:30").legs[0].departure)).toBe("4:30 PM");
    expect(after).toContain(`value="${DATE}"`);
    expect(after).toContain('value="16:30"');
    // The polite live region is present (empty until a change is applied in the browser).
    expect(after).toMatch(/<p class="results-update" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
  });

  it("keeps the sort and filters of the search it refreshes", () => {
    const url = refreshedUrl("from=Philadelphia&to=Stony+Brook&sort=fastest&amtrak=0", DATE, "07:05");
    expect(readSearchState(new URLSearchParams(url))).toMatchObject({ order: "fastest", includeAmtrak: false, departureDate: DATE, departureTime: "07:05" });
    const html = renderSearch(url);
    expect(html).toContain(`href="/journey/regional-connection?date=${DATE}&amp;time=07%3A05"`);
    expect(html).not.toContain('href="/journey/amtrak-connection');
  });

  it("Journey, Wallet and the ticket links all use the shifted leg date and time, overnight included", () => {
    // 23:45 moves the Amtrak express (sample start 8:30) to 12:15 AM the next day.
    const query = refreshedUrl("", DATE, "23:45");
    const journey = renderToStaticMarkup(
      <MemoryRouter initialEntries={[`/journey/amtrak-connection?${query}`]}>
        <Routes><Route path="/journey/:tripId" element={<JourneyPage />} /></Routes>
      </MemoryRouter>,
    );
    const wallet = renderToStaticMarkup(<MemoryRouter initialEntries={[`/wallet/amtrak-connection?${query}`]}><WalletPage tripId="amtrak-connection" /></MemoryRouter>);
    for (const html of [journey, wallet]) {
      expect(html).toContain("service_date=%5B%222027-06-11%22%5D");
      expect(html).not.toContain("service_date=%5B%222027-06-10%22%5D");
      expect(html).toContain("on Amtrak (Jun 11)");
      expect(html).toMatch(/Fri, Jun 11, 2027 · dep 12:15\sAM/);
    }
    expect(journey).toContain("12:15");
    expect(wallet).toContain("Jun 11, 12:15");
    // The SEPTA leg of the regional trip stays on the chosen date; its LIRR legs run after midnight.
    const regional = renderToStaticMarkup(<MemoryRouter initialEntries={[`/wallet/regional-connection?${query}`]}><WalletPage tripId="regional-connection" /></MemoryRouter>);
    expect(regional).toContain(`date=${DATE}`);
    expect(regional).toContain("for 2027-06-11");
  });
});
