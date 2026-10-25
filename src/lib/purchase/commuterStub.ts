import { officialTicketPage } from "./official";

/**
 * STUB until feat/purchase-links-commuter lands: same signature as
 * src/lib/purchase/commuter.ts, returning each operator's current official page.
 */
export type CommuterAgency = "SEPTA" | "NJ_TRANSIT" | "LIRR";
export type CommuterLinkKind = "exact-purchase" | "exact-trip-planner" | "official-ticket-page";
export interface CommuterLink { href: string; kind: CommuterLinkKind; note: string }

const names: Record<CommuterAgency, string> = { SEPTA: "SEPTA", NJ_TRANSIT: "NJ TRANSIT", LIRR: "LIRR" };

export function commuterPurchaseLink(agency: CommuterAgency, _fromStation: string, _toStation: string, _date: string): CommuterLink {
  return { href: officialTicketPage(agency), kind: "official-ticket-page", note: `Choose your stations and date on ${names[agency]}'s official site.` };
}
