import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Leg } from "../../types/transit";
import { getTripById } from "../../data/tripLookup";
import { defaultSearch } from "../../data/searchState";
import geometry from "../../data/railMap/geometry.json";
import { PurchaseLink } from "../../components/purchase/PurchaseLink";
import { AMTRAK_HANDOFF_NOTE } from "../amtrakHandoff";
import { AMTRAK_DEEP_LINK_NOTE, purchaseLinkForLeg } from ".";
import { AMTRAK_CITY_CODES, amtrakPurchaseUrl, amtrakStationCode } from "./amtrak";
import { forgetSearchDateForTests, purchaseDate, rememberSearchDate } from "./dates";
import { officialHref } from "./official";

afterEach(() => forgetSearchDateForTests());

const regional = getTripById("regional-connection")!;
const express = getTripById("amtrak-connection")!;
const [septa, njt, lirr] = regional.legs;
const amtrak = express.legs[0];
const flix = getTripById("east-philadelphia--new-york--flixbus")!.legs[0];
const greyhound = getTripById("east-boston--new-york--greyhound")!.legs[0];
const PHILADELPHIA = "fd509c08-0a3e-4a44-b933-79f4a9db13da";
const NEW_YORK = "c0a47c54-53ea-46dc-984b-b764fc0b2fa9";
const BOSTON = "eeff627f-2fda-4e75-8468-783d47955b3a";
const amtrakUrl = (from: string, to: string, date: string) =>
  `https://www.amtrak.com/tickets/departure.html?from_ticketing_stop_time_id=%5B%22${from}%22%5D&to_ticketing_stop_time_id=%5B%22${to}%22%5D&service_date=%5B%22${date}%22%5D`;
const leg = (overrides: Partial<Leg>): Leg => ({ ...amtrak, ...overrides });

describe("purchaseLinkForLeg", () => {
  it("AMTRAK: opens the non-expiring From/To/Date search for the Search date and keeps the copy as a backup", () => {
    const link = purchaseLinkForLeg(amtrak, "2026-11-12");
    expect(link).toMatchObject({
      href: amtrakUrl("PHL", "NYP", "2026-11-12"),
      kind: "exact-purchase",
      label: "Open Philadelphia, 30th Street → New York Penn Station on Amtrak (Nov 12)",
      note: AMTRAK_DEEP_LINK_NOTE,
      date: "2026-11-12",
    });
    // The copy uses the Search date, not the sample leg's Oct 24 date (the old gap).
    expect(link.copyText).toContain("Thu, Nov 12, 2026");
    expect(link.copyText).toMatch(/dep 8:30\sAM/);
    expect(link.copyText).not.toContain("Oct 24");
  });

  it("AMTRAK: uses Boston North Station only on the Downeaster, and falls back to the homepage handoff without a code", () => {
    expect(purchaseLinkForLeg(leg({ from: "Portland", to: "Boston", line: "Downeaster · sample" }), "2026-11-12").href)
      .toBe(amtrakUrl("POR", "BON", "2026-11-12"));
    expect(purchaseLinkForLeg(leg({ from: "Boston", to: "Washington, DC", line: "Northeast Regional · sample" }), "2026-11-12").href)
      .toBe(amtrakUrl("BOS", "WAS", "2026-11-12"));
    const fallback = purchaseLinkForLeg(leg({ from: "Stony Brook", to: "New York" }), "2026-11-12");
    expect(fallback).toMatchObject({ href: "https://www.amtrak.com/", kind: "copy-handoff", label: "Copy details & open Amtrak", note: AMTRAK_HANDOFF_NOTE });
    expect(fallback.copyText).toContain("Thu, Nov 12, 2026");
  });

  it("FLIXBUS: exact shop search for the Search date; homepage when a city has no Flix id", () => {
    expect(purchaseLinkForLeg(flix, "2026-11-06")).toMatchObject({
      href: `https://shop.flixbus.com/search?departureCity=${PHILADELPHIA}&arrivalCity=${NEW_YORK}&rideDate=06.11.2026&adult=1`,
      kind: "exact-purchase",
      label: "Book Philadelphia → New York on FlixBus",
    });
    const fallback = purchaseLinkForLeg({ ...flix, from: "Trenton" }, "2026-11-06");
    expect(fallback).toMatchObject({ href: "https://www.flixbus.com/", kind: "official-ticket-page", label: "Open FlixBus ticket page" });
    expect(fallback.note).toContain("Trenton → New York");
  });

  it("GREYHOUND: exact shop search on the Greyhound shop; homepage for Stony Brook", () => {
    expect(purchaseLinkForLeg(greyhound, "2026-11-06")).toMatchObject({
      href: `https://shop.greyhound.com/search?departureCity=${BOSTON}&arrivalCity=${NEW_YORK}&rideDate=06.11.2026&adult=1`,
      kind: "exact-purchase",
      label: "Book Boston → New York on Greyhound",
    });
    expect(purchaseLinkForLeg({ ...greyhound, to: "Stony Brook" }, "2026-11-06"))
      .toMatchObject({ href: "https://www.greyhound.com/", kind: "official-ticket-page", label: "Open Greyhound ticket page" });
  });

  it("SEPTA: exact trip planner with both stations and the Search date", () => {
    const link = purchaseLinkForLeg(septa, "2026-11-06");
    expect(link.kind).toBe("exact-trip-planner");
    expect(link.label).toBe("Open SEPTA trip planner: Philadelphia, 30th Street → Trenton Transit Center");
    expect(link.href.startsWith("https://plan.septa.org/#/?")).toBe(true);
    expect(link.href).toContain("date=2026-11-06");
    expect(purchaseLinkForLeg({ ...septa, to: "Atlantis" }, "2026-11-06"))
      .toMatchObject({ href: "https://www.septa.org/fares/", kind: "official-ticket-page", label: "Open SEPTA ticket page" });
  });

  it("NJ_TRANSIT: exact WebTicketing purchase with both stations pre-selected", () => {
    expect(purchaseLinkForLeg(njt, "2026-11-06")).toMatchObject({
      href: "https://webtickets.njtransit.com/?origin=180&destination=0",
      kind: "exact-purchase",
      label: "Buy Trenton Transit Center → New York Penn Station on NJ TRANSIT",
    });
  });

  it("LIRR: official TrainTime page with a note naming the trip", () => {
    const link = purchaseLinkForLeg(lirr, "2026-11-06");
    expect(link).toMatchObject({ href: "https://www.mta.info/traintime", kind: "official-ticket-page", label: "Open LIRR ticket page" });
    expect(link.note).toContain("TrainTime");
  });

  it("uses the Search date over the leg's sample date, and the leg's date when no valid Search date is known", () => {
    expect(purchaseLinkForLeg(flix, "2026-12-01").href).toContain("rideDate=01.12.2026");
    expect(purchaseLinkForLeg(flix).href).toContain("rideDate=24.10.2026");
    expect(purchaseLinkForLeg(flix, "2026-02-30").href).toContain("rideDate=24.10.2026");
    expect(purchaseLinkForLeg(amtrak, null).href).toBe(amtrakUrl("PHL", "NYP", "2026-10-24"));
  });

  it("keeps a later leg's day offset from the trip's first departure", () => {
    const start = "2026-10-24T20:00:00-04:00";
    expect(purchaseDate("2026-10-25T01:30:00-04:00", "2026-11-12", start)).toBe("2026-11-13");
    expect(purchaseDate("2026-10-24T22:00:00-04:00", "2026-12-31", start)).toBe("2026-12-31");
    expect(purchaseDate("2026-10-25T01:30:00-04:00", "2026-12-31", start)).toBe("2027-01-01");
    expect(purchaseDate("2026-10-25T01:30:00-04:00", "2026-11-12")).toBe("2026-11-12");
  });

  it("only ever returns HTTPS links on the operator's own domain", () => {
    const trips = ["regional-connection", "amtrak-connection", "east-portland--miami--flixbus", "east-boston--stony-brook--greyhound", "east-portland--miami--amtrak"];
    for (const id of trips) for (const item of getTripById(id)!.legs) {
      for (const date of ["2026-11-06", undefined]) {
        const { href } = purchaseLinkForLeg(item, date, getTripById(id)!.legs[0].departure);
        expect(officialHref(item.agency, href), `${id} ${item.agency} ${href}`).toBe(href);
      }
    }
  });
});

