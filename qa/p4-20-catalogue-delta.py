# P4-20 catalogue follow-up delta: compare a candidate catalogue against the frozen P4-19 baseline (d45b0d3).
# Offline only: reads two dumps from qa/p4-19-catalogue-dump.test.ts, both sources.json manifests and the Amtrak GTFS zip.
# Usage: python3 -I qa/p4-20-catalogue-delta.py <base-dump.json> <base-sources.json> <cand-dump.json> <cand-sources.json> <amtrak-GTFS.zip> <cand-README.md>
# Prints count deltas, every changed entry/record, and PASS/CHECK/FAIL lines for C1-C5 and the regression rules.
# CHECK means the result needs a human reading of the candidate's documented schema; it is never counted as a pass.
import csv, io, json, sys, zipfile
from collections import Counter

base_dump, base_src, cand_dump, cand_src, gtfs, readme = sys.argv[1:7]
B, C = json.load(open(base_dump)), json.load(open(cand_dump))
BS, CS = json.load(open(base_src)), json.load(open(cand_src))
Bi = {c['id']: c for c in B['nationalCities']}
Ci = {c['id']: c for c in C['nationalCities']}
OPS = ['SEPTA', 'NJ_TRANSIT', 'LIRR', 'AMTRAK', 'GREYHOUND', 'FLIXBUS']
results = []

def out(status, key, detail):
    results.append(status)
    print(f'{status:5} {key}: {detail}')

def ver(city, op):
    return next((r for r in city['coverage'] if r['marketedOperator'] == op and r['status'] == 'verified'), None) if city else None

# ---- Count deltas
print('== Counts (base -> candidate)')
for k in sorted(set(B['audit']) | set(C['audit'])):
    if k != 'byOperator':
        print(f'  {k}: {B["audit"].get(k)} -> {C["audit"].get(k)}')
for op in OPS:
    b, c = B['audit']['byOperator'][op], C['audit']['byOperator'].get(op, {})
    print(f'  {op}: cityMarkets {b["cityMarkets"]} -> {c.get("cityMarkets")}, pending {b["pending"]} -> {c.get("pending")}')
print('  sources.counts', BS['counts'], '->', CS.get('counts'))

# ---- Entry and record deltas
added, removed = sorted(set(Ci) - set(Bi)), sorted(set(Bi) - set(Ci))
print(f'== Entries added {len(added)}: {added}')
print(f'== Entries removed {len(removed)}: {removed}')
status_changes = [(i, Bi[i]['auditStatus'], Ci[i]['auditStatus']) for i in sorted(set(Bi) & set(Ci)) if Bi[i]['auditStatus'] != Ci[i]['auditStatus']]
print(f'== auditStatus changes {len(status_changes)}: {status_changes}')
field_changes = []
for i in sorted(set(Bi) & set(Ci)):
    for f in sorted(set(Bi[i]) | set(Ci[i])):
        if f != 'coverage' and Bi[i].get(f) != Ci[i].get(f):
            field_changes.append((i, f, Bi[i].get(f), Ci[i].get(f)))
print(f'== Entry field changes {len(field_changes)}:')
for x in field_changes: print('  ', x)
rec_changes = []
for i in sorted(set(Bi) | set(Ci)):
    for op in OPS:
        b, c = ver(Bi.get(i), op), ver(Ci.get(i), op)
        if b != c: rec_changes.append((i, op, 'added' if not b else 'removed' if not c else 'changed'))
print(f'== Verified record changes {len(rec_changes)}: {Counter(x[2] for x in rec_changes)}')
for x in rec_changes: print('  ', x)

# Audit-row resolution versus new distinct markets
resolved = [i for i, b, c in status_changes if b == 'unresolved' and c == 'verified']
new_verified = [i for i in added if Ci[i]['auditStatus'] == 'verified']
print(f'== Audit-row resolutions (existing unresolved -> verified) {len(resolved)}: {resolved}')
print(f'== New verified entries (new distinct markets unless linked) {len(new_verified)}: {new_verified}')

# ---- Source snapshot preservation
for key in ['population', 'coordinates', 'amtrak']:
    same = BS[key].get('sha256') == CS.get(key, {}).get('sha256')
    out('PASS' if same else 'CHECK', f'source {key} sha256 unchanged', 'same' if same else f'{BS[key].get("sha256")} -> {CS.get(key, {}).get("sha256")} (needs a declared new snapshot)')
