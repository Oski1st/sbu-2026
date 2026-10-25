import { cities } from "../../data/eastCoast";

export interface LocationCity {
  id: string;
  name: string;
  state: string;
  aliases?: readonly string[];
}
export interface LocationCatalogue {
  suggest: (value: string, limit?: number) => readonly LocationCity[];
  isSupported: (value: string) => boolean;
  selectionValue: (city: LocationCity) => string;
}
const normalize = (value: string) =>
  value.toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");

/** Build the text index once per supplied catalogue, without planning any routes. */
export function createLocationCatalogue(entries: readonly LocationCity[]): LocationCatalogue {
  const names = new Map<string, number>();
  const exactCounts = new Map<string, number>();
  const indexed = entries.map((city) => {
    const name = normalize(city.name);
    names.set(name, (names.get(name) ?? 0) + 1);
    const exact = [city.id, city.name, `${city.name}, ${city.state}`, ...(city.aliases ?? [])].map(normalize);
    for (const key of new Set(exact)) exactCounts.set(key, (exactCounts.get(key) ?? 0) + 1);
    return { city, exact, searchable: [...exact, city.state].map(normalize) };
  });
  return {
    suggest(value, limit = 8) {
      const query = normalize(value);
      const bound = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 8;
      const result: LocationCity[] = [];
      for (const entry of indexed) {
        if (!query || entry.searchable.some((text) => text.includes(query))) result.push(entry.city);
        if (result.length === bound) break;
      }
      return result;
    },
    isSupported(value) {
      const query = normalize(value);
      return !!query && exactCounts.get(query) === 1;
    },
    selectionValue(city) {
      return (names.get(normalize(city.name)) ?? 0) > 1 ? `${city.name}, ${city.state}` : city.name;
    },
  };
}

const aliases: Record<string, readonly string[]> = {
  "new-york": ["NYC", "New York City"],
  philadelphia: ["Philly"],
  washington: ["DC", "Washington DC", "Washington D C"],
  portland: ["Portland Maine"],
  "stony-brook": ["Long Island"],
};

/** Only the existing routing catalogue; listed national places are a later dependency. */
export const sampleLocationCatalogue = createLocationCatalogue(
  cities.map((city) => ({ ...city, aliases: aliases[city.id] })),
);
