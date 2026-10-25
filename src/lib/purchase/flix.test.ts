import { describe, expect, test } from "vitest";
import { cities } from "../../data/eastCoast";
import flixCities from "../../data/purchase/flixCities.json";
import { flixCityId, flixPurchaseUrl } from "./flix";

const PHILADELPHIA = "fd509c08-0a3e-4a44-b933-79f4a9db13da";
const NEW_YORK = "c0a47c54-53ea-46dc-984b-b764fc0b2fa9";
const BOSTON = "eeff627f-2fda-4e75-8468-783d47955b3a";

describe("flixPurchaseUrl", () => {
  test("builds the FlixBus search URL that was checked in the browser", () => {
    expect(flixPurchaseUrl("flixbus", "philadelphia", "new-york", "2026-11-06")).toBe(
      `https://shop.flixbus.com/search?departureCity=${PHILADELPHIA}&arrivalCity=${NEW_YORK}&rideDate=06.11.2026&adult=1`,
    );
  });

  test("builds the Greyhound search URL with the same Flix city ids on the Greyhound shop", () => {
    expect(flixPurchaseUrl("greyhound", "boston", "new-york", "2026-11-06")).toBe(
      `https://shop.greyhound.com/search?departureCity=${BOSTON}&arrivalCity=${NEW_YORK}&rideDate=06.11.2026&adult=1`,
    );
  });

  test("has no session or tracking parameters", () => {
    const url = new URL(flixPurchaseUrl("greyhound", "philadelphia", "new-york", "2026-12-31")!);
    expect([...url.searchParams.keys()]).toEqual(["departureCity", "arrivalCity", "rideDate", "adult"]);
    expect(url.searchParams.get("rideDate")).toBe("31.12.2026");
  });

  test("returns null when a city has no verified Flix id, so callers can fall back to the homepage", () => {
    expect(flixPurchaseUrl("flixbus", "trenton", "new-york", "2026-11-06")).toBeNull();
    expect(flixPurchaseUrl("greyhound", "new-york", "stony-brook", "2026-11-06")).toBeNull();
    expect(flixPurchaseUrl("flixbus", "atlantis", "new-york", "2026-11-06")).toBeNull();
    expect(flixPurchaseUrl("flixbus", "__proto__", "new-york", "2026-11-06")).toBeNull();
    expect(flixPurchaseUrl("flixbus", "constructor", "new-york", "2026-11-06")).toBeNull();
  });

  test("returns null for malformed or impossible dates and for same-city trips", () => {
    expect(flixPurchaseUrl("flixbus", "philadelphia", "new-york", "11/06/2026")).toBeNull();
    expect(flixPurchaseUrl("flixbus", "philadelphia", "new-york", "2026-02-30")).toBeNull();
    expect(flixPurchaseUrl("flixbus", "philadelphia", "new-york", "2026-13-01")).toBeNull();
    expect(flixPurchaseUrl("flixbus", "philadelphia", "new-york", "")).toBeNull();
    expect(flixPurchaseUrl("greyhound", "boston", "boston", "2026-11-06")).toBeNull();
  });
});

describe("flixCities.json", () => {
  const entries = Object.entries(flixCities as Record<string, { flixbus?: string; greyhound?: string; name: string }>);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  test("only uses catalogue city ids and well-formed Flix UUIDs", () => {
    const catalogue = new Set(cities.map((city) => city.id));
    expect(entries.length).toBeGreaterThan(0);
    for (const [cityId, entry] of entries) {
      expect(catalogue.has(cityId)).toBe(true);
      expect(entry.name).toBeTruthy();
      for (const id of [entry.flixbus, entry.greyhound]) if (id) expect(id).toMatch(uuid);
    }
  });

  test("gives FlixBus and Greyhound the same shared Flix city id", () => {
    for (const [cityId, entry] of entries) {
      expect(flixCityId("flixbus", cityId)).toBe(entry.flixbus ?? null);
      if (entry.flixbus && entry.greyhound) expect(entry.greyhound).toBe(entry.flixbus);
    }
    expect(new Set(entries.map(([, entry]) => entry.flixbus)).size).toBe(entries.length);
  });
});
