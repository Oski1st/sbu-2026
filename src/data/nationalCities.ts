import candidates from './national/candidates.json';
import operatorPlaces from './national/operatorPlaces.json';
import evidence from './national/coverage.json';
import manifest from './national/sources.json';
import batch1 from './national/evidence/batch1.json';
import { createMarketRelationIndex } from './national/marketRelations';
import type { MarketRelation } from './national/marketRelations';

/** Existing OneLine operators only. No service, fare or direct-route inference. */
export const nationalOperators = ['SEPTA', 'NJ_TRANSIT', 'LIRR', 'AMTRAK', 'GREYHOUND', 'FLIXBUS'] as const;
export type NationalOperator = typeof nationalOperators[number];

export interface AmtrakModeEvidence {
  cityId: string;
  stopIds: readonly string[];
  routeIds: readonly string[];
  routeTypes: readonly number[];
  qualification: 'rail-only' | 'rail-and-bus' | 'bus-only' | 'unverified';
  sourceUrl: string;
  responseSha256: string;
  checkedDate: string;
  feedVersion: string;
  feedStartDate: string;
  note: string;
}
export interface MarketCoverage {
  status: 'verified';
  marketedOperator: NationalOperator;
  /** A named service-area listing, never a municipal-boundary assertion. */
  qualification: 'city-market';
  sourceUrl: string;
  evidenceUrl: string;
  additionalSourceUrls?: readonly string[];
  checkedDate: string;
  checkedAt?: string;
  responseSha256?: string;
  /** Both bus brands share source provenance; two brands are not two independent confirmations. */
  sourceFamily?: 'flix-greyhound-shared-directories';
  independentCorroboration?: false;
  /** Snapshot mode only. Never label a bus-only or unverified Amtrak record as train proof. */
  modeEvidence?: AmtrakModeEvidence;
  stops: readonly string[];
  municipalCoverage: 'pending';
  operatingCarrier: 'pending';
  note: string;
}
export interface PendingCoverage {
  status: 'pending' | 'excluded';
  marketedOperator: NationalOperator;
  qualification: 'unresolved';
  sourceUrl: string;
  checkedDate: string;
  reason: string;
}
export type OperatorCoverage = MarketCoverage | PendingCoverage;

export interface NationalCity {
  id: string;
  name: string;
  state: string;
  censusGeoid: string | null;
  censusName: string | null;
  geography: 'incorporated-place' | 'consolidated-balance' | 'census-designated-place' | 'operator-market';
  /** Rounded Census Gazetteer internal point; not a station, user position or guaranteed downtown centre. */
  latitude: number | null;
  longitude: number | null;
  aliases: readonly string[];
  population: number | null;
  populationVintage: number | null;
  inclusionReason: 'population-100000' | 'regional-hub' | 'excluded-non-incorporated' | 'operator-listed-place';
  legacyId: boolean;
  /** Explicit named-market link only; raw audit IDs/population/coordinates stay separate. */
  sameMarketAsCityId?: string;
  coordinateSourceUrl: string | null;
  coordinateMethod: 'census-internal-point' | 'operator-stop-representative' | 'unavailable';
  populationSourceUrl: string | null;
  auditStatus: 'verified' | 'unresolved' | 'excluded';
  coverage: readonly OperatorCoverage[];
}

/** Reproducible source versions/hashes and selection rules; see national/README.md. */
export const nationalCatalogueSources = manifest;
const checked = manifest.checkedDate;
const directory: Record<NationalOperator, string> = {
  SEPTA: 'https://www.septa.org/stations/',
  NJ_TRANSIT: 'https://www.njtransit.com/station',
  LIRR: 'https://www.mta.info/stations',
  AMTRAK: 'https://www.amtrak.com/plan-your-trip.html',
  GREYHOUND: 'https://www.greyhound.com/bus/united-states',
  FLIXBUS: 'https://www.flixbus.com/bus/united-states',
};
export const nationalEvidenceBatches = [batch1] as const;
export const nationalCityMarketRelations = batch1.marketRelations as readonly MarketRelation[];
const relationByCity = new Map(nationalCityMarketRelations.map(relation => [relation.cityId, relation]));
export const nationalBusSourceProvenance = batch1.busSourceProvenance;
const modeByCity = new Map((batch1.modeEvidence as readonly AmtrakModeEvidence[]).map(mode => [mode.cityId, mode]));
const records: readonly (MarketCoverage & { cityId: string })[] =
  ([...evidence, ...batch1.coverageAdditions] as readonly (MarketCoverage & { cityId: string })[])
    .map(record => ({ ...record,
      ...(['FLIXBUS', 'GREYHOUND'].includes(record.marketedOperator)
        ? { sourceFamily: 'flix-greyhound-shared-directories' as const, independentCorroboration: false as const } : {}),
      ...(record.marketedOperator === 'AMTRAK' ? { modeEvidence: modeByCity.get(record.cityId) } : {}),
    }));

/**
 * All candidates, including excluded/unresolved rows: NOT all supported origins.
 * Verified means “Listed service area — check boarding stop”. It does not mean
 * the stop is inside municipal limits, the named brand operates the vehicle,
 * tickets are available now, or any city pair is connected. No pairs are generated.
 * P2 must preserve coverage qualification in autocomplete/details. Location may
 * consume verifiedNationalCities structurally but suggests a city, not a station.
 * Gazetteer internal points (including large/irregular municipal areas) can be
 * far from downtown. Distances to these approximate points are not transit distances.
 */
