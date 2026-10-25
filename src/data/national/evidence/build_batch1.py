"""Rebuild bounded batch1 from saved official-source responses, never crawl at runtime.
Usage: python3 .../build_batch1.py /path/to/saved/batch1-responses
"""
import argparse, csv, hashlib, json, re, io, zipfile, collections, sys, math
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

p=argparse.ArgumentParser();p.add_argument('responses',type=Path);a=p.parse_args()
root=Path(__file__).resolve().parents[1];out=Path(__file__).parent
baseline='d45b0d3305e154ac93c165af70ecfb6e8812f74b'
cities=json.loads((root/'candidates.json').read_text())+json.loads((root/'operatorPlaces.json').read_text())
coverage=json.loads((root/'coverage.json').read_text());city_index={c['id']:c for c in cities}
verified={r['cityId'] for r in coverage};states={c['state'] for c in cities if c['id'] in verified}
selected=[c for c in cities if c['id'] not in verified and c['inclusionReason']!='excluded-non-incorporated']
selected.sort(key=lambda c:(c['state'] in states,c['inclusionReason']!='population-100000',-(c['population'] or 0),c['id']))
original_selected=selected[:25]
# Coordinator6392514158: preserve preliminary screens, replace only an uninvestigated generic row.
displaced='peoria-az'
selected=[c for c in original_selected if c['id']!=displaced]+[city_index['macon-bibb-county-ga']]
assert len(selected)==25 and len({c['id'] for c in selected})==25
sys.path.insert(0,str(root));from ingestion import directory_state
assert directory_state('D.C.',{'DC'})=='DC'
attempts=json.loads((a.responses/'attempts.json').read_text());bykey={x['key']:x for x in attempts}
for x in attempts:
 suffix='.pdf' if x['sourceUrl'].endswith('.pdf') else '.html'
 raw=(a.responses/(x['key']+suffix)).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==x['sha256'],x['key']
class Links(HTMLParser):
 def __init__(self):super().__init__();self.href=None;self.text='';self.links=[]
 def handle_starttag(self,t,attrs):
  if t=='a':self.href=dict(attrs).get('href');self.text=''
 def handle_data(self,d):
  if self.href:self.text+=d
 def handle_endtag(self,t):
  if t=='a' and self.href:self.links.append((self.text.strip(),self.href));self.href=None
links={}
for key in ['flix-directory','grey-directory','grey-stops']:
 parser=Links();parser.feed((a.responses/(key+'.html')).read_text());links[key]=parser.links

def stop_names(key):
 item=bykey[key];assert item['httpStatus']==200 and item['finalUrl']==item['sourceUrl']
 names=[]
 for script in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',(a.responses/(key+'.html')).read_text(),re.S):
  try:data=json.loads(script)
  except ValueError:continue
  if isinstance(data,dict):names.extend(n['name'] for n in data.get('@graph',[]) if n.get('@type')=='BusStop' and n.get('name'))
 assert names,key
 return sorted(set(names))

