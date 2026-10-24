import csv,json,zipfile,io,re,math,hashlib
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Build qualified market evidence from saved official-source audits; no network calls.')
parser.add_argument('source_folder',type=Path);args=parser.parse_args();folder=args.source_folder
root=Path(__file__).parent
cities=json.loads((root/'candidates.json').read_text());byid={c['id']:c for c in cities+json.loads((root/'operatorPlaces.json').read_text())};records=[];requests=json.loads((folder/'national-bus-evidence.json').read_text())
for x in requests:
 if x['status']!='verified':continue
 records.append(dict(cityId=x['cityId'],status='verified',marketedOperator=x['operator'],qualification='city-market',sourceUrl=x['sourceUrl'],evidenceUrl=x['sourceUrl'],checkedDate=x['checkedDate'],stops=sorted(set(s['name'] for s in x['stops'] if s['name'])),municipalCoverage='pending',operatingCarrier='pending',note='Official named city-market page with observed stop listings. Stops may be outside municipal limits; booking brand does not establish operating carrier, current availability or direct connections.'))
z=zipfile.ZipFile(folder/'amtrak-GTFS.zip');stops=list(csv.DictReader(io.StringIO(z.read('stops.txt').decode('utf-8-sig'))))
def norm(s):return re.sub('[^a-z0-9]+',' ',s.lower()).strip().replace('saint ','st ').replace('mount ','mt ')
def km(c,s):
 lat=float(s['stop_lat']);lon=float(s['stop_lon']);a=math.sin(math.radians(lat-c['latitude'])/2)**2+math.cos(math.radians(lat))*math.cos(math.radians(c['latitude']))*math.sin(math.radians(lon-c['longitude'])/2)**2
 return 6371*2*math.asin(min(1,math.sqrt(a)))
for c in cities:
 if c['inclusionReason'].startswith('excluded'):continue
 names={norm(a) for a in c['aliases'] if ', ' not in a}
 hits=[s for s in stops if any(norm(s['stop_name'])==n or norm(s['stop_name']).startswith(n+' ') for n in names) and km(c,s)<50]
 # A shared name near a state boundary is insufficient to assign a station to either municipality.
 hits=[s for s in hits if not any(other['id']!=c['id'] and norm(other['name'])==norm(c['name']) and km(other,s)<50 for other in cities)]
 if not hits:continue
 records.append(dict(cityId=c['id'],status='verified',marketedOperator='AMTRAK',qualification='city-market',sourceUrl='https://content.amtrak.com/content/gtfs/GTFS.zip',evidenceUrl='https://content.amtrak.com/content/gtfs/GTFS.zip',checkedDate='2026-10-24',stops=sorted(set(s['stop_name'] for s in hits)),municipalCoverage='pending',operatingCarrier='pending',note='Named Amtrak stop-directory market: exact city-name prefix/alias plus representative-point distance <50km, not municipal containment. GTFS snapshot version20261024 starts2026-10-25; station listing only, not a claim of service today, train-only service, operating carrier or pair connectivity.'))
def manual(city,operator,url,stops,note):
 records.append(dict(cityId=city,status='verified',marketedOperator=operator,qualification='city-market',sourceUrl=url,evidenceUrl=url,checkedDate='2026-10-24',stops=stops,municipalCoverage='pending',operatingCarrier='pending',note=note+' Named station/market evidence only, not municipal containment, current departures, carrier identity or a connection promise.'))
