import { expect, test } from 'vitest';
import candidatesRaw from '../candidates.json?raw';
import operatorPlacesRaw from '../operatorPlaces.json?raw';
import coverageRaw from '../coverage.json?raw';
import sourcesRaw from '../sources.json?raw';
import batch from './batch1.json';
import { createMarketRelationIndex } from '../marketRelations';
import { getCanonicalMarketCityId, getVerifiedMarketEvidence, getVerifiedOperators,
  nationalCities, nationalCityMarketRelations, nationalCoverageAudit,
  verifiedMarketChoices, verifiedNationalCities } from '../../nationalCities';

test('bounded revised batch selection preserves outcomes and all before/after rows remain accounted for', () => {
  expect(batch.records).toHaveLength(25);
  expect(new Set(batch.records.map(r => r.cityId)).size).toBe(25);
  expect(batch.records[0]).toMatchObject({ cityId: 'anchorage-ak', priority: 'missing-state', before: 'unresolved', after: 'unresolved' });
  expect(batch.records.filter(r => r.after === 'verified').map(r => r.cityId).sort())
    .toEqual(['boise-city-id','jersey-city-nj','lexington-fayette-urban-county-ky','macon-bibb-county-ga']);
  expect(batch.records.every(r => r.before === 'unresolved' && r.attempts.length >= 2 && r.reason)).toBe(true);
  expect(batch.summary).toMatchObject({ beforeQualifiedAuditRows: 1370, afterQualifiedAuditRows: 1374,
    beforeUnresolved: 179, afterUnresolved: 175, aliasResolvedRows: 3, newDistinctNamedMarkets: 1 });
  expect(nationalCoverageAudit).toMatchObject({ candidates: 1550, qualifiedAuditRows: 1374,
    distinctVerifiedMarkets: 1371, unresolved: 175, excluded: 1, distinctOperatorEvidence: 2053 });
});

test('frozen population/coordinate/coverage/source snapshots retain original byte hashes', async () => {
  const raw = { 'candidates.json': candidatesRaw, 'operatorPlaces.json': operatorPlacesRaw,
    'coverage.json': coverageRaw, 'sources.json': sourcesRaw };
  for (const [name, expected] of Object.entries(batch.baselineFileSha256)) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw[name as keyof typeof raw]));
    expect([...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('')).toBe(expected);
  }
  expect(batch.baselineSha).toBe('d45b0d3305e154ac93c165af70ecfb6e8812f74b');
  expect(batch.fieldAudit.qualifiedRecordsChecked).toBe(2047);
  expect(batch.fieldAudit.missingRequiredFields).toEqual([]);
  expect(batch.fieldAudit.municipalCoveragePending).toBe(2047);
  expect(batch.fieldAudit.operatingCarrierPending).toBe(2047);
});

test('all added coverage has positive official-source provenance and retains qualification limits', () => {
  expect(batch.coverageAdditions).toHaveLength(10);
  for (const record of batch.coverageAdditions) {
    const attempt = batch.sources.find(s => s.sourceUrl === record.sourceUrl);
    if (!attempt) {
      expect(record).toMatchObject({ cityId: 'new-york', marketedOperator: 'AMTRAK', responseSha256: batch.reusedSources[0].sha256 });
      expect(batch.reusedSources[0].url).toBe(record.sourceUrl);
      continue;
    }
    expect(attempt).toMatchObject({ httpStatus: 200, curlExit: 0, finalUrl: record.sourceUrl, sha256: record.responseSha256 });
    expect(record).toMatchObject({ qualification: 'city-market', municipalCoverage: 'pending', operatingCarrier: 'pending' });
    expect(record.stops.length).toBeGreaterThan(0);
    expect(Number.isFinite(Date.parse(record.checkedAt ?? ''))).toBe(true);
    expect(record.checkedDate).toBe(attempt.checkedDate);
    expect(batch.records.some(r => r.cityId === record.cityId) || batch.matchingRepairs.some(r => r.cityId === record.cityId)).toBe(true);
  }
  expect(getVerifiedOperators('jersey-city-nj').map(r => r.marketedOperator)).toEqual(['NJ_TRANSIT']);
});

