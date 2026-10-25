import { expect, test } from 'vitest';
import { getVerifiedOperators, nationalCatalogueSources, nationalCities,
  nationalCoverageAudit, nationalOperators, verifiedNationalCities, majorCityCandidates, nationalEvidenceBatches } from './nationalCities';

const legacy = ['portland', 'boston', 'providence', 'hartford', 'new-haven', 'albany',
  'new-york', 'stony-brook', 'trenton', 'philadelphia', 'baltimore', 'washington',
  'richmond', 'norfolk', 'raleigh', 'charlotte', 'fayetteville', 'charleston', 'savannah',
  'jacksonville', 'orlando', 'tampa', 'fort-lauderdale', 'miami'];

test('complete frozen Census selection is accounted for, including its excluded CDP exception', () => {
  expect(nationalCoverageAudit).toMatchObject({ candidates: 1550, eligibleMajorCities: 342,
    regionalHubs: 3, excluded: 1, verifiedCityMarkets: 1374, unresolved: 175 });
  expect(nationalCatalogueSources.counts.rawThresholdRows).toBe(343);
  expect(nationalCities.filter(c => c.inclusionReason === 'population-100000'))
    .toSatisfy((cities: typeof nationalCities) => cities.every(c => c.population! >= 100_000 && c.populationVintage === 2025 && c.geography !== 'census-designated-place'));
  const exception = nationalCities.find(c => c.censusGeoid === '1571550')!;
  expect(exception).toMatchObject({ geography: 'census-designated-place', auditStatus: 'excluded' });
  expect(getVerifiedOperators(exception.id)).toEqual([]);
  expect(verifiedNationalCities.length + nationalCoverageAudit.unresolved + nationalCoverageAudit.excluded).toBe(nationalCities.length);
});

