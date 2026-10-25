import { agencies } from "./agencies";

export const defaultSearch = {
  origin: "Philadelphia",
  destination: "Stony Brook",
  /** Preferences only; sample route times stay tied to the demonstration data. */
  departureDate: "2026-10-24",
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
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
    ? value
    : defaultSearch.departureDate;
};
const time = (value: string | null) => {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return defaultSearch.departureTime;
  const [hours, minutes] = value.split(":").map(Number);
  return hours < 24 && minutes < 60 ? value : defaultSearch.departureTime;
};

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
