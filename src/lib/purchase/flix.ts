import flixCities from "../../data/purchase/flixCities.json";

/**
 * FlixBus and Greyhound both sell on the Flix booking platform. Both shops share
 * one city catalogue, so they use the same city UUIDs. Their own search forms
 * open `/search?departureCity=<uuid>&arrivalCity=<uuid>&rideDate=DD.MM.YYYY&adult=1`
 * plus tracking parameters. We leave out the tracking parameters, so the link
 * does not depend on a session and still works when it is opened later.
 */
export type FlixBrand = "flixbus" | "greyhound";

type FlixCity = { flixbus?: string; greyhound?: string; name: string };

const FLIX_CITIES: Record<string, FlixCity> = flixCities;

const SHOP_ORIGINS: Record<FlixBrand, string> = {
  flixbus: "https://shop.flixbus.com",
  greyhound: "https://shop.greyhound.com",
};

/** Flix city UUID for one of our catalogue city ids, or null if we have not verified one. */
export function flixCityId(brand: FlixBrand, cityId: string): string | null {
  if (!Object.hasOwn(FLIX_CITIES, cityId)) return null;
  return FLIX_CITIES[cityId][brand] ?? null;
}

/** Converts YYYY-MM-DD to Flix's DD.MM.YYYY `rideDate`. Returns null if it is not a real calendar date. */
function toRideDate(date: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${day}.${month}.${year}`;
}

/**
 * A search-results link on the operator's shop for one adult on `date` (YYYY-MM-DD).
 * Returns null when a city has no verified Flix id, when the date is invalid, or when
 * both ends map to the same Flix city. Callers can then link to the operator's homepage instead.
 */
export function flixPurchaseUrl(
  brand: FlixBrand,
  fromCityId: string,
  toCityId: string,
  date: string,
): string | null {
  const departureCity = flixCityId(brand, fromCityId);
  const arrivalCity = flixCityId(brand, toCityId);
  const rideDate = toRideDate(date);
  if (!departureCity || !arrivalCity || !rideDate || departureCity === arrivalCity) return null;
  const params = new URLSearchParams({ departureCity, arrivalCity, rideDate, adult: "1" });
  return `${SHOP_ORIGINS[brand]}/search?${params}`;
}