bd = [d['sha256'] for d in BS['busDirectories']]; cd = [d['sha256'] for d in CS.get('busDirectories', [])]
out('PASS' if bd == cd else 'CHECK', 'bus directory sha256 unchanged', 'same' if bd == cd else f'{bd} -> {cd}')
bkey = {(x['cityId'], x['operator'], x['sourceUrl']): x for x in BS['busPageChecks']}
ckey = {(x['cityId'], x['operator'], x['sourceUrl']): x for x in CS.get('busPageChecks', [])}
gone = [k for k in bkey if k not in ckey and k[0] in Ci]
changed = [k for k in bkey if k in ckey and bkey[k] != ckey[k]]
new = [k for k in ckey if k not in bkey]
out('PASS' if not changed else 'CHECK', 'existing bus page checks unchanged', f'{len(changed)} changed: {changed[:10]}')
print(f'  bus page checks removed for surviving IDs {len(gone)}: {gone[:10]}; new {len(new)}: {new}')
lim = ' '.join(CS.get('limitations', []))
out('PASS' if 'blocked' in lim and 'Token Required' in lim else 'FAIL', 'Amtrak 403/blocked and ArcGIS limitations retained', 'present' if 'blocked' in lim else 'missing')

# ---- Regression rules
legacy_b = {c['id']: (c['name'], c['state']) for c in B['nationalCities'] if c['legacyId']}
legacy_c = {c['id']: (c['name'], c['state']) for c in C['nationalCities'] if c['legacyId']}
out('PASS' if legacy_b == legacy_c else 'FAIL', 'all 24 legacy IDs, names and states unchanged', 'same' if legacy_b == legacy_c else f'{legacy_b} -> {legacy_c}')
lost = [i for i in B['verifiedIds'] if i not in set(C['verifiedIds'])]
lost_small = [i for i in lost if Bi[i]['inclusionReason'] == 'operator-listed-place']
out('PASS' if not lost else 'CHECK', 'no previously verified entry dropped from verifiedNationalCities', f'{len(lost)} dropped ({len(lost_small)} smaller operator-listed): {lost}')
pop_filter = [c['id'] for c in C['nationalCities'] if c['auditStatus'] == 'verified' and c['id'] not in set(C['verifiedIds']) and c['latitude'] is not None]
out('PASS' if not pop_filter else 'FAIL', 'no population threshold applied to Search eligibility', f'{len(pop_filter)} verified-with-coordinates entries excluded from verifiedNationalCities')
excl = [c['id'] for c in C['nationalCities'] if c['auditStatus'] == 'excluded']
out('PASS' if excl == [c['id'] for c in B['nationalCities'] if c['auditStatus'] == 'excluded'] else 'CHECK', 'excluded set unchanged (Urban Honolulu only)', excl)
pend_ok = all(r['qualification'] == 'unresolved' and 'not evidence of no service' in r.get('reason', '') or r['status'] == 'excluded'
              for c in C['nationalCities'] for r in c['coverage'] if r['status'] != 'verified')
out('PASS' if pend_ok else 'FAIL', 'pending records keep the "not evidence of no service" wording', pend_ok)
carrier = [(c['id'], r['marketedOperator']) for c in C['nationalCities'] for r in c['coverage'] if r['status'] == 'verified' and (r.get('operatingCarrier') != 'pending' or r.get('municipalCoverage') != 'pending')]
out('PASS' if not carrier else 'FAIL', 'operatingCarrier and municipalCoverage stay pending on every verified record', f'{len(carrier)} violations: {carrier[:10]}')

# ---- C1 Washington DC bus pages
w = Ci.get('washington')
for op, url in [('FLIXBUS', 'https://www.flixbus.com/bus/washington-dc'), ('GREYHOUND', 'https://www.greyhound.com/bus/washington-dc')]:
    r = ver(w, op)
    chk = ckey.get(('washington', op, url))
    ok = bool(r and url in [r['sourceUrl']] + list(r.get('additionalSourceUrls', [])) and chk and chk.get('status') == 'verified' and len(chk.get('sha256', '')) == 64)
    out('PASS' if ok else 'FAIL', f'C1 washington {op} verified from {url} with a hashed page check', r['stops'] if r else 'no verified record')
dc_dupes = [i for i in Ci if i not in Bi and (i.endswith('-dc') or i.endswith('-d-c')) and i != 'washington']
out('PASS' if not dc_dupes else 'FAIL', 'C1 no new duplicate DC entry', dc_dupes)
other_new_checks = [k for k in new if k[0] != 'washington']
out('PASS' if not other_new_checks else 'CHECK', 'C1 state-label fix adds no unexpected page checks', other_new_checks)