relations=[
 dict(cityId='macon-bibb-county-ga',sameMarketAsCityId='macon-ga',qualification='named-city-market-alias',checkedDate=bykey['macon-name']['checkedDate'],sourceUrls=[bykey['macon-name']['sourceUrl'],bykey['flix-macon']['sourceUrl']],observation='Official Macon-Bibb County government homepage identifies its Macon GA address; operator page names Macon GA.',note='Same named market only, not equal city/county boundaries, boarding stops, actual carrier or connections.'),
 dict(cityId='boise-city-id',sameMarketAsCityId='boise-id',qualification='named-city-market-alias',checkedDate=bykey['boise-name']['checkedDate'],sourceUrls=[bykey['boise-name']['sourceUrl'],bykey['flix-boise']['sourceUrl']],observation='Official City of Boise FY2019 report, page16, uses Boise City; current operator page names Boise ID.',note='Same-state named-market identity only, not equal municipal boundaries, stops, carrier or connections.'),
 dict(cityId='lexington-fayette-urban-county-ky',sameMarketAsCityId='lexington-ky',qualification='named-city-market-alias',checkedDate=bykey['lexington-name']['checkedDate'],sourceUrls=[bykey['lexington-name']['sourceUrl'],bykey['flix-lexington']['sourceUrl']],observation='Official Lexington homepage identifies Lexington-Fayette Urban County Government and Lexington KY.',note='Named-market identity; no claim every part of the consolidated area shares a boarding stop or route.'),
]
assert 'Macon-Bibb County' in (a.responses/'macon-name.html').read_text() and 'Macon, GA' in (a.responses/'macon-name.html').read_text()
assert 'Lexington-Fayette Urban County Government' in unescape((a.responses/'lexington-name.html').read_text())
boise_observation=json.loads((a.responses/'boise-name-observation.json').read_text())[0]
assert boise_observation['page']==16 and 'Boise City operates under' in boise_observation['phrase']
additions=[]
for city_id,operator,key in [('boise-city-id','FLIXBUS','flix-boise'),('boise-city-id','GREYHOUND','grey-boise'),('lexington-fayette-urban-county-ky','FLIXBUS','flix-lexington'),('lexington-fayette-urban-county-ky','GREYHOUND','grey-lexington'),('jersey-city-nj','NJ_TRANSIT','njt-jersey'),('macon-bibb-county-ga','FLIXBUS','flix-macon'),('macon-bibb-county-ga','GREYHOUND','grey-macon'),('washington','FLIXBUS','flix-dc'),('washington','GREYHOUND','grey-dc')]:
 x=bykey[key]
 if operator=='NJ_TRANSIT':
  html=unescape((a.responses/(key+'.html')).read_text());assert 'West Side Avenue Station' in html and 'Jersey City' in html
  stops=['West Side Avenue Station']
 else:stops=stop_names(key)
 additions.append(dict(cityId=city_id,status='verified',marketedOperator=operator,qualification='city-market',sourceUrl=x['sourceUrl'],evidenceUrl=x['sourceUrl'],checkedDate=x['checkedDate'],checkedAt=x['checkedAt'],responseSha256=x['sha256'],stops=stops,municipalCoverage='pending',operatingCarrier='pending',note='Batch1 official named-market/station observation. See explicit sameMarketAsCityId relation where present; no municipal-boundary, carrier, availability or connection verification.'+(' Official station lists Hudson-Bergen Light Rail, not an inferred intercity rail or coach connection.' if operator=='NJ_TRANSIT' else '')))
for market in ['boise','lexington','macon','dc']:
 assert stop_names('flix-'+market)==stop_names('grey-'+market),'Changed shared stop provenance requires review'
assert len({(r['cityId'],r['marketedOperator']) for r in additions})==len(additions)

required=['status','marketedOperator','qualification','sourceUrl','evidenceUrl','checkedDate','stops','municipalCoverage','operatingCarrier','note']
missing=[]
for r in coverage:
 fields=[key for key in required if key not in r or r[key] in [None,'',[]]]
 if fields:missing.append(dict(cityId=r['cityId'],operator=r['marketedOperator'],missingFields=fields))
