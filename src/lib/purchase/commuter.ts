import stationData from "../../data/purchase/commuterStations.json";

/**
 * Most exact working purchase link for a commuter-rail leg (verified 2026-10-25 in Chromium).
 * - SEPTA: no station-to-station web checkout, so the SEPTA Trip Planner is deep-linked
 *   (stations + date pre-filled, itinerary auto-planned).
 * - NJ TRANSIT: WebTicketing accepts origin/destination station codes and pre-selects both.
 *   Rail tickets are not tied to a date (valid 30 days from purchase).
 * - LIRR: tickets are sold in the TrainTime app only; neither TrainTime web nor
 *   mta.info/schedules accepts from/to URL parameters, so the official TrainTime page is used.
 * Pure: no network, no session tokens in any generated URL.
 */
export type CommuterOperator = "SEPTA" | "NJ_TRANSIT" | "LIRR";
export type CommuterLinkKind =
  | "exact-purchase"
  | "exact-trip-planner"
  | "official-ticket-page";
export interface CommuterPurchaseLink {
  href: string;
  kind: CommuterLinkKind;
  note: string;
}

interface CommuterStation {
  id: string;
  name: string;
  aliases: string[];
  code?: string;
  stopId?: string;
  lat?: number;
  lon?: number;
  zone?: number;
}

export const commuterOfficialTicketPages: Record<CommuterOperator, string> = {
  SEPTA: "https://www.septa.org/fares/",
  NJ_TRANSIT: "https://www.njtransit.com/tickets/train-tickets",
  LIRR: "https://www.mta.info/traintime",
};

const operatorNames: Record<CommuterOperator, string> = {
  SEPTA: "SEPTA",
  NJ_TRANSIT: "NJ TRANSIT",
  LIRR: "LIRR",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Resolves a OneLine station label (e.g. "Philadelphia · 30th Street") to the operator's station record. */
export function findCommuterStation(
  operator: CommuterOperator,
  name: string,
): CommuterStation | undefined {
  const key = normalize(name);
  if (!key) return undefined;
  const stations = (stationData[operator]?.stations ?? []) as CommuterStation[];
  return stations.find((station) =>
    [station.name, ...station.aliases].some((alias) => normalize(alias) === key),
  );
}

const isIsoDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};

const query = (params: Record<string, string>) =>
  Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

function officialPage(
  operator: CommuterOperator,
  reason: string,
): CommuterPurchaseLink {
  return {
    href: commuterOfficialTicketPages[operator],
    kind: "official-ticket-page",
    note: `${reason} Opens the official ${operatorNames[operator]} ticket page.`,
  };
}

export function commuterPurchaseLink(
  operator: CommuterOperator,
  fromStation: string,
  toStation: string,
  date: string /* YYYY-MM-DD */,
): CommuterPurchaseLink {
  if (!(operator in commuterOfficialTicketPages))
    return {
      href: "",
      kind: "official-ticket-page",
      note: `Unsupported commuter operator: ${String(operator)}.`,
    };
  const from = findCommuterStation(operator, fromStation);
  const to = findCommuterStation(operator, toStation);
  if (!from || !to)
    return officialPage(
      operator,
      `No verified ${operatorNames[operator]} station mapping for ${!from ? fromStation : toStation}.`,
    );
  if (from.id === to.id)
    return officialPage(operator, "Origin and destination are the same station.");

  switch (operator) {
    case "SEPTA": {
      if (!isIsoDate(date))
        return officialPage(operator, `Invalid travel date "${date}" (expected YYYY-MM-DD).`);
      const place = (s: CommuterStation) => `${s.name}::${s.lat},${s.lon}`;
      return {
        href: `https://plan.septa.org/#/?${query({
          fromPlace: place(from),
          toPlace: place(to),
          date,
          mode: "WALK,TRANSIT",
        })}`,
        kind: "exact-trip-planner",
        note: `SEPTA Trip Planner for ${from.name} → ${to.name} on ${date}. SEPTA has no station-to-station web checkout; pay with SEPTA Key or at the station.`,
      };
    }
    case "NJ_TRANSIT":
      return {
        href: `https://webtickets.njtransit.com/?${query({
          origin: from.code!,
          destination: to.code!,
        })}`,
        kind: "exact-purchase",
        note: `NJ TRANSIT WebTicketing with ${from.name} → ${to.name} pre-selected. Rail tickets are not tied to a train or date and are valid 30 days from purchase.`,
      };
    case "LIRR":
      return {
        href: commuterOfficialTicketPages.LIRR,
        kind: "official-ticket-page",
        note: `LIRR tickets are sold in the MTA TrainTime app; no web link pre-fills stations. In TrainTime, buy ${from.name} → ${to.name}${isIsoDate(date) ? ` for ${date}` : ""}.`,
      };
  }
}
