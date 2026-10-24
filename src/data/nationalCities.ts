import candidates from './national/candidates.json';
import operatorPlaces from './national/operatorPlaces.json';
import evidence from './national/coverage.json';
import manifest from './national/sources.json';

/** Existing OneLine operators only. No service, fare or direct-route inference. */
export const nationalOperators = ['SEPTA', 'NJ_TRANSIT', 'LIRR', 'AMTRAK', 'GREYHOUND', 'FLIXBUS'] as const;
export type NationalOperator = typeof nationalOperators[number];

export interface MarketCoverage {
  status: 'verified';
  marketedOperator: NationalOperator;
  /** A named service-area listing, never a municipal-boundary assertion. */
  qualification: 'city-market';
  sourceUrl: string;
  evidenceUrl: string;
  additionalSourceUrls?: readonly string[];
  checkedDate: string;
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
const records = evidence as readonly (MarketCoverage & { cityId: string })[];

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
    ...city, coordinateSourceUrl: 'coordinateSourceUrl' in raw ? raw.coordinateSourceUrl as string | null : manifest.coordinates.url,
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

/** Counts describe the checked snapshot, not a completeness claim for operator service. */
export const nationalCoverageAudit = {
  candidates: nationalCities.length,
  eligibleMajorCities: nationalCities.filter(city => city.inclusionReason === 'population-100000').length,
  operatorListedAdditionalPlaces: operatorPlaces.length,
  majorCandidateRows: majorCityCandidates.length,
  regionalHubs: nationalCities.filter(city => city.inclusionReason === 'regional-hub').length,
  verifiedCityMarkets: verifiedNationalCities.length,
  unresolved: nationalCities.filter(city => city.auditStatus === 'unresolved').length,
  excluded: nationalCities.filter(city => city.auditStatus === 'excluded').length,
  confirmedMunicipalCoverage: 0,
  byOperator: Object.fromEntries(nationalOperators.map(operator => [operator, {
    cityMarkets: records.filter(record => record.marketedOperator === operator).length,
    pending: nationalCities.filter(city => city.coverage.some(item => item.marketedOperator === operator && item.status === 'pending')).length,
    confirmedMunicipalCoverage: 0,
  }])),
};