# C4: exact feed stop ID + independent official station-identity observation, never fuzzy name expansion.
feed_file=a.responses.parent/'amtrak-GTFS.zip';feed_manifest=json.loads((root/'sources.json').read_text())['amtrak']
assert hashlib.sha256(feed_file.read_bytes()).hexdigest()==feed_manifest['sha256']
z=zipfile.ZipFile(feed_file)
def gtfs_rows(name):return list(csv.DictReader(io.StringIO(z.read(name+'.txt').decode('utf-8-sig'))))
feed_stops=gtfs_rows('stops');feed_stop_index={r['stop_id']:r for r in feed_stops}
nyp=feed_stop_index['NYP'];identity=unescape((a.responses/'nyp-identity.html').read_text())
assert nyp['stop_name']=='Ny Moynihan Train Hall At Penn Station'
assert 'New York, NY' in identity and '(NYP)' in identity and 'Amtrak' in identity
additions.append(dict(cityId='new-york',status='verified',marketedOperator='AMTRAK',qualification='city-market',sourceUrl=feed_manifest['url'],evidenceUrl=feed_manifest['url'],additionalSourceUrls=[bykey['nyp-identity']['sourceUrl']],checkedDate=feed_manifest['checkedDate'] if 'checkedDate' in feed_manifest else '2026-10-24',responseSha256=feed_manifest['sha256'],stops=[nyp['stop_name']],municipalCoverage='pending',operatingCarrier='pending',note='Explicit NYC/NYP identity from official Amtrak Great American Stations page and exact GTFS stop ID NYP. Feed version20261024 starts2026-10-25, not current-service, ticket, boarding-stop equivalence or connection proof. Direct amtrak.com station request403 retained as failed attempt.'))
resolved={r['cityId'] for r in additions if r['cityId'] not in verified};ledger=[]
for c in selected:
 attempt_records=[]
 for key in ['flix-directory','grey-directory']:
  matches=[dict(label=label,url=url) for label,url in links[key] if label.casefold()==f"{c['name']}, {c['state']}".casefold()]
  attempt_records.append(dict(sourceKey=key,result='exact-listing' if matches else 'no-exact-listing-in-snapshot',matches=matches,note='Absence in this directory is not proof of no service; no nearby/metro substitution.'))
 keys=[key for cid,op,key in [('boise-city-id','FLIXBUS','flix-boise'),('boise-city-id','GREYHOUND','grey-boise'),('lexington-fayette-urban-county-ky','FLIXBUS','flix-lexington'),('lexington-fayette-urban-county-ky','GREYHOUND','grey-lexington'),('jersey-city-nj','NJ_TRANSIT','njt-jersey'),('macon-bibb-county-ga','FLIXBUS','flix-macon'),('macon-bibb-county-ga','GREYHOUND','grey-macon'),('washington','FLIXBUS','flix-dc'),('washington','GREYHOUND','grey-dc')] if cid==c['id']]
 for key in keys:attempt_records.append(dict(sourceKey=key,result='qualifying-named-market-evidence',observedStops=next(r['stops'] for r in additions if r['cityId']==c['id'] and r['sourceUrl']==bykey[key]['sourceUrl'])))
 reason='No qualifying exact named-market/station evidence established within this bounded two-directory review; other supported-operator possibilities remain unreviewed, not unserved.'
 if c['id']=='anchorage-ak':reason='Missing verified AK coverage remains unresolved. Neither bus directory provides an exact Anchorage listing; no unsupported Alaska operator added or inference of no service.'
 if c['id']=='glendale-az':
  attempt_records.append(dict(sourceKey='grey-stops',result='different-market',observedStops=['Phoenix Glendale Bus Stop, Phoenix, AZ'],note='Operator labels the market Phoenix, not Glendale; stop name alone cannot establish Glendale city-market membership.'))
 if c['id']=='chattanooga-tn':
  attempt_records.extend([dict(sourceKey='grey-stops',result='directory-detail-conflict',observedStops=['Chattanooga Bus Station, Chattanooga, TN']),dict(sourceKey='grey-chattanooga',result='redirect-to-generic-index',note='Named detail link redirects to general /bus index without stop evidence. Current status uncertain; do not promote or call unserved.')]);reason='Official popular-stop listing and redirected detail disagree; remains unresolved rather than accepting potentially stale named-stop evidence.'
 if c['id']=='boise-city-id':attempt_records.append(dict(sourceKey='boise-name',result='official-name-crosswalk',note='City of Boise report page16 uses Boise City; relation is named-market only.'))
 if c['id']=='lexington-fayette-urban-county-ky':attempt_records.append(dict(sourceKey='lexington-name',result='official-name-crosswalk',note='City homepage identifies Lexington-Fayette Urban County Government and Lexington KY.'))
 if c['id']=='macon-bibb-county-ga':attempt_records.append(dict(sourceKey='macon-name',result='official-name-crosswalk',note='Official Macon-Bibb government homepage identifies Macon GA; name-market identity only.'))
 if c['id'] in resolved:reason='Resolved qualified audit-row association only; explicit alias links preserve distinct market counting. New verified operator observations do not establish municipal service or connections.'
 if c['id']=='jersey-city-nj':reason='Official NJ TRANSIT West Side Avenue listing names Jersey City NJ and Hudson-Bergen Light Rail; new named market only, not an intercity connection or municipal-boundary proof.'
 ledger.append(dict(cityId=c['id'],name=c['name'],state=c['state'],population=c['population'],priority='missing-state' if c['state'] not in states else 'major-population',before='unresolved',after='verified' if c['id'] in resolved else 'unresolved',attempts=attempt_records,reason=reason))

