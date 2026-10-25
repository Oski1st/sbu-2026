# P4-19 independent mechanical audit of the national catalogue (PR #20). Reads only saved files; no network.
# Usage: python3 -I qa/p4-19-catalogue-audit.py <dump.json> <catalogue checkout> <2025_Gaz_place_national.zip>
#   <dump.json> comes from: P4_19_DUMP_OUT=<dump.json> pnpm exec vitest run qa/p4-19-catalogue-dump.test.ts (in the catalogue checkout)
# Prints counts and breakdowns; the final FAILURES line lists contract violations (empty dict = none).
import json,sys,re,math,csv,io,zipfile
from collections import Counter,defaultdict
from urllib.parse import urlparse
from datetime import date
dump,repo,gaz=sys.argv[1:4]
d=json.load(open(dump)); C=d['nationalCities']; byid={c['id']:c for c in C}
src=json.load(open(repo+'/src/data/national/sources.json'))
z=zipfile.ZipFile(gaz);G={x['GEOID'].strip():{k.strip():v.strip() for k,v in x.items()} for x in csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode()),delimiter='|')}
fail=defaultdict(list)
def F(k,v): fail[k].append(v)
st=Counter(c['auditStatus'] for c in C)
print('TOTAL',len(C),dict(st),'verifiedExport',len(d['verifiedIds']),'major',len(d['majorIds']))
print('audit',json.dumps(d['audit']))
print('inclusion',Counter(c['inclusionReason'] for c in C)); print('geography',Counter(c['geography'] for c in C)); print('coordMethod',Counter(c['coordinateMethod'] for c in C))
# IDs
ids=[c['id'] for c in C]
if len(set(ids))!=len(ids): F('dupId',[i for i,n in Counter(ids).items() if n>1])
for c in C:
  if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*',c['id']): F('badId',c['id'])
  if not c['legacyId'] and not c['id'].endswith('-'+c['state'].lower()): F('noStateSuffix',c['id'])
gids=[c['censusGeoid'] for c in C if c['censusGeoid']]
for g,n in Counter(gids).items():
  if n>1: F('dupGeoid',[(c['id']) for c in C if c['censusGeoid']==g])
ns=Counter((c['name'].lower(),c['state']) for c in C)
for k,n in ns.items():
  if n>1: F('dupNameState',k)
# states / territories
states=Counter(c['state'] for c in C); print('states',len(states),sorted(set(states)-set(['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'])))
ver_states={c['state'] for c in C if c['auditStatus']=='verified'}; print('verified states',len(ver_states),'states w/o verified',sorted(set(states)-ver_states))
# coordinates
for c in C:
  la,lo=c['latitude'],c['longitude']
  if la is None or lo is None:
    if c['coordinateMethod']!='unavailable' or c['auditStatus']=='verified': F('nullCoordBad',c['id'])
    continue
  if not(18<=la<=72 and -180<=lo<=-66): F('coordOutsideUS',(c['id'],la,lo))
  if abs(la*100-round(la*100))>1e-6 or abs(lo*100-round(lo*100))>1e-6: F('notRounded',c['id'])
  if c['coordinateMethod']=='census-internal-point':
    g=G.get(c['censusGeoid'])
    if not g: F('geoidNotInGaz',c['id']); continue
    if g['USPS']!=c['state']: F('stateMismatchGaz',c['id'])
    if abs(round(float(g['INTPTLAT']),2)-la)>1e-9 or abs(round(float(g['INTPTLONG']),2)-lo)>1e-9: F('coordMismatchGaz',c['id'])
    if c['censusName']!=g['NAME']: F('censusNameMismatch',c['id'])
  elif c['coordinateMethod']=='operator-stop-representative':
    if c['censusGeoid'] is not None: F('stopRepWithGeoid',c['id'])
nullc=[c['id'] for c in C if c['latitude'] is None]; print('null coords',len(nullc),Counter(byid[i]['auditStatus'] for i in nullc))
# population
for c in C:
  if c['inclusionReason']=='population-100000' and not (c['population'] and c['population']>=100000 and c['populationVintage']==2025): F('popBenchmark',c['id'])
  if c['population'] is not None and c['populationVintage']!=2025: F('popVintage',c['id'])
  if c['population'] is None and (c['populationVintage'] is not None or c['populationSourceUrl'] is not None): F('popNullInconsistent',c['id'])
big_small=[(c['id'],c['population']) for c in C if c['inclusionReason']=='operator-listed-place' and c['population'] and c['population']>=100000]
print('operator-listed places with pop>=100k',big_small)
# Possible duplicates of a major/legacy city: operator-listed place within 10km of a candidate in same state
def km(a,b):
  la1,lo1,la2,lo2=map(math.radians,[a['latitude'],a['longitude'],b['latitude'],b['longitude']]);h=math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2;return 6371*2*math.asin(math.sqrt(h))
cand=[c for c in C if c['inclusionReason']!='operator-listed-place']
near=[]
for o in C:
  if o['inclusionReason']!='operator-listed-place' or o['latitude'] is None: continue
  for c in cand:
    if c['state']==o['state'] and km(o,c)<8 and o['censusGeoid'] is None: near.append((o['id'],o['auditStatus'],c['id'],round(km(o,c),1)))
print('ungeocoded operator markets <8km from a candidate city (possible duplicate market):',len(near)); [print(' ',x) for x in near]
# aliases
alias_owner=defaultdict(set)
for c in C:
  if not c['aliases']: F('noAlias',c['id'])
  for a in c['aliases']: alias_owner[a.lower()].add(c['id'])
