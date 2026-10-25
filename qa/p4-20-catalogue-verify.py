# P4-20 independent verification of the catalogue follow-up overlay (PR #27) against the frozen baseline (PR #20 d45b0d3).
# Offline only. Inputs: base dump (qa/p4-19-catalogue-dump.test.ts on d45b0d3), candidate dump (same spec on the candidate),
# candidate extra dump (qa/p4-20-catalogue-extra-dump.test.ts), the candidate checkout, and the hash-checked Amtrak GTFS zip.
# Usage: python3 -I qa/p4-20-catalogue-verify.py <base-dump> <cand-dump> <cand-extra> <cand-checkout> <amtrak-GTFS.zip>
# Prints PASS / FAIL / NOTE lines. NOTE lines are observations for the report, never counted as passes.
import csv, hashlib, io, json, math, re, sys, zipfile
from collections import Counter
from datetime import date

base_dump, cand_dump, cand_extra, checkout, gtfs = sys.argv[1:6]
B, C, X = json.load(open(base_dump)), json.load(open(cand_dump)), json.load(open(cand_extra))
batch = json.load(open(checkout + '/src/data/national/evidence/batch1.json'))
Bi = {c['id']: c for c in B['nationalCities']}; Ci = {c['id']: c for c in C['nationalCities']}
OPS = ['SEPTA', 'NJ_TRANSIT', 'LIRR', 'AMTRAK', 'GREYHOUND', 'FLIXBUS']
ADDITIVE = {'sourceFamily', 'independentCorroboration', 'modeEvidence'}
tally = Counter()
def out(ok, key, detail=''):
    s = 'PASS' if ok is True else 'FAIL' if ok is False else 'NOTE'
    tally[s] += 1; print(f'{s:4} {key}: {detail}')
def ver(city, op):
    return next((r for r in city['coverage'] if r['marketedOperator'] == op and r['status'] == 'verified'), None) if city else None
strip = lambda r: {k: v for k, v in r.items() if k not in ADDITIVE} if r else None

# ---- 1. Counts
a = C['audit']
out(a['candidates'] == 1550 and a['qualifiedAuditRows'] == 1374 and a['verifiedCityMarkets'] == 1374 and a['unresolved'] == 175 and a['excluded'] == 1,
    'counts 1550 / 1374 qualified / 175 unresolved / 1 excluded', {k: a.get(k) for k in ['candidates', 'qualifiedAuditRows', 'unresolved', 'excluded']})
out(len(C['verifiedIds']) == 1374 and len(X['choices']) == 1371 and a['distinctVerifiedMarkets'] == 1371, 'verified rows 1374, distinct market choices 1371', (len(C['verifiedIds']), len(X['choices'])))
raw = sum(1 for c in C['nationalCities'] for r in c['coverage'] if r['status'] == 'verified')
canon = sum(len(v) for v in X['marketEvidence'].values())
out(raw == 2057 and canon == 2053 and a['distinctOperatorEvidence'] == 2053, 'raw 2057 vs canonical 2053 brand/source associations', (raw, canon, a['distinctOperatorEvidence']))
out(all(a[k] == B['audit'][k] for k in ['eligibleMajorCities', 'majorCandidateRows', 'regionalHubs', 'operatorListedAdditionalPlaces']), 'benchmark/hub/operator-listed counts unchanged (342/343/3/1204)')

# ---- 2. Record-level delta (additive metadata excluded)
changed, added, removed = [], [], []
for i in Bi:
    for op in OPS:
        b, c = ver(Bi[i], op), ver(Ci.get(i), op)
        if b and not c: removed.append((i, op))
        elif b and strip(b) != strip(c): changed.append((i, op))
        elif c and not b: added.append((i, op))
out(not removed and not changed, 'no baseline verified record removed or altered (ignoring additive sourceFamily/independentCorroboration/modeEvidence)', f'removed {removed} changed {changed}')
exp_added = {('boise-city-id', 'FLIXBUS'), ('boise-city-id', 'GREYHOUND'), ('lexington-fayette-urban-county-ky', 'FLIXBUS'), ('lexington-fayette-urban-county-ky', 'GREYHOUND'),
             ('jersey-city-nj', 'NJ_TRANSIT'), ('macon-bibb-county-ga', 'FLIXBUS'), ('macon-bibb-county-ga', 'GREYHOUND'), ('washington', 'FLIXBUS'), ('washington', 'GREYHOUND'), ('new-york', 'AMTRAK')}