canon={r['cityId']:r['sameMarketAsCityId'] for r in relations}
canonical=lambda id:canon.get(id,id)
all_records=coverage+additions;after_verified=verified|resolved
assert len({(r['cityId'],r['marketedOperator']) for r in all_records})==len(all_records),'Duplicate city/operator evidence requires explicit merge policy'
baseline_keys={(canonical(r['cityId']),r['marketedOperator'],r['sourceUrl']) for r in coverage}
after_keys={(canonical(r['cityId']),r['marketedOperator'],r['sourceUrl']) for r in all_records}
# C5: preserve GTFS mode provenance by exact recorded stop name, never infer rail from brand.
routes={r['route_id']:r for r in gtfs_rows('routes')};trips={r['trip_id']:r['route_id'] for r in gtfs_rows('trips')}
stop_routes=collections.defaultdict(set)
for r in gtfs_rows('stop_times'):stop_routes[r['stop_id']].add(trips[r['trip_id']])
def within_baseline_radius(city,stop):
 lat=math.radians(float(stop['stop_lat']));base=math.radians(city['latitude'])
 delta=math.sin((lat-base)/2)**2+math.cos(lat)*math.cos(base)*math.sin(math.radians(float(stop['stop_lon'])-city['longitude'])/2)**2
 return 6371*2*math.asin(min(1,math.sqrt(delta)))<50
mode_evidence=[]
for record in all_records:
 if record['marketedOperator']!='AMTRAK':continue
 matched=[r for r in feed_stops if r['stop_name'] in record['stops'] and within_baseline_radius(city_index[record['cityId']],r)]
 if record['cityId']=='new-york':matched=[feed_stop_index['NYP']]
 route_ids=sorted(set().union(*(stop_routes[r['stop_id']] for r in matched)))
 types=sorted({int(routes[id]['route_type']) for id in route_ids})
 qualification='bus-only' if types==[3] else 'rail-and-bus' if types==[2,3] else 'rail-only' if types==[2] else 'unverified'
 mode_evidence.append(dict(cityId=record['cityId'],stopIds=sorted(r['stop_id'] for r in matched),routeIds=route_ids,routeTypes=types,qualification=qualification,checkedDate='2026-10-24',sourceUrl=feed_manifest['url'],responseSha256=feed_manifest['sha256'],feedVersion=feed_manifest['feedVersion'],feedStartDate=feed_manifest['feedStartDate'],note='Snapshot mode evidence only, exact recorded stop names plus original <50km representative-point disambiguation (explicit NYP ID for NYC); not municipal containment. GTFS2=rail,3=bus. Brand is not mode/current-service/carrier proof. Unmatched manual station names remain mode-unverified. No schedule or routing edges imported.'))
preliminary=[]
for c in original_selected:
 if c['id']!=displaced:continue
 preliminary.append(dict(cityId=c['id'],status='pending-next-batch',reason='Coordinator6392514158 prioritizes explicit Macon/Bibb finding instead; only two saved-directory exact-label screens completed, no individual source request or substantive investigation.',attempts=[dict(sourceKey=key,result='no-exact-listing-in-snapshot') for key in ['flix-directory','grey-directory']]))