describe("Amtrak link format", () => {
  it("encodes From, To and Date as single-item JSON arrays with no session or tracking parameters", () => {
    const url = new URL(amtrakPurchaseUrl("PHL", "NYP", "2026-11-12")!);
    expect(url.href).toBe(amtrakUrl("PHL", "NYP", "2026-11-12"));
    expect(url.origin + url.pathname).toBe("https://www.amtrak.com/tickets/departure.html");
    expect([...url.searchParams.keys()]).toEqual(["from_ticketing_stop_time_id", "to_ticketing_stop_time_id", "service_date"]);
    expect(JSON.parse(url.searchParams.get("from_ticketing_stop_time_id")!)).toEqual(["PHL"]);
    expect(JSON.parse(url.searchParams.get("service_date")!)).toEqual(["2026-11-12"]);
    expect(url.hash).toBe("");
    expect(url.href).not.toMatch(/cmp=|channel=|session/i);
    for (const bad of [["PHL", "PHL", "2026-11-12"], ["phl", "NYP", "2026-11-12"], ["PHL", "NYP", "11/12/2026"], ["PHL", "NYP", "2026-02-30"]] as const) {
      expect(amtrakPurchaseUrl(...bad)).toBeNull();
    }
  });

  it("maps every catalogue city code from the rail map station data", () => {
    const codes = new Map(geometry.stations.map((station) => [station.code, station.cityId]));
    for (const [cityId, code] of Object.entries(AMTRAK_CITY_CODES)) expect(codes.get(code)).toBe(cityId);
    expect(codes.get("BON")).toBe("boston");
    expect(amtrakStationCode("Philadelphia · 30th Street")).toBe("PHL");
    expect(amtrakStationCode("New York Penn Station")).toBe("NYP");
    expect(amtrakStationCode("Washington, DC")).toBe("WAS");
    expect(amtrakStationCode("Stony Brook")).toBeNull();
  });
});

describe("PurchaseLink Search date", () => {
  const html = (url: string) => renderToStaticMarkup(<MemoryRouter initialEntries={[url]}><PurchaseLink leg={flix} /></MemoryRouter>);

  it("reads ?date= on any page, the Search form date on Search, and this tab's last Search date elsewhere", () => {
    expect(html("/journey/x?date=2026-11-12")).toContain("rideDate=12.11.2026");
    expect(html("/?from=Philadelphia&to=New%20York&date=2026-11-13")).toContain("rideDate=13.11.2026");
    const today = defaultSearch.departureDate.split("-").reverse().join(".");
    expect(html("/")).toContain(`rideDate=${today}`);
    rememberSearchDate("2026-12-02");
    expect(html("/journey/x")).toContain("rideDate=02.12.2026");
    expect(html("/journey/x?date=2026-11-12")).toContain("rideDate=12.11.2026");
  });

  it("uses the leg's own date outside a router", () => {
    expect(renderToStaticMarkup(<PurchaseLink leg={flix} />)).toContain("rideDate=24.10.2026");
  });
});