out(set(added) == exp_added, 'exactly the 10 expected records added', sorted(set(added) ^ exp_added) or sorted(added))
src = {s['key']: s for s in batch['sources']}; by_url = {s['sourceUrl']: s for s in batch['sources']}
prov = []
for i, op in added:
    r = ver(Ci[i], op); s = by_url.get(r['sourceUrl'])
    if op == 'AMTRAK':
        ok = r['sourceUrl'] == 'https://content.amtrak.com/content/gtfs/GTFS.zip' and r.get('responseSha256') == hashlib.sha256(open(gtfs, 'rb').read()).hexdigest()
    else:
        ok = bool(s and s['httpStatus'] == 200 and s['finalUrl'] == s['sourceUrl'] and s['sha256'] == r.get('responseSha256') and r.get('checkedAt') == s['checkedAt'])
    ok = ok and r['municipalCoverage'] == 'pending' and r['operatingCarrier'] == 'pending' and r['qualification'] == 'city-market' and r['stops']
    prov.append((i, op, ok))
out(all(x[2] for x in prov), 'each added record: dated 200 same-URL response with matching hash (Amtrak: frozen feed hash), pending municipal/carrier', [x for x in prov if not x[2]])
st = Counter((x['cityId'], x['marketedOperator']) for x in batch['coverageAdditions']); out(max(st.values()) == 1 and not any(ver(Bi.get(i), op) for i, op in st), 'no addition overwrites an existing baseline city/operator record')

# ---- 3. Audit-row resolution vs distinct markets
resolved = sorted(i for i in Bi if Bi[i]['auditStatus'] == 'unresolved' and Ci[i]['auditStatus'] == 'verified')
out(resolved == ['boise-city-id', 'jersey-city-nj', 'lexington-fayette-urban-county-ky', 'macon-bibb-county-ga'], 'four resolved audit rows', resolved)
new_markets = sorted(set(X['choices']) - set(B['verifiedIds']))
out(new_markets == ['jersey-city-nj'], 'one additional distinct market (Jersey City); three alias rows add none', new_markets)
other_status = [i for i in Bi if Bi[i]['auditStatus'] != Ci[i]['auditStatus'] and i not in resolved]
out(not other_status, 'no other auditStatus changes', other_status)
fields = [(i, k) for i in Bi for k in set(Bi[i]) | set(Ci[i]) if k not in ('coverage', 'auditStatus', 'sameMarketAsCityId') and Bi[i].get(k) != Ci[i].get(k)]
out(not fields, 'IDs, names, aliases, population, coordinates and provenance fields unchanged on all 1,550 rows', fields[:10])

# ---- 4. Market relations
rels = X['relations']; links = {r['cityId']: r['sameMarketAsCityId'] for r in rels}
checks = []
for r in rels:
    s, t = Ci.get(r['cityId']), Ci.get(r['sameMarketAsCityId'])
    d = r['checkedDate']
    checks.append(bool(s and t and s['state'] == t['state'] and r['cityId'] != r['sameMarketAsCityId'] and r['sameMarketAsCityId'] not in links
                       and t['auditStatus'] == 'verified' and r['qualification'] == 'named-city-market-alias' and date.fromisoformat(d).isoformat() == d
                       and r['sourceUrls'] and all(u.startswith('https://') for u in r['sourceUrls']) and r['observation'].strip() and r['note'].strip()
                       and Ci[r['cityId']].get('sameMarketAsCityId') == r['sameMarketAsCityId']))
out(len(rels) == 3 and all(checks) and len(links) == 3, 'three same-state sourced links; targets verified and not themselves linked (no chains/cycles); no self/duplicate', [(r['cityId'], r['sameMarketAsCityId']) for r in rels])
out(sorted(links.items()) == [('boise-city-id', 'boise-id'), ('lexington-fayette-urban-county-ky', 'lexington-ky'), ('macon-bibb-county-ga', 'macon-ga')], 'link endpoints as reported')
mapped = {i: c for i, c in X['canonical'].items() if c != i}
out(mapped == links and X['canonicalUnknown'] is None, 'canonical map: only the 3 linked rows map elsewhere; unknown id -> undefined', mapped)
out(sum(1 for c in C['nationalCities'] if 'sameMarketAsCityId' in c) == 3, 'sameMarketAsCityId present on exactly 3 rows')
rel_src = [(r['cityId'], u, by_url.get(u, {}).get('httpStatus'), by_url.get(u, {}).get('checkedDate')) for r in rels for u in r['sourceUrls']]
out(all(x[2] == 200 for x in rel_src), 'every relation source URL has a dated HTTP 200 response in the ledger', rel_src)