amb=[(a,sorted(v)) for a,v in alias_owner.items() if len(v)>1]
print('aliases shared by >1 entry',len(amb), 'state-qualified shared', [x for x in amb if ', ' in x[0]][:10])
# coverage records
verOps=d['verifiedOperators']; ops=['SEPTA','NJ_TRANSIT','LIRR','AMTRAK','GREYHOUND','FLIXBUS']
hosts={'SEPTA':{'www3.septa.org','schedules.septa.org'},'NJ_TRANSIT':{'www.njtransit.com'},'LIRR':{'www.mta.info'},'AMTRAK':{'content.amtrak.com','www.amtrak.com'},'GREYHOUND':{'www.greyhound.com'},'FLIXBUS':{'www.flixbus.com'}}
checks={(x['cityId'],x['operator'],x['sourceUrl']):x for x in src['busPageChecks']}
per=Counter(); routing_keys={'fare','fares','departure','departures','arrival','legs','routes','route','edges','schedule','duration','price','trip','trips','connections'}
for c in C:
  if [r['marketedOperator'] for r in c['coverage']]!=ops: F('coverageOrder',c['id'])
  v=[r for r in c['coverage'] if r['status']=='verified']
  if verOps[c['id']]!=v: F('lookupMismatch',c['id'])
  if (c['auditStatus']=='verified')!=(len(v)>0) and c['auditStatus']!='excluded': F('statusMismatch',c['id'])
  if c['auditStatus']=='excluded' and v: F('excludedHasVerified',c['id'])
  if routing_keys & set(c): F('routingFieldOnCity',c['id'])
  for r in c['coverage']:
    if routing_keys & set(r): F('routingFieldOnRecord',(c['id'],r['marketedOperator']))
    try: date.fromisoformat(r['checkedDate'])
    except Exception: F('badDate',(c['id'],r['marketedOperator'],r['checkedDate']))
    if r['checkedDate']!='2026-10-24': F('dateNot20261024',(c['id'],r['marketedOperator'],r['checkedDate']))
    urls=[r['sourceUrl']]+([r['evidenceUrl']] if 'evidenceUrl' in r else [])+list(r.get('additionalSourceUrls',[]))
    for u in urls:
      p=urlparse(u)
      if p.scheme!='https' or p.username or p.password or p.port or not p.netloc or ' ' in u: F('badUrl',(c['id'],u))
      elif r['status']=='verified' and p.hostname not in hosts[r['marketedOperator']]: F('wrongHost',(c['id'],u))
    if r['status']=='verified':
      per[r['marketedOperator']]+=1
      if r['qualification']!='city-market' or r['municipalCoverage']!='pending' or r['operatingCarrier']!='pending': F('qualification',(c['id'],r['marketedOperator']))
      if not r['stops'] or any(not s.strip() for s in r['stops']): F('emptyStops',(c['id'],r['marketedOperator']))
      if not r['note']: F('noNote',c['id'])
      if r['marketedOperator'] in('GREYHOUND','FLIXBUS'):
        for u in [r['sourceUrl']]+list(r.get('additionalSourceUrls',[])):
          k=checks.get((c['id'],r['marketedOperator'],u))
          if not k or k['status']!='verified' or not re.fullmatch('[0-9a-f]{64}',k.get('sha256','')): F('busNoHashedCheck',(c['id'],u))
    else:
      if r['qualification']!='unresolved' or not r.get('reason'): F('pendingShape',(c['id'],r['marketedOperator']))
      if 'stops' in r or 'evidenceUrl' in r: F('pendingCarriesEvidence',(c['id'],r['marketedOperator']))
      if re.search(r'\b(unserved|no service|not served)\b',r['reason'],re.I) and 'not evidence of no service' not in r['reason'] and 'no service-absence' not in r['reason']: F('absenceClaim',(c['id'],r['reason']))
print('verified records by operator',dict(per),'total',sum(per.values()))
# bus checks reconciliation
bc=src['busPageChecks']; print('busPageChecks',len(bc),Counter(x['status'] for x in bc),'withHash',sum('sha256' in x for x in bc),'pendingNoHash',sum(x['status']=='pending' and 'sha256' not in x for x in bc),'pendingWithHash',sum(x['status']=='pending' and 'sha256' in x for x in bc))
print('busPageChecks dates',Counter(x['checkedDate'] for x in bc))
print('pending by operator',Counter((x['operator'],'hash' if 'sha256' in x else 'requestFail') for x in bc if x['status']=='pending'))
for x in bc:
  if x['cityId'] not in byid: F('busCheckUnknownCity',x['cityId'])
  if x['status']=='verified':
    r=[r for r in byid[x['cityId']]['coverage'] if r['marketedOperator']==x['operator']][0]
    if r['status']!='verified' or x['sourceUrl'] not in [r['sourceUrl']]+list(r.get('additionalSourceUrls',[])): F('verifiedCheckNotUsed',(x['cityId'],x['operator']))
# multiple URLs per city/operator
multi=[(c['id'],r['marketedOperator'],len(r['additionalSourceUrls'])) for c in C for r in c['coverage'] if r.get('additionalSourceUrls')]
print('records with additionalSourceUrls',len(multi),multi[:10])
# unresolved breakdown
unres=[c for c in C if c['auditStatus']=='unresolved']
print('unresolved by inclusion',Counter(c['inclusionReason'] for c in unres))
print('unresolved majors',sorted(c['id'] for c in unres if c['inclusionReason']=='population-100000'))
# legacy
leg=sorted(c['id'] for c in C if c['legacyId']); print('legacy',len(leg),[ (i,byid[i]['state'],byid[i]['auditStatus'],[r['marketedOperator'] for r in verOps[i]]) for i in leg])
print('FAILURES',{k:(len(v),v[:12]) for k,v in fail.items()})
