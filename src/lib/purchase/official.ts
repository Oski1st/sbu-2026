import type { Agency } from "../../types/transit";
import { agencies } from "../../data/agencies";
import { AMTRAK_BOOKING_URL } from "../amtrakHandoff";

/** Operator-owned HTTPS domains a purchase link may open. */
export const OFFICIAL_DOMAINS: Record<Agency, readonly string[]> = {
  SEPTA: ["septa.org", "septakey.org"],
  NJ_TRANSIT: ["njtransit.com"],
  LIRR: ["mta.info"],
  AMTRAK: ["amtrak.com"],
  GREYHOUND: ["greyhound.com"],
  FLIXBUS: ["flixbus.com"],
};

/** The operator's stable official ticket page (not trip-specific). */
export function officialTicketPage(agency: Agency): string {
  return agencies[agency]?.purchaseUrl ?? "";
}

/** The URL itself when it is HTTPS on the operator's own domain without credentials or a port; otherwise null. */
export function officialHref(agency: Agency, candidate: unknown): string | null {
  const domains = OFFICIAL_DOMAINS[agency];
  if (!domains || typeof candidate !== "string") return null;
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
      domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
      return url.href;
    }
  } catch {
    /* Invalid URL. */
  }
  return null;
}

/** Accept only HTTPS agency-owned destinations; never follow arbitrary trip-data links. */
export function officialPurchaseUrl(agency: Agency, candidate: string): string {
  const fallback = officialTicketPage(agency);
  if (!fallback) return "";
  // Stored Amtrak URLs may be expiring session links: only ever use the stable booking page.
  if (agency === "AMTRAK") return AMTRAK_BOOKING_URL;
  return officialHref(agency, candidate) ?? fallback;
}