# ---- 5. Choices do not hide audit IDs or drop smaller places
choices = set(X['choices']); ver_ids = set(C['verifiedIds'])
out(choices == ver_ids - set(links), 'choices = verified rows minus the 3 alias rows')
small = [i for i in ver_ids if Ci[i]['inclusionReason'] == 'operator-listed-place' and i not in choices]
out(not small, 'no operator-listed (smaller) verified place dropped from choices', small)
out(all(i in Ci for i in links) and len(C['nationalCities']) == 1550, 'alias rows still present in nationalCities / verifiedNationalCities (raw audit IDs kept)')
ali = {r['cityId']: X['marketEvidenceViaAlias'][r['cityId']] == X['marketEvidence'][r['sameMarketAsCityId']] for r in rels}
out(all(ali.values()), 'getVerifiedMarketEvidence(alias) returns the canonical target evidence', ali)
dedup = {t: [(e['coverage']['marketedOperator'], e['evidenceCityIds']) for e in X['marketEvidence'][t] if len(e['evidenceCityIds']) > 1] for t in links.values()}
out(None, 'deduplicated associations (operator, evidence ids)', dedup)
multi = [(t, e['evidenceCityIds']) for t, ev in X['marketEvidence'].items() for e in ev if len(e['evidenceCityIds']) > 1 and t not in links.values()]
out(not multi, 'no evidence union outside the three explicit links', multi[:5])
lexg = [e['coverage']['marketedOperator'] for e in X['marketEvidence']['lexington-ky']]
out(None, 'lexington-ky: market evidence operators vs its own row', f'{sorted(lexg)} vs row {sorted(r["marketedOperator"] for r in C["verifiedOperators"]["lexington-ky"])}')

# ---- 6. C1 DC
w = [ver(Ci['washington'], op) for op in ('FLIXBUS', 'GREYHOUND')]
out(all(w) and w[0]['stops'] == w[1]['stops'] == ['Arlington (Rosslyn)', 'Bethesda', 'Washington DC (Dupont Circle)', 'Washington DC (Union Station)'],
    'C1 washington gains FlixBus + Greyhound from /bus/washington-dc; stops equal the P4-19 live observation', [x['sourceUrl'] for x in w if x])
out(not [i for i in Ci if i not in Bi], 'C1 no new DC (or any) entry created')
ing = open(checkout + '/src/data/national/ingestion.py').read()
out("{'D.C.': 'DC'}" in ing and 'fuzzy' in ing, 'C1 explicit one-label exception only', ing.strip().splitlines()[-2:])

# ---- 7. C3 shared provenance
bus = [(c['id'], r) for c in C['nationalCities'] for r in c['coverage'] if r['status'] == 'verified' and r['marketedOperator'] in ('FLIXBUS', 'GREYHOUND')]
out(all(r.get('sourceFamily') == 'flix-greyhound-shared-directories' and r.get('independentCorroboration') is False for _, r in bus), f'C3 all {len(bus)} bus records carry sourceFamily + independentCorroboration=false')
g = [c for c in C['nationalCities'] if ver(c, 'GREYHOUND')]
same = sum(1 for c in g if ver(c, 'FLIXBUS') and ver(c, 'FLIXBUS')['stops'] == ver(c, 'GREYHOUND')['stops']); gonly = sum(1 for c in g if not ver(c, 'FLIXBUS'))
out(same == len(g) == 567 and gonly == 0, 'C3 567/567 Greyhound stop lists identical to FlixBus; 0 Greyhound-only', (len(g), same, gonly))
nonbus = [r['marketedOperator'] for c in C['nationalCities'] for r in c['coverage'] if r['status'] == 'verified' and r['marketedOperator'] not in ('FLIXBUS', 'GREYHOUND') and 'sourceFamily' in r]
out(not nonbus, 'C3 sourceFamily not applied to non-bus records', Counter(nonbus))
readme = open(checkout + '/src/data/national/README.md').read()
out('independent evidence source' not in readme, 'C3 top-level README no longer calls the brands independent evidence sources',
    'still present' if 'independent evidence source' in readme else 'removed')