test('sourced same-state links preserve IDs and remove duplicate choices without counting aliases as new markets', () => {
  expect(nationalCityMarketRelations).toHaveLength(3);
  for (const relation of nationalCityMarketRelations) {
    const from = nationalCities.find(c => c.id === relation.cityId)!;
    const target = nationalCities.find(c => c.id === relation.sameMarketAsCityId)!;
    expect(from.state).toBe(target.state);
    expect(from.sameMarketAsCityId).toBe(target.id);
    expect(from.id).not.toBe(target.id);
    expect(getCanonicalMarketCityId(from.id)).toBe(target.id);
    expect(verifiedNationalCities.some(c => c.id === from.id)).toBe(true);
    expect(verifiedMarketChoices.some(c => c.id === from.id)).toBe(false);
    expect(verifiedMarketChoices.filter(c => c.id === target.id)).toHaveLength(1);
    expect(relation.sourceUrls.length).toBeGreaterThanOrEqual(2);
  }
  expect(getCanonicalMarketCityId('unknown')).toBeUndefined();
  expect(verifiedNationalCities.length - verifiedMarketChoices.length).toBe(3);
});

test('market evidence deduplicates exact operator/source pairs and does not infer agencies from aliases', () => {
  const boise = getVerifiedMarketEvidence('boise-city-id');
  expect(boise).toEqual(getVerifiedMarketEvidence('boise-id'));
  expect(boise.map(r => r.coverage.marketedOperator).sort()).toEqual(['FLIXBUS','GREYHOUND']);
  expect(boise.every(r => r.evidenceCityIds.includes('boise-city-id') && r.evidenceCityIds.includes('boise-id'))).toBe(true);
  const lex = getVerifiedMarketEvidence('lexington-ky');
  expect(lex.map(r => r.coverage.marketedOperator).sort()).toEqual(['FLIXBUS','GREYHOUND']);
  expect(lex.every(r => batch.coverageAdditions.some(a => a.sourceUrl === r.coverage.sourceUrl))).toBe(true);
  expect(getVerifiedMarketEvidence('jersey-city-nj').map(r => r.coverage.marketedOperator)).toEqual(['NJ_TRANSIT']);
  expect(getVerifiedMarketEvidence('anchorage-ak')).toEqual([]);
});

test('invalid endpoints, cross-state links, self-links and cycles reject before consumer use', () => {
  const relation = nationalCityMarketRelations[0];
  const cities = [{id:'a',state:'ID'},{id:'b',state:'ID'},{id:'c',state:'OK'}];
  const r = { ...relation, cityId:'a',sameMarketAsCityId:'b' };
  expect(() => createMarketRelationIndex(cities,[{...r,sameMarketAsCityId:'missing'}])).toThrow();
  expect(() => createMarketRelationIndex(cities,[{...r,sameMarketAsCityId:'a'}])).toThrow();
  expect(() => createMarketRelationIndex(cities,[{...r,sameMarketAsCityId:'c'}])).toThrow();
  expect(() => createMarketRelationIndex(cities,[r,r])).toThrow();
  expect(() => createMarketRelationIndex(cities,[r,{...r,cityId:'b',sameMarketAsCityId:'a'}])).toThrow();
  expect(() => createMarketRelationIndex(cities,[{...r,sourceUrls:[]}])).toThrow();
  expect(() => createMarketRelationIndex(cities,[{...r,checkedDate:'2026-02-31'}])).toThrow();
  expect(() => createMarketRelationIndex(cities,[{...r,observation:' '}])).toThrow();
});

test('negative and conflicting sources stay unresolved, including nearby-city names and redirects', () => {
  const chatt = batch.records.find(r => r.cityId === 'chattanooga-tn')!;
  expect(chatt.after).toBe('unresolved');
  expect(chatt.attempts.some(a => a.result === 'redirect-to-generic-index')).toBe(true);
  const source = batch.sources.find(s => s.key === 'grey-chattanooga')!;
  expect(source.httpStatus).toBe(200); expect(source.finalUrl).not.toBe(source.sourceUrl);
  expect(getVerifiedOperators('chattanooga-tn')).toEqual([]);
  expect(batch.records.find(r => r.cityId === 'glendale-az')!.attempts.some(a => a.result === 'different-market')).toBe(true);
  expect(nationalCities.find(c => c.censusGeoid === '1571550')!.auditStatus).toBe('excluded');
});