manual('kansas-city-mo','AMTRAK','https://www.amtrak.com/stations/kcy.html',['Kansas City Union Station'],'Official Amtrak page title explicitly identifies Kansas City MO; not Kansas City KS.')
manual('stony-brook','LIRR','https://www.mta.info/stations/stony-brook',['Stony Brook'],'Official MTA station page. Stony Brook is a regional CDP hub; campus station and CDP boundary are not treated as identical.')
manual('new-york','LIRR','https://www.mta.info/stations/penn-station',['Penn Station'],'Official MTA Penn Station page.')
manual('trenton','NJ_TRANSIT','https://www.njtransit.com/station/trenton-transit-center',['Trenton Transit Center'],'Official NJ TRANSIT station page.')
manual('newark-nj','NJ_TRANSIT','https://www.njtransit.com/station/newark-penn-station',['Newark Penn Station'],'Official NJ TRANSIT station page.')
manual('new-york','NJ_TRANSIT','https://www.njtransit.com/station/new-york-penn-station',['New York Penn Station'],'Official NJ TRANSIT station page.')
manual('philadelphia','SEPTA','https://www3.septa.org/ccstations/30th/',['30th Street Station'],'Official SEPTA Center City station directory.')
manual('trenton','SEPTA','https://schedules.septa.org/current/TRE.pdf',['Trenton Transit Center'],'Official SEPTA Trenton Line station list; no timetable values imported.')
assert all(r['cityId'] in byid for r in records)
grouped={}
for r in records:
 key=(r['cityId'],r['marketedOperator'])
 if key not in grouped:grouped[key]=r
 else:
  old=grouped[key];old['stops']=sorted(set(old['stops']+r['stops']));old.setdefault('additionalSourceUrls',[]).append(r['sourceUrl'])
records=list(grouped.values())
records.sort(key=lambda r:(r['cityId'],r['marketedOperator']))
(root/'coverage.json').write_text(json.dumps(records,indent=2,ensure_ascii=False)+'\n')
def source(file,url,**extra):return dict(url=url,sha256=hashlib.sha256(Path(file).read_bytes()).hexdigest(),**extra)
manifest=dict(checkedDate='2026-10-24',population=source(folder/'sub-est2025.csv','https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv',vintage=2025,referenceDate='2025-07-01',release='May 2026',encoding='ISO-8859-1',selection='SUMLEV=162 and POPESTIMATE2025>=100000; exclude Gazetteer LSAD57 CDP exception from incorporated eligibility; retain exception in audit.'),coordinates=source(folder/'2025_Gaz_place_national.zip','https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip',vintage=2025,method='Join STATE+PLACE to GEOID; round INTPTLAT/INTPTLONG to 0.01 degrees. Representative internal points, not downtown centres or station coordinates.'),busDirectories=[source(folder/(b+'-directory.html'),'https://'+h+'/bus/united-states') for b,h in [('flix','www.flixbus.com'),('greyhound','www.greyhound.com')]],amtrak=source(folder/'amtrak-GTFS.zip','https://content.amtrak.com/content/gtfs/GTFS.zip',feedVersion='20261024',feedStartDate='2026-10-25',use='Stop names/URLs only, never schedules or current service availability.'),counts=dict(rawThresholdRows=343,eligibleMajorCities=342,regionalHubs=3,totalAuditRows=len(byid),additionalOperatorPlaces=len(byid)-346),busPageChecks=[{k:x[k] for k in ['cityId','operator','sourceUrl','checkedDate','status','sha256'] if k in x} for x in requests],limitations=['Public Amtrak station-page HTTP requests were blocked in this environment; bulk evidence uses the successfully downloaded official GTFS stop directory. ArcGIS returned Token Required; no bypass or paid access attempted.','No municipal boundary overlay or operating-carrier verification. All municipal/carrier fields remain pending.','No Alaska verified operator market in this snapshot. Urban Honolulu CDP is outside the incorporated-place selection; Hawaii and territories are not silently inferred served.','All verified bus-listed smaller places are eligible independent of population. Regional/Amtrak directory expansion beyond recorded evidence is incomplete; no claim every small place is complete.','Missing directory match or insufficient page evidence is unresolved, never a claim of no service.','No runtime API/network request, live schedule, fare or city-pair route generation.'])
(root/'sources.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('RECORDS',len(records),'CITIES',len(set(r['cityId'] for r in records)))
from collections import Counter
print(Counter(r['marketedOperator'] for r in records))
