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

/** Typo fallback limits: queries of at least this many letters, within this edit distance. */
const TYPO_MIN_LETTERS = 5;
const TYPO_MAX_DISTANCE = 2;

/** Optimal string alignment distance: each insertion, deletion, substitution or adjacent swap costs 1. */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/** Build the text index once per supplied catalogue, without planning any routes. */
export function createLocationCatalogue(entries: readonly LocationCity[]): LocationCatalogue {
  const names = new Map<string, number>();
  const exactCounts = new Map<string, number>();
  const indexed = entries.map((city, order) => {
    const name = normalize(city.name);
    names.set(name, (names.get(name) ?? 0) + 1);
    const exact = [city.id, city.name, `${city.name}, ${city.state}`, ...(city.aliases ?? [])].map(normalize);
    for (const key of new Set(exact)) exactCounts.set(key, (exactCounts.get(key) ?? 0) + 1);
    return {
      city, order, exact,
      prefixes: [city.name, ...(city.aliases ?? [])].map(normalize),
      searchable: [...exact, city.state].map(normalize),
    };
  });
  return {
    suggest(value, limit = 8) {
      const query = normalize(value);
      const bound = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 8;
      if (!query) return indexed.slice(0, bound).map((entry) => entry.city);
      const matches = indexed.map((entry) => {
        const rank = entry.exact.includes(query) ? 0
          : entry.prefixes.some((text) => text.startsWith(query)) ? 1
          : entry.searchable.some((text) => (` ${text.replace(/-/g, " ")}`).includes(` ${query}`)) ? 2
          : entry.searchable.some((text) => text.includes(query)) ? 3
          : 4;
        return { ...entry, rank };
      }).filter((entry) => entry.rank < 4);
      if (matches.length) {
        return matches.sort((a, b) => a.rank - b.rank || a.order - b.order)
          .slice(0, bound)
          .map((entry) => entry.city);
      }
      // Typo fallback ("Bostn", "Philadelpia"): only when nothing matched above, and only for 5+ letters.
      // Compares the spellings accepted as exact matches: name, aliases, id and "name, state".
      if ((query.match(/\p{L}/gu)?.length ?? 0) < TYPO_MIN_LETTERS) return [];
      return indexed.map((entry) => ({ ...entry, distance: Math.min(...entry.exact.map((text) => editDistance(query, text))) }))
        .filter((entry) => entry.distance <= TYPO_MAX_DISTANCE)
        .sort((a, b) => a.distance - b.distance || a.order - b.order)
        .slice(0, bound)
        .map((entry) => entry.city);
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