carriers = [r for c in C['nationalCities'] for r in c['coverage'] if r['status'] == 'verified' and (r['operatingCarrier'] != 'pending' or r['municipalCoverage'] != 'pending')]
out(not carriers, 'operatingCarrier/municipalCoverage pending on all 2,057 records')

# ---- 8. C4 NYP
z = zipfile.ZipFile(gtfs); rows = lambda n: list(csv.DictReader(io.StringIO(z.read(n).decode('utf-8-sig'))))
stops = {s['stop_id']: s for s in rows('stops.txt')}
ny = ver(Ci['new-york'], 'AMTRAK')
out(bool(ny) and ny['stops'] == [stops['NYP']['stop_name']] and ny['modeEvidence']['stopIds'] == ['NYP'], 'C4 new-york AMTRAK = exact GTFS stop NYP', ny and (ny['stops'], ny['modeEvidence']['stopIds'], ny.get('additionalSourceUrls')))
out(src['amtrak-nyp']['httpStatus'] == 403 and src['nyp-identity']['httpStatus'] == 200, 'C4 direct station page 403 retained as failed; identity page 200', (src['amtrak-nyp']['httpStatus'], src['nyp-identity']['sourceUrl']))
am_new = [x for x in added if x[1] == 'AMTRAK']; out(am_new == [('new-york', 'AMTRAK')], 'C4 no other Amtrak record added', am_new)

# ---- 9. C5 mode evidence, recomputed from the GTFS
routes = {r['route_id']: int(r['route_type']) for r in rows('routes.txt')}
trips = {t['trip_id']: t['route_id'] for t in rows('trips.txt')}
stop_routes = {}
for s in rows('stop_times.txt'):
    stop_routes.setdefault(s['stop_id'], set()).add(trips[s['trip_id']])
am = [(c['id'], ver(c, 'AMTRAK')) for c in C['nationalCities'] if ver(c, 'AMTRAK')]
mism, cls = [], Counter()
for cid, r in am:
    m = r.get('modeEvidence')
    if not m: mism.append((cid, 'no modeEvidence')); continue
    cls[m['qualification']] += 1
    rids = sorted({rid for sid in m['stopIds'] for rid in stop_routes.get(sid, set())})
    types = sorted({routes[x] for x in rids})
    q = 'unverified' if not m['stopIds'] else 'rail-only' if types == [2] else 'bus-only' if types == [3] else 'rail-and-bus' if types == [2, 3] else 'other'
    names_ok = all(stops[sid]['stop_name'] in r['stops'] for sid in m['stopIds'])
    if q != m['qualification'] or sorted(m['routeIds']) != rids or sorted(m['routeTypes']) != types or not names_ok or m['feedStartDate'] != '2026-10-25' or m['responseSha256'] != hashlib.sha256(open(gtfs, 'rb').read()).hexdigest():
        mism.append((cid, m['qualification'], q, names_ok))
out(len(am) == 150 and not mism, 'C5 all 150 Amtrak modeEvidence recomputed from GTFS stop_times->trips->routes (IDs, types, class, feed hash/start)', mism[:10])
out(cls == Counter({'rail-only': 85, 'rail-and-bus': 41, 'bus-only': 23, 'unverified': 1}), 'C5 classes 85 rail-only / 41 rail-and-bus / 23 bus-only / 1 unverified', dict(cls))
unv = [cid for cid, r in am if r['modeEvidence']['qualification'] == 'unverified']; out(unv == ['kansas-city-mo'], 'C5 the unverified record is Kansas City MO (manual station name)', unv)
p419 = {'phoenix-az', 'tempe-az', 'bakersfield-ca', 'elk-grove-ca', 'fresno-ca', 'pasadena-ca', 'santa-clarita-ca', 'santa-maria-ca', 'santa-rosa-ca', 'stockton-ca', 'tracy-ca', 'vallejo-ca',
        'fort-myers-fl', 'gainesville-fl', 'st-petersburg-fl', 'peoria-il', 'wichita-ks', 'shreveport-la', 'las-vegas-nv', 'sparks-nv', 'wilmington-nc', 'killeen-tx', 'virginia-beach-va'}
