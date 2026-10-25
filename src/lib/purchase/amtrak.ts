import { resolveCity } from "../../data/eastCoast";
import { isCalendarDate } from "./dates";

/**
 * Amtrak station codes for our catalogue cities, from src/data/railMap/geometry.json
 * (the same codes as the map's amtrak.com/stations/<code>.html links).
 * Boston uses South Station except on the Downeaster (North Station);
 * Richmond uses Staples Mill Road, which every Richmond service in our sample uses.
 */
export const AMTRAK_CITY_CODES: Record<string, string> = {
  portland: "POR", boston: "BOS", providence: "PVD", hartford: "HFD", "new-haven": "NHV",
  albany: "ALB", "new-york": "NYP", trenton: "TRE", philadelphia: "PHL", baltimore: "BAL",
  washington: "WAS", richmond: "RVR", norfolk: "NFK", raleigh: "RGH", charlotte: "CLT",
  fayetteville: "FAY", charleston: "CHS", savannah: "SAV", jacksonville: "JAX", orlando: "ORL",
  tampa: "TPA", "fort-lauderdale": "FTL", miami: "MIA",
};

/** Station names used by the original Philadelphia → Stony Brook sample trips. */
const STATION_NAMES: Record<string, string> = {
  "new york penn station": "NYP",
  "philadelphia 30th street": "PHL",
  "trenton transit center": "TRE",
};

const normalize = (value: string) => value.toLowerCase().replace(/[·.,]/g, " ").replace(/\s+/g, " ").trim();

/** Amtrak 3-letter code for a leg's station or city name, or null when we have not mapped one. */
export function amtrakStationCode(station: string, line = ""): string | null {
  const named = STATION_NAMES[normalize(station)];
  if (named) return named;
  const city = resolveCity(station) ?? resolveCity(station.split("·")[0]);
  if (!city || !Object.hasOwn(AMTRAK_CITY_CODES, city.id)) return null;
  if (city.id === "boston" && /downeaster/i.test(line)) return "BON";
  return AMTRAK_CITY_CODES[city.id];
}

const param = (value: string) => encodeURIComponent(JSON.stringify([value]));

/**
 * Amtrak's own search form opens /tickets/departure.html with From, To and Date
 * as single-item JSON arrays. This form has no session token and still works when
 * re-opened later. No cmp= or channel= tracking parameters are added.
 */
export function amtrakPurchaseUrl(fromCode: string, toCode: string, date: string): string | null {
  if (!/^[A-Z]{3}$/.test(fromCode) || !/^[A-Z]{3}$/.test(toCode) || fromCode === toCode || !isCalendarDate(date)) return null;
  return `https://www.amtrak.com/tickets/departure.html?from_ticketing_stop_time_id=${param(fromCode)}&to_ticketing_stop_time_id=${param(toCode)}&service_date=${param(date)}`;
}