# ---- C2 Boise / Lexington / Macon
for census, operator in [('boise-city-id', 'boise-id'), ('lexington-fayette-urban-county-ky', 'lexington-ky'), ('macon-bibb-county-ga', 'macon-ga')]:
    a, o = Ci.get(census), Ci.get(operator)
    searchable = [i for i in (census, operator) if i in set(C['verifiedIds'])]
    linked = [k for k in (a or {}) if 'market' in k.lower() and k not in ('geography',)] + [k for k in (o or {}) if 'market' in k.lower()]
    detail = f'{census}={a["auditStatus"] if a else "absent"} {operator}={o["auditStatus"] if o else "absent"}; searchable {searchable}; link-like fields {sorted(set(linked))}'
    census_verified = bool(a and a['auditStatus'] == 'verified')
    if census_verified and len(searchable) == 1:
        out('PASS', f'C2 {census}: audit row resolved, one searchable market', detail)
    elif census_verified or linked:
        out('CHECK', f'C2 {census}: resolved/linked but {len(searchable)} searchable entries; must be one market with a sourced link, counted once', detail)
    else:
        out('FAIL', f'C2 {census}: benchmark row still unresolved and not linked to the verified operator market', detail)
    if a:
        print(f'  display name {a["name"]!r}, aliases {a["aliases"]}')

# ---- C3 shared bus-directory provenance
g = [c for c in C['nationalCities'] if ver(c, 'GREYHOUND')]
same = sum(1 for c in g if ver(c, 'FLIXBUS') and ver(c, 'FLIXBUS')['stops'] == ver(c, 'GREYHOUND')['stops'])
g_only = sum(1 for c in g if not ver(c, 'FLIXBUS'))
out('CHECK', 'C3 Greyhound/FlixBus overlap (read the provenance wording)', f'{len(g)} Greyhound records, {same} identical to FlixBus, {g_only} Greyhound-only')
notes = Counter(ver(c, 'GREYHOUND')['note'] for c in g)
print('  Greyhound record notes:', list(notes.items())[:3])
text = json.dumps(CS) + open(readme).read()
indep = 'independent evidence source' in text
out('PASS' if not indep else 'FAIL', 'C3 README and manifest make no independent-evidence claim for the two brands', 'claim present' if indep else 'none')

# ---- C4 New York Amtrak
z = zipfile.ZipFile(gtfs)
read = lambda n: list(csv.DictReader(io.StringIO(z.read(n).decode('utf-8-sig'))))
stops = {s['stop_id']: s for s in read('stops.txt')}
r = ver(Ci.get('new-york'), 'AMTRAK')
nyp = stops['NYP']['stop_name']
out('PASS' if r and nyp in r['stops'] else 'FAIL', f'C4 new-york AMTRAK verified with "{nyp}"', r['stops'] if r else 'no verified record')
amtrak_added = [x for x in rec_changes if x[1] == 'AMTRAK' and x[0] != 'new-york']
out('PASS' if not amtrak_added else 'CHECK', 'C4 matching change adds/removes no other Amtrak record', amtrak_added)

# ---- C5 bus-only versus rail evidence (from this GTFS, not a claim about other service)
routes = {x['route_id']: x['route_type'] for x in read('routes.txt')}
trips = {t['trip_id']: routes[t['route_id']] for t in read('trips.txt')}
types = {}
for st in read('stop_times.txt'):
    types.setdefault(st['stop_id'], set()).add(trips[st['trip_id']])
by_name = {}
for sid, s in stops.items():
    by_name.setdefault(s['stop_name'], set()).update(types.get(sid, set()))
bus_only = []
for c in C['nationalCities']:
    r = ver(c, 'AMTRAK')
    if r and 'gtfs' in r['sourceUrl'].lower():
        t = set().union(*[by_name.get(s, set()) for s in r['stops']])
        if t and t <= {'3'}: bus_only.append((c['id'], r))
mode_fields = sorted({k for _, r in bus_only for k in r if 'mode' in k.lower() or 'vehicle' in k.lower()})
out('CHECK', f'C5 {len(bus_only)} Amtrak records match only route_type 3 stops; mode fields present: {mode_fields}', [i for i, _ in bus_only])
rail_marked_bus = [c['id'] for c in C['nationalCities'] if ver(c, 'AMTRAK') and 'bus-only' in json.dumps(ver(c, 'AMTRAK')).lower() and c['id'] not in {i for i, _ in bus_only}]
out('PASS' if not rail_marked_bus else 'FAIL', 'C5 no rail-served record labelled bus-only', rail_marked_bus)

print('== SUMMARY', Counter(results))
