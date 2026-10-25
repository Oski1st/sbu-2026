/** Explicit reviewed name-market links only; never municipal or stop equivalence. */
export interface MarketRelation {
  cityId: string;
  sameMarketAsCityId: string;
  qualification: 'named-city-market-alias';
  checkedDate: string;
  sourceUrls: readonly string[];
  observation: string;
  note: string;
}

export function createMarketRelationIndex(
  cities: readonly { id: string; state: string }[],
  relations: readonly MarketRelation[],
) {
  const known = new Map(cities.map(city => [city.id, city.state]));
  const links = new Map<string, string>();
  for (const relation of relations) {
    const { cityId, sameMarketAsCityId: target } = relation;
    if (!known.has(cityId) || !known.has(target)) throw new Error('Unknown market relation endpoint');
    if (cityId === target || links.has(cityId)) throw new Error('Self or duplicate market relation');
    if (known.get(cityId) !== known.get(target)) throw new Error('Cross-state market relation');
    if (relation.qualification !== 'named-city-market-alias' || !/^\d{4}-\d{2}-\d{2}$/.test(relation.checkedDate) ||
      (!Number.isFinite(Date.parse(relation.checkedDate)) || new Date(relation.checkedDate).toISOString().slice(0,10) !== relation.checkedDate) || !relation.observation.trim() || !relation.note.trim() || !relation.sourceUrls.length) {
      throw new Error('Missing explicit market relation provenance');
    }
    for (const source of relation.sourceUrls) {
      const url = new URL(source);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Unsafe relation source');
    }
    links.set(cityId, target);
  }
  for (const start of links.keys()) {
    const visited = new Set<string>();
    for (let at = start; links.has(at); at = links.get(at)!) {
      if (visited.has(at)) throw new Error('Cyclic market relations');
      visited.add(at);
    }
  }
  return {
    canonical(id: string): string | undefined {
      if (!known.has(id)) return undefined;
      let at = id;
      while (links.has(at)) at = links.get(at)!;
      return at;
    },
  };
}