test('city IDs and GEOIDs are unique and all 24 previous IDs remain available', () => {
  expect(new Set(nationalCities.map(c => c.id)).size).toBe(nationalCities.length);
  expect(new Set(majorCityCandidates.map(c => c.censusGeoid)).size).toBe(majorCityCandidates.length);
  expect(majorCityCandidates).toHaveLength(343);
  expect(nationalCities.filter(c => c.legacyId).map(c => c.id).sort()).toEqual([...legacy].sort());
  for (const c of nationalCities) {
    expect(c.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    if (c.censusGeoid !== null) expect(c.censusGeoid).toMatch(/^\d{7}$/);
    expect(c.state).toMatch(/^[A-Z]{2}$/);
    expect(c.name.length).toBeGreaterThan(0);
    expect(c.aliases.length).toBeGreaterThan(0);
    if (c.censusName !== null) expect(c.aliases).toContain(c.censusName);
  }
  expect(nationalCities.find(c => c.id === 'philadelphia')?.aliases).toContain('Philly');
  expect(nationalCities.find(c => c.id === 'new-york')?.aliases).toContain('NYC');
  expect(nationalCities.find(c => c.id === 'stony-brook')?.aliases).toContain('Long Island');
});

test('coordinates are representative rounded Census points, not station/user positions', () => {
  for (const c of nationalCities) {
    if (c.latitude === null || c.longitude === null) { expect(c.coordinateMethod).toBe('unavailable'); continue; }
    expect(Number.isFinite(c.latitude) && Math.abs(c.latitude) <= 90).toBe(true);
    expect(Number.isFinite(c.longitude) && Math.abs(c.longitude) <= 180).toBe(true);
    expect(c.latitude * 100).toBeCloseTo(Math.round(c.latitude * 100), 8);
    expect(c.longitude * 100).toBeCloseTo(Math.round(c.longitude * 100), 8);
    if (c.coordinateMethod === 'census-internal-point') expect(c.coordinateSourceUrl).toBe(nationalCatalogueSources.coordinates.url);
    else expect(c.coordinateSourceUrl).toMatch(/^https:\/\/www\.(flixbus|greyhound)\.com\/bus\//);
    if (c.population !== null) expect(c.populationSourceUrl).toBe(nationalCatalogueSources.population.url);
  }
  expect(nationalCatalogueSources.coordinates.method).toContain('not downtown');
});

test('all six operators are audited once per city; no unverified operator leaks into lookup', () => {
  expect([...nationalOperators]).toEqual(['SEPTA', 'NJ_TRANSIT', 'LIRR', 'AMTRAK', 'GREYHOUND', 'FLIXBUS']);
  for (const c of nationalCities) {
    expect(c.coverage.map(r => r.marketedOperator)).toEqual([...nationalOperators]);
    expect(getVerifiedOperators(c.id)).toEqual(c.coverage.filter(r => r.status === 'verified'));
    for (const r of c.coverage) if (r.status !== 'verified') {
      expect(r.qualification).toBe('unresolved');
      expect(r.reason.length).toBeGreaterThan(0);
    }
  }
  expect(getVerifiedOperators('not-a-city')).toEqual([]);
  expect(verifiedNationalCities.every(c => getVerifiedOperators(c.id).length > 0)).toBe(true);
});

test('market verification always retains source, date, observed stops and pending boundary/carrier status', () => {
  const hosts: Record<string, string[]> = {
    SEPTA: ['www3.septa.org', 'schedules.septa.org'], NJ_TRANSIT: ['www.njtransit.com'],
    LIRR: ['www.mta.info'], AMTRAK: ['content.amtrak.com', 'www.amtrak.com'],
    GREYHOUND: ['www.greyhound.com'], FLIXBUS: ['www.flixbus.com'],
  };
  for (const c of verifiedNationalCities) for (const r of getVerifiedOperators(c.id)) {
    expect(r).toMatchObject({ qualification: 'city-market', municipalCoverage: 'pending', operatingCarrier: 'pending' });
    expect(r.checkedDate).toBe('2026-10-24');
    expect(r.stops.length).toBeGreaterThan(0);
    expect(r.stops.every(s => typeof s === 'string' && s.trim().length > 0)).toBe(true);
    expect(r.note.length).toBeGreaterThan(0);
    for (const link of [r.sourceUrl, r.evidenceUrl]) {
      const u = new URL(link);
      expect(u.protocol).toBe('https:');
      expect(u.username + u.password + u.port).toBe('');
      expect(hosts[r.marketedOperator]).toContain(u.hostname);
    }
  }
  expect(nationalCoverageAudit.confirmedMunicipalCoverage).toBe(0);
});

test('operator counts reconcile against records, not guessed market/municipal equivalence', () => {
  const expected = { SEPTA: 2, NJ_TRANSIT: 4, LIRR: 2, AMTRAK: 150, GREYHOUND: 567, FLIXBUS: 1332 };
  for (const op of nationalOperators) {
    const records = nationalCities.flatMap(c => c.coverage).filter(r => r.marketedOperator === op);
    const summary = nationalCoverageAudit.byOperator[op];
    expect(summary.cityMarkets).toBe(expected[op]);
    expect(summary.cityMarkets).toBe(records.filter(r => r.status === 'verified').length);
    expect(summary.pending).toBe(records.filter(r => r.status === 'pending').length);
    expect(summary.cityMarkets + summary.pending + nationalCoverageAudit.excluded).toBe(nationalCities.length);
  }
});

test('same-name cities are distinct and ambiguous station evidence is not assigned across a state border', () => {
  const kansas = nationalCities.find(c => c.id === 'kansas-city-ks')!;
  const missouri = nationalCities.find(c => c.id === 'kansas-city-mo')!;
  expect(kansas.censusGeoid).not.toBe(missouri.censusGeoid);
  expect(getVerifiedOperators(kansas.id).some(r => r.marketedOperator === 'AMTRAK')).toBe(false);
  expect(getVerifiedOperators(missouri.id).find(r => r.marketedOperator === 'AMTRAK')?.sourceUrl)
    .toBe('https://www.amtrak.com/stations/kcy.html');
  expect(nationalCities.find(c => c.id === 'portland')?.state).toBe('ME');
  expect(nationalCities.find(c => c.id === 'portland-or')?.state).toBe('OR');
});

test('unresolved bus pages, Alaska and small CDP hub stay honest', () => {
  for (const id of ['grand-rapids-mi', 'columbia-sc']) {
    expect(getVerifiedOperators(id).some(r => r.marketedOperator === 'FLIXBUS' || r.marketedOperator === 'GREYHOUND')).toBe(false);
  }
  const alaska = nationalCities.find(c => c.state === 'AK')!;
  expect(alaska.auditStatus).toBe('unresolved');
  const stony = nationalCities.find(c => c.id === 'stony-brook')!;
  expect(stony).toMatchObject({ geography: 'census-designated-place', population: null, inclusionReason: 'regional-hub' });
  expect(getVerifiedOperators(stony.id).map(r => r.marketedOperator)).toContain('LIRR');
});

test('source snapshot is reproducible and contains no timetable, fare or pair generation payload', () => {
  for (const s of [nationalCatalogueSources.population, nationalCatalogueSources.coordinates, nationalCatalogueSources.amtrak]) {
    expect(s.sha256).toMatch(/^[a-f0-9]{64}$/);
  }
  for (const c of nationalCities) for (const field of ['fare', 'departure', 'arrival', 'legs', 'routes']) expect(field in c).toBe(false);
  expect(nationalCatalogueSources.amtrak.use).toContain('never schedules');
});

test('each verified bus market has a successful hashed city-page observation, not only a directory match', () => {
  for (const city of verifiedNationalCities) for (const record of getVerifiedOperators(city.id)) {
    if (record.marketedOperator !== 'GREYHOUND' && record.marketedOperator !== 'FLIXBUS') continue;
    const check = nationalCatalogueSources.busPageChecks.find(c => c.cityId === city.id && c.operator === record.marketedOperator && c.sourceUrl === record.sourceUrl);
    if (check) {
      expect(check).toMatchObject({ status: 'verified', sourceUrl: record.sourceUrl, checkedDate: record.checkedDate });
      expect(check.sha256).toMatch(/^[a-f0-9]{64}$/);
    } else {
      const addition = nationalEvidenceBatches[0].coverageAdditions.find(r => r.cityId === city.id && r.sourceUrl === record.sourceUrl);
      expect(addition?.responseSha256).toMatch(/^[a-f0-9]{64}$/);
      const attempt = nationalEvidenceBatches[0].sources.find(s => s.sourceUrl === record.sourceUrl);
      expect(attempt).toMatchObject({ httpStatus: 200, finalUrl: record.sourceUrl, sha256: addition?.responseSha256 });
    }
  }
  expect(nationalCatalogueSources.busPageChecks).toHaveLength(2792);
  expect(nationalCatalogueSources.busPageChecks.filter(c => c.status === 'verified')).toHaveLength(1891);
});


test('smaller verified places are searchable independently of the major-city audit benchmark', () => {
  const smaller = verifiedNationalCities.filter(c => c.inclusionReason === 'operator-listed-place');
  expect(smaller.length).toBeGreaterThan(1000);
  expect(smaller.some(c => c.population !== null && c.population < 100000)).toBe(true);
  expect(smaller.some(c => c.geography === 'census-designated-place')).toBe(true);
  expect(smaller.some(c => c.geography === 'operator-market')).toBe(true);
  expect(smaller.every(c => !majorCityCandidates.some(major => major.id === c.id))).toBe(true);
  expect(verifiedNationalCities.length).toBe(nationalCities.filter(c => c.auditStatus === 'verified').length);
});
