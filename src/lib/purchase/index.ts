import type { Agency, Leg } from "../../types/transit";
import { resolveCity } from "../../data/eastCoast";
import { AMTRAK_BOOKING_URL, AMTRAK_HANDOFF_NOTE, amtrakTripText } from "../amtrakHandoff";
import { flixPurchaseUrl } from "./flix";
import { commuterPurchaseLink } from "./commuter";
import { amtrakPurchaseUrl, amtrakStationCode } from "./amtrak";
import { longDate, purchaseDate, shortDate } from "./dates";
import { officialHref, officialTicketPage } from "./official";

export type PurchaseLinkKind = "exact-purchase" | "exact-trip-planner" | "official-ticket-page" | "copy-handoff";

export interface PurchaseLink {
  href: string;
  kind: PurchaseLinkKind;
  /** Visible label that says what the link does. */
  label: string;
  /** Amtrak only: trip details copied when the link is clicked. */
  copyText?: string;
  /** Short plain-language note shown with the link. */
  note?: string;
  /** YYYY-MM-DD the link was built for. */
  date?: string;
}

export const AMTRAK_DEEP_LINK_NOTE =
  "If Amtrak shows an error, your trip details are copied — enter them on Amtrak's booking page.";

const operatorNames: Record<Agency, string> = {
  SEPTA: "SEPTA", NJ_TRANSIT: "NJ TRANSIT", LIRR: "LIRR", AMTRAK: "Amtrak", GREYHOUND: "Greyhound", FLIXBUS: "FlixBus",
};

const place = (value: string) => value.replace(/\s*·\s*/g, ", ").replace(/\s+/g, " ").trim();

/**
 * The one purchase/search link for a leg. `searchDate` (YYYY-MM-DD) is the user's
 * Search date; `tripStart` is the trip's first departure so later legs keep their day offset.
 */
export function purchaseLinkForLeg(leg: Leg, searchDate?: string | null, tripStart?: string): PurchaseLink {
  const date = purchaseDate(leg.departure, searchDate, tripStart);
  const name = operatorNames[leg.agency] ?? leg.agency;
  const from = place(leg.from);
  const to = place(leg.to);
  const official = (note: string): PurchaseLink => ({
    href: officialTicketPage(leg.agency), kind: "official-ticket-page", label: `Open ${name} ticket page`, note, date,
  });

  switch (leg.agency) {
    case "AMTRAK": {
      const copyText = amtrakTripText({ ...leg, date });
      const fromCode = amtrakStationCode(leg.from, leg.line);
      const toCode = amtrakStationCode(leg.to, leg.line);
      const href = fromCode && toCode && date ? amtrakPurchaseUrl(fromCode, toCode, date) : null;
      return href && date
        ? { href, kind: "exact-purchase", label: `Open ${from} → ${to} on Amtrak (${shortDate(date)})`, copyText, note: AMTRAK_DEEP_LINK_NOTE, date }
        : { href: AMTRAK_BOOKING_URL, kind: "copy-handoff", label: "Copy details & open Amtrak", copyText, note: AMTRAK_HANDOFF_NOTE, date };
    }
    case "FLIXBUS":
    case "GREYHOUND": {
      const brand = leg.agency === "FLIXBUS" ? "flixbus" : "greyhound";
      const fromId = resolveCity(leg.from)?.id;
      const toId = resolveCity(leg.to)?.id;
      const href = officialHref(leg.agency, fromId && toId && date ? flixPurchaseUrl(brand, fromId, toId, date) : null);
      return href && date
        ? { href, kind: "exact-purchase", label: `Book ${from} → ${to} on ${name}`, note: `Opens ${name} search results for ${longDate(date)}. Nothing is reserved until you book with ${name}.`, date }
        : official(`Enter ${from} → ${to}${date ? ` and ${longDate(date)}` : ""} on ${name}'s site.`);
    }
    case "SEPTA":
    case "NJ_TRANSIT":
    case "LIRR": {
      const result = commuterPurchaseLink(leg.agency, leg.from, leg.to, date ?? "");
      const href = officialHref(leg.agency, result.href);
      if (!href) return official(result.note);
      const label = result.kind === "exact-purchase"
        ? `Buy ${from} → ${to} on ${name}`
        : result.kind === "exact-trip-planner"
          ? `Open ${name} trip planner: ${from} → ${to}`
          : `Open ${name} ticket page`;
      return { href, kind: result.kind, label, note: result.note, date };
    }
    default:
      return official("Confirm tickets with the operator.");
  }
}
