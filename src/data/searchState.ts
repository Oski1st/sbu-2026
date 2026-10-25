import { agencies } from "./agencies";

/** Today's calendar date (YYYY-MM-DD) for the sample corridors' home time zone. */
export function todayInNewYork(now = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export const defaultSearch = {
  origin: "Philadelphia",
  destination: "Stony Brook",
  /** Preferences only; when set in the URL they shift the sample timeline as a demo preview. */
  departureDate: todayInNewYork(),
  departureTime: "08:00",
  order: "recommended",
  includeAmtrak: true,
  mode: "all",
  operator: "all",
};
export type SearchState = typeof defaultSearch;
const city = (value: string | null, fallback: string) =>
  value?.trim().slice(0, 100) || fallback;
const date = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return defaultSearch.departureDate;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(0);
  // setUTCFullYear keeps years 0001-0099 literal; Date.UTC would map them to 1900-1999.
  candidate.setUTCFullYear(year, month - 1, day);
  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
    ? value
    : defaultSearch.departureDate;
};
/**
 * The HH:mm value of a planning time, or null when it is not a complete, valid time.
 * Native time fields serialize as 24-hour values, even on systems that display
 * “04:30 PM”. Accept that familiar display form (shared links, text-field fallbacks)
 * too, then always return the valid HH:mm value required by <input type="time">.
 */
export function parsePlanningTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const twelveHour = trimmed.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (twelveHour) {
    const hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    if (hours >= 1 && hours <= 12 && minutes < 60) {
      const clockHours = (hours % 12) + (twelveHour[3].toUpperCase() === "PM" ? 12 : 0);
      return `${String(clockHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
    return null;
  }
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(":").map(Number);
  return hours < 24 && minutes < 60 ? trimmed : null;
}
const time = (value: string | null) => parsePlanningTime(value) ?? defaultSearch.departureTime;

/** Latest date the Search form accepts; also the date input's max. */
export const MAX_PLANNING_DATE = "9999-12-31";

/**
 * True for a real YYYY-MM-DD date from today (New York) through MAX_PLANNING_DATE.
 * Chrome can roll a typed 5-digit year into e.g. 0270, or keep 20270; neither is applied.
 */
export function isPlanningDate(value: string, today = todayInNewYork()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && date(value) === value && value >= today && value <= MAX_PLANNING_DATE;
}

/** A new search (form or corridor shortcut) clears mode/operator filters so they cannot hide every route. */
export function newSearchPatch(
  origin: string,
  destination: string,
  preferences: Pick<SearchState, "departureDate" | "departureTime">,
): Partial<SearchState> {
  return {
    origin: origin.trim(),
    destination: destination.trim(),
    ...preferences,
    mode: defaultSearch.mode,
    operator: defaultSearch.operator,
    includeAmtrak: defaultSearch.includeAmtrak,
  };
}

/** Read only supported values; malformed links retain a usable search. */
export function readSearchState(params: URLSearchParams): SearchState {
  const mode = params.get("mode") ?? "all";
  const operator = params.get("operator") ?? "all";
  const order = params.get("sort") ?? "recommended";
  return {
    origin: city(params.get("from"), defaultSearch.origin),
    destination: city(params.get("to"), defaultSearch.destination),
    departureDate: date(params.get("date")),
    departureTime: time(params.get("time")),
    mode: ["all", "rail", "bus", "mixed"].includes(mode) ? mode : "all",
    operator: Object.hasOwn(agencies, operator) ? operator : "all",
    order: ["recommended", "fastest", "fare"].includes(order)
      ? order
      : "recommended",
    includeAmtrak: params.get("amtrak") !== "0",
  };
}

/** True when the URL carries a planning date or time; Search, Journey and Wallet then shift the sample timeline to it. */
export function hasPlanningPreference(params: URLSearchParams): boolean {
  return params.has("date") || params.has("time");
}

/** `?date=…&time=…` for Journey/Wallet links when the URL carries a planning preference; "" keeps the fixed sample. */
export function planningSearchFrom(params: URLSearchParams): string {
  if (!hasPlanningPreference(params)) return "";
  const { departureDate, departureTime } = readSearchState(params);
  return `?${new URLSearchParams({ date: departureDate, time: departureTime })}`;
}

const preferenceDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Tue, Nov 3, 2026 4:30 PM" for a YYYY-MM-DD date and HH:mm time, independent of the viewer's zone. */
export function describePlanningPreference(departureDate: string, departureTime: string): string {
  const [year, month, day] = departureDate.split("-").map(Number);
  const noon = new Date(0);
  noon.setUTCFullYear(year, month - 1, day);
  noon.setUTCHours(12);
  const [hours, minutes] = departureTime.split(":").map(Number);
  return `${preferenceDateFormat.format(noon)} ${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/**
 * Write a chosen planning date and time into the URL. Both are always explicit, even when
 * they equal today and 08:00, so the shifted results never fall back to the fixed sample.
 */
export function writePlanningPreference(
  preferences: Pick<SearchState, "departureDate" | "departureTime">,
  current = new URLSearchParams(),
): URLSearchParams {
  const params = writeSearchState({ ...readSearchState(current), ...preferences }, current);
  params.set("date", preferences.departureDate);
  params.set("time", preferences.departureTime);
  return params;
}

/** Persist the whole submitted search atomically, preserving unrelated query keys. */
export function writeSearchState(
  state: SearchState,
  current = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(current);
  const fields = {
    from: [state.origin, defaultSearch.origin],
    to: [state.destination, defaultSearch.destination],
    date: [state.departureDate, defaultSearch.departureDate],
    time: [state.departureTime, defaultSearch.departureTime],
    sort: [state.order, defaultSearch.order],
    mode: [state.mode, defaultSearch.mode],
    operator: [state.operator, defaultSearch.operator],
    amtrak: [state.includeAmtrak ? "1" : "0", "1"],
  };
  for (const [key, [value, fallback]] of Object.entries(fields)) {
    if (value === fallback) params.delete(key);
    else params.set(key, value);
  }
  return params;
}