manifest=dict(batchId='catalogue-evidence-batch1',baselineSha=baseline,checkedDate=attempts[0]['checkedDate'],selection='Revised25: original deterministic missing-state/major-population selection with Peoria AZ displaced by targeted Macon/Bibb per coordinator6392514158. Not the original deterministic sample; preliminary screens retained separately.',recordLimit=25,originalSelection=[c['id'] for c in original_selected],revisedSelection=[c['id'] for c in selected],selectionRevision=dict(coordinatorComment=6392514158,displacedCityId=displaced,addedCityId='macon-bibb-county-ga',reason='Prioritize explicit P4-19 C2 naming finding within25, preserve prior screens separately.'),preliminaryScreening=preliminary,selectedCount=len(selected),sources=attempts,baselineFileSha256={f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in ['candidates.json','operatorPlaces.json','coverage.json','sources.json']},fieldAudit=dict(qualifiedRecordsChecked=len(coverage),requiredFields=required,missingRequiredFields=missing,municipalCoveragePending=sum(r['municipalCoverage']=='pending' for r in coverage),operatingCarrierPending=sum(r['operatingCarrier']=='pending' for r in coverage),note='Pending municipal/carrier details are explicit unknowns, not missing required city-market fields.'),summary=dict(totalAuditRows=len(cities),beforeQualifiedAuditRows=len(verified),afterQualifiedAuditRows=len(after_verified),beforeUnresolved=179,afterUnresolved=179-len(resolved),excluded=1,resolvedRows=len(resolved),aliasResolvedRows=len(relations),newDistinctNamedMarkets=len({canonical(id) for id in after_verified})-len({canonical(id) for id in verified}),afterDistinctVerifiedMarkets=len({canonical(id) for id in after_verified}),rawOperatorRecordsBefore=len(coverage),rawOperatorRecordsAfter=len(all_records),distinctOperatorEvidenceBefore=len(baseline_keys),distinctOperatorEvidenceAfter=len(after_keys)),records=ledger,coverageAdditions=additions,marketRelations=relations,matchingRepairs=[dict(finding='C1',cityId='washington',directoryLabel='Washington, D.C.',normalizedState='DC',sourceKeys=['flix-dc','grey-dc'],scope='Already-qualified market; two new brand/source observations, not new service.'),dict(finding='C4',cityId='new-york',stopId='NYP',stopName=nyp['stop_name'],sourceKeys=['nyp-identity','amtrak-nyp'],scope='Already-qualified market; exact sourced station identity only, direct station403 retained.')],reusedSources=[dict(**feed_manifest,checkedDate='2026-10-24',retrieval='Reused frozen successfully retrieved official snapshot; local hash revalidated, no new feed request.')],modeEvidence=mode_evidence,busSourceProvenance=dict(sourceFamily='flix-greyhound-shared-directories',independentCorroboration=False,auditComment=6392411912,auditEvidenceSha='3b297e01407b3735de674560cedfe49f22797b16',baselineSharedDirectoryLabels=1395,baselineIdenticalGreyhoundStopLists=563,baselineGreyhoundOnlyPlaces=0,batchIdenticalDualBrandStopLists=['boise','lexington','macon','dc'],note='Shared directory/stop-list provenance; two marketed brands are not independent corroboration and never verify actual Greyhound vehicle operation. New batch dual-brand stops also checked for equality.'),limits=['25 substantive baseline-unresolved reviews plus separately retained preliminary Peoria screen and qualified-market matching/mode repairs. No exhaustive all-operator/no-service claim.','Anchorage unresolved, Urban Honolulu CDP still excluded; HI/territory service not inferred.','No sources or fields imply equal municipal boundaries, actual carrier, boarding stop equivalence or routable connections.'])
(out/'batch1.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(manifest['summary']));print('Mode evidence',dict(collections.Counter(r['qualification'] for r in mode_evidence)));print('Required field errors',len(missing))