const byCityOperator = new Map(records.map(record => [record.cityId + ':' + record.marketedOperator, record]));
export const nationalCities: readonly NationalCity[] = [...candidates, ...operatorPlaces].map(raw => {
  const city = raw as Omit<NationalCity, 'coordinateSourceUrl' | 'coordinateMethod' | 'populationSourceUrl' | 'auditStatus' | 'coverage'>;
  const excluded = city.inclusionReason === 'excluded-non-incorporated';
  const coverage: OperatorCoverage[] = nationalOperators.map(operator => {
    const found = byCityOperator.get(city.id + ':' + operator);
    if (found && !excluded) return found;
    return {
      status: excluded ? 'excluded' : 'pending', marketedOperator: operator,
      qualification: 'unresolved', sourceUrl: directory[operator], checkedDate: checked,
      reason: excluded
        ? 'Census non-incorporated exception outside the major-city selection; no service-absence claim.'
        : 'No qualifying evidence recorded in this audit. Missing evidence is not evidence of no service.',
    };
  });
  return {
    ...city, ...(relationByCity.has(city.id) ? { sameMarketAsCityId: relationByCity.get(city.id)!.sameMarketAsCityId } : {}), coordinateSourceUrl: 'coordinateSourceUrl' in raw ? raw.coordinateSourceUrl as string | null : manifest.coordinates.url,
    coordinateMethod: 'coordinateMethod' in raw ? raw.coordinateMethod as NationalCity['coordinateMethod'] : 'census-internal-point',
    populationSourceUrl: city.population === null ? null : manifest.population.url,
    auditStatus: excluded ? 'excluded' : coverage.some(item => item.status === 'verified') ? 'verified' : 'unresolved',
    coverage,
  };
});

/** Qualified service-area listings only. Pending/excluded entries never leak in. */
export type SearchableNationalCity = NationalCity & { latitude: number; longitude: number; auditStatus: 'verified' };
export const verifiedNationalCities = nationalCities.filter((city): city is SearchableNationalCity =>
  city.auditStatus === 'verified' && typeof city.latitude === 'number' && typeof city.longitude === 'number');
/** Independent population benchmark, never a Search eligibility filter. Includes the explicit CDP exception. */
export const majorCityCandidates = nationalCities.filter(city =>
  city.inclusionReason === 'population-100000' || city.inclusionReason === 'excluded-non-incorporated');
const cityIndex = new Map(nationalCities.map(city => [city.id, city]));
export function getVerifiedOperators(cityId: string): readonly MarketCoverage[] {
  return cityIndex.get(cityId)?.coverage
    .filter((item): item is MarketCoverage => item.status === 'verified') ?? [];
}

/** Explicit aliases do not change raw city/operator evidence or infer agency unions. */
const marketIndex = createMarketRelationIndex(nationalCities, nationalCityMarketRelations);
export const getCanonicalMarketCityId = (id: string) => marketIndex.canonical(id);
/** Future Search should use this view to avoid duplicate choices for the three sourced links. */
export const verifiedMarketChoices = verifiedNationalCities.filter(city => marketIndex.canonical(city.id) === city.id);
export interface VerifiedMarketEvidence {
  evidenceCityIds: readonly string[];
  coverage: MarketCoverage;
}
const marketEvidence = new Map<string, Map<string, { ids: Set<string>; coverage: MarketCoverage }>>();
for (const city of verifiedNationalCities) {
  const canonical = marketIndex.canonical(city.id)!;
  if (!marketEvidence.has(canonical)) marketEvidence.set(canonical, new Map());
  for (const coverage of getVerifiedOperators(city.id)) {
    const key = JSON.stringify([coverage.marketedOperator, coverage.sourceUrl]);
    const entries = marketEvidence.get(canonical)!;
    const previous = entries.get(key);
    if (!previous) entries.set(key, { ids: new Set([city.id]), coverage });
    else {
      previous.ids.add(city.id);
      if ((coverage.checkedAt ?? coverage.checkedDate) > (previous.coverage.checkedAt ?? previous.coverage.checkedDate)) {
        previous.coverage = coverage;
      }
    }
  }
}
/** Qualified source-backed evidence only; repeated alias rows do not count twice. */
export function getVerifiedMarketEvidence(id: string): readonly VerifiedMarketEvidence[] {
  const canonical = marketIndex.canonical(id);
  return [...(canonical ? marketEvidence.get(canonical)?.values() ?? [] : [])]
    .map(item => ({ evidenceCityIds: [...item.ids].sort(), coverage: item.coverage }));
}

/** Counts describe the checked snapshot, not a completeness claim for operator service. */
export const nationalCoverageAudit = {
  candidates: nationalCities.length,
  eligibleMajorCities: nationalCities.filter(city => city.inclusionReason === 'population-100000').length,
  operatorListedAdditionalPlaces: operatorPlaces.length,
  majorCandidateRows: majorCityCandidates.length,
  regionalHubs: nationalCities.filter(city => city.inclusionReason === 'regional-hub').length,
  /** Legacy count of qualified audit rows; use distinctVerifiedMarkets for linked-market counts. */
  verifiedCityMarkets: verifiedNationalCities.length,
  qualifiedAuditRows: verifiedNationalCities.length,
  distinctVerifiedMarkets: verifiedMarketChoices.length,
  /** Brand/source associations, not independent corroborations or verified carriers. */
  distinctOperatorEvidence: [...marketEvidence.values()].reduce((count, entries) => count + entries.size, 0),
  unresolved: nationalCities.filter(city => city.auditStatus === 'unresolved').length,
  excluded: nationalCities.filter(city => city.auditStatus === 'excluded').length,
  confirmedMunicipalCoverage: 0,
  byOperator: Object.fromEntries(nationalOperators.map(operator => [operator, {
    cityMarkets: records.filter(record => record.marketedOperator === operator).length,
    pending: nationalCities.filter(city => city.coverage.some(item => item.marketedOperator === operator && item.status === 'pending')).length,
    confirmedMunicipalCoverage: 0,
  }])),
};
