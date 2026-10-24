import { agencies } from "./agencies";

export const defaultSearch = {
  origin: "Philadelphia",
  destination: "Stony Brook",
  order: "recommended",
  includeAmtrak: true,
  mode: "all",
  operator: "all",
};
export type SearchState = typeof defaultSearch;
const city = (value: string | null, fallback: string) =>
  value?.trim().slice(0, 100) || fallback;

/** Read only supported values; malformed links retain a usable search. */
export function readSearchState(params: URLSearchParams): SearchState {
  const mode = params.get("mode") ?? "all";
  const operator = params.get("operator") ?? "all";
  const order = params.get("sort") ?? "recommended";
  return {
    origin: city(params.get("from"), defaultSearch.origin),
    destination: city(params.get("to"), defaultSearch.destination),
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