busonly = {cid for cid, r in am if r['modeEvidence']['qualification'] == 'bus-only'}
out(busonly == p419, 'C5 bus-only set equals the 23 IDs found independently in P4-19', sorted(busonly ^ p419))
pm = ver(Ci.get('portland'), 'AMTRAK'); po = ver(Ci.get('portland-or'), 'AMTRAK')
out(bool(pm and po and not set(pm['modeEvidence']['stopIds']) & set(po['modeEvidence']['stopIds'])), 'C5 Portland ME and OR keep separate stop IDs', (pm and pm['modeEvidence']['stopIds'], po and po['modeEvidence']['stopIds']))

# ---- 10. Ledger: selection, revision, outcomes
base_ver = {c['id'] for c in B['nationalCities'] if c['auditStatus'] == 'verified'}
vstates = {Bi[i]['state'] for i in base_ver}
pool = [c for c in B['nationalCities'] if c['auditStatus'] == 'unresolved']
pool.sort(key=lambda c: (c['state'] in vstates, c['inclusionReason'] != 'population-100000', -(c['population'] or 0), c['id']))
orig = [c['id'] for c in pool[:25]]
out(orig == batch['originalSelection'], 'original 25 selection reproduced from baseline data with the stated sort rule', [x for x in orig if x not in batch['originalSelection']])
rev = [i for i in orig if i != 'peoria-az'] + ['macon-bibb-county-ga']
out(sorted(rev) == sorted(batch['revisedSelection']) and len(set(batch['revisedSelection'])) == 25 and 'peoria-az' in orig, 'revised = original - peoria-az + macon-bibb-county-ga (25 unique)')
out(batch['selectionRevision'].get('coordinatorComment') == 6392514158 and batch['preliminaryScreening'][0]['cityId'] == 'peoria-az'
    and batch['preliminaryScreening'][0]['status'] == 'pending-next-batch' and Ci['peoria-az']['auditStatus'] == 'unresolved', 'Peoria preliminary screens preserved; Peoria still unresolved')
recs = {r['cityId']: r for r in batch['records']}
out(set(recs) == set(batch['revisedSelection']) and all(r['before'] == Bi[i]['auditStatus'] == 'unresolved' and r['after'] == Ci[i]['auditStatus'] for i, r in recs.items()),
    'ledger before/after matches runtime for all 25 rows', Counter(r['after'] for r in recs.values()))
neg = [i for i, r in recs.items() if r['after'] == 'unresolved' and any('no service' in json.dumps(r).lower() and 'not proof of no service' not in json.dumps(r).lower() for _ in [0])]
out(not neg, 'unresolved ledger rows make no absence claim', neg)
out(len(batch['sources']) == 18 and src['grey-chattanooga']['finalUrl'] == 'https://www.greyhound.com/bus' and Ci['chattanooga-tn']['auditStatus'] == 'unresolved',
    '18 dated responses incl. Chattanooga redirect retained; Chattanooga unresolved')
d = json.load(open(checkout + '/src/data/national/sources.json'))
out(src['flix-directory']['sha256'] == d['busDirectories'][0]['sha256'] and src['grey-directory']['sha256'] == d['busDirectories'][1]['sha256'], 'batch directory responses byte-identical to frozen manifest hashes')
frozen = {f: hashlib.sha256(open(f'{checkout}/src/data/national/{f}', 'rb').read()).hexdigest() for f in batch['baselineFileSha256']}
out(frozen == batch['baselineFileSha256'], 'four frozen JSON files match the recorded baseline hashes')

# ---- 11. Documentation consistency
top = re.findall(r'(\d+)\s*qualified|(\d+)\s*unresolved', readme[:900])
out(None, 'top-level README overlay sentence', readme.split('\n\n')[1].replace('\n', ' ')[:400])

# ---- 12. Location helper compatibility (P4-22 H2 context): choices are null-free
out(all(Ci[i]['latitude'] is not None and Ci[i]['longitude'] is not None for i in choices), 'all 1371 choices have coordinates')
print('== SUMMARY', dict(tally))