test('selection revision preserves the original sample and displaced preliminary screen separately', () => {
  expect(batch.originalSelection).toHaveLength(25);
  expect(batch.originalSelection).toContain('peoria-az');
  expect(batch.originalSelection).not.toContain('macon-bibb-county-ga');
  expect(batch.revisedSelection).toEqual(batch.records.map(r => r.cityId));
  expect(batch.revisedSelection).not.toContain('peoria-az');
  expect(batch.revisedSelection).toContain('macon-bibb-county-ga');
  expect(batch.preliminaryScreening).toMatchObject([{ cityId: 'peoria-az', status: 'pending-next-batch',
    attempts: [{sourceKey:'flix-directory'}, {sourceKey:'grey-directory'}] }]);
  expect(getVerifiedOperators('peoria-az')).toEqual([]);
});

test('C1 DC and C4 exact NYC/NYP repairs add evidence to existing markets, preserving failed request', () => {
  expect(batch.matchingRepairs.find(r => r.finding === 'C1'))
    .toMatchObject({cityId:'washington',directoryLabel:'Washington, D.C.',normalizedState:'DC'});
  expect(getVerifiedOperators('washington').map(r => r.marketedOperator).sort())
    .toEqual(['AMTRAK','FLIXBUS','GREYHOUND']);
  const nyp = getVerifiedOperators('new-york').find(r => r.marketedOperator === 'AMTRAK')!;
  expect(nyp.stops).toEqual(['Ny Moynihan Train Hall At Penn Station']);
  expect(nyp.modeEvidence?.stopIds).toEqual(['NYP']);
  expect(nyp.additionalSourceUrls).toContain('https://www.greatamericanstations.com/stations/new-york-penn-station-ny-nyp/');
  expect(batch.sources.find(s => s.key === 'amtrak-nyp')?.httpStatus).toBe(403);
  expect(batch.sources.find(s => s.key === 'nyp-identity')?.httpStatus).toBe(200);
});

test('C3 shared brand evidence is explicitly not independent corroboration or carrier proof', () => {
  expect(batch.busSourceProvenance).toMatchObject({ independentCorroboration:false,
    baselineSharedDirectoryLabels:1395,baselineIdenticalGreyhoundStopLists:563 });
  for (const city of verifiedNationalCities) for (const r of getVerifiedOperators(city.id)) {
    if (r.marketedOperator !== 'FLIXBUS' && r.marketedOperator !== 'GREYHOUND') continue;
    expect(r).toMatchObject({sourceFamily:'flix-greyhound-shared-directories',independentCorroboration:false,operatingCarrier:'pending'});
  }
});

test('C5 every Amtrak record has explicit snapshot mode evidence; brand never proves train service', () => {
  const amtrak = verifiedNationalCities.flatMap(c => getVerifiedOperators(c.id)).filter(r => r.marketedOperator === 'AMTRAK');
  expect(amtrak).toHaveLength(150);
  expect(amtrak.every(r => r.modeEvidence)).toBe(true);
  expect(amtrak.filter(r => r.modeEvidence?.qualification === 'bus-only')).toHaveLength(23);
  for (const r of amtrak) {
    const mode = r.modeEvidence!;
    expect(mode.responseSha256).toBe(batch.reusedSources[0].sha256);
    expect(mode.feedStartDate).toBe('2026-10-25');
    if (mode.qualification === 'bus-only') expect(mode.routeTypes).toEqual([3]);
    if (mode.qualification === 'rail-only') expect(mode.routeTypes).toEqual([2]);
    if (mode.qualification === 'rail-and-bus') expect(mode.routeTypes).toEqual([2,3]);
  }
  expect(getVerifiedOperators('kansas-city-mo').find(r => r.marketedOperator === 'AMTRAK')?.modeEvidence)
    .toMatchObject({qualification:'unverified',stopIds:[],routeTypes:[]});
  expect(getVerifiedOperators('portland').find(r => r.marketedOperator === 'AMTRAK')?.modeEvidence?.stopIds).toEqual(['POR']);
  expect(getVerifiedOperators('portland-or').find(r => r.marketedOperator === 'AMTRAK')?.modeEvidence?.stopIds).toEqual(['PDX']);
});
