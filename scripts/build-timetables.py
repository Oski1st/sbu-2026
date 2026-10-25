"""Compile saved official GTFS ZIPs to a deterministic, server-only timetable snapshot.
Usage: python3 scripts/build-timetables.py /path/to/downloads
No network at build/runtime; source URLs/hashes/dates come from captured downloads.json.
"""
import argparse,csv,io,json,zipfile,hashlib,gzip,math,collections
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('folder',type=Path);a=p.parse_args()
root=Path(__file__).resolve().parents[1];folder=a.folder
meta={x['name']:x for x in json.loads((folder/'downloads.json').read_text())}
national=root/'src/data/national';batch=json.loads((national/'evidence/batch1.json').read_text())
raw=json.loads((national/'candidates.json').read_text())+json.loads((national/'operatorPlaces.json').read_text())
evidence=json.loads((national/'coverage.json').read_text())+batch['coverageAdditions']
verified={x['cityId'] for x in evidence};aliases={x['cityId']:x['sameMarketAsCityId'] for x in batch['marketRelations']}
cities=[x for x in raw if x['id'] in verified and x['id'] not in aliases and x['latitude'] is not None and x['longitude'] is not None]
allcities={x['id']:x for x in raw};output={'schema':1,'feeds':[],'cities':[{k:x[k] for k in ['id','name','state','aliases']} for x in cities],'cityStops':{},'links':[]}
def seconds(value):
 if not value:return None
 parts=value.split(':')
 if len(parts)!=3:return None
 h,m,s=map(int,parts)
 return h*3600+m*60+s if 0<=h<=168 and 0<=m<60 and 0<=s<60 else None
def km(city,s):
 lat,lon=float(s['stop_lat']),float(s['stop_lon']);a=math.sin(math.radians(lat-city['latitude'])/2)**2+math.cos(math.radians(lat))*math.cos(math.radians(city['latitude']))*math.sin(math.radians(lon-city['longitude'])/2)**2
 return 6371*2*math.asin(min(1,math.sqrt(a)))
for name,operator in [('amtrak','AMTRAK'),('lirr','LIRR')]:
 m=meta[name];content=(folder/(name+'.zip')).read_bytes();assert m['exit']==0 and m['status'].startswith('200 ') and hashlib.sha256(content).hexdigest()==m['sha256']
 z=zipfile.ZipFile(io.BytesIO(content))
 def rows(file):return list(csv.DictReader(io.StringIO(z.read(file+'.txt').decode('utf-8-sig')))) if file+'.txt' in z.namelist() else []
 agencies={x['agency_id']:x for x in rows('agency')};routes={x['route_id']:x for x in rows('routes') if x['route_type'] in ['2','3']};stops=rows('stops');stopindex={x['stop_id']:x for x in stops}
 calendar=rows('calendar');exceptions=rows('calendar_dates');days=[x[k] for x in calendar for k in ['start_date','end_date']]+[x['date'] for x in exceptions];assert days
 fi=rows('feed_info')[0];tzs={x['agency_timezone'] for x in agencies.values()};assert tzs=={'America/New_York'},'New feed timezone needs review, not silent coercion'
 feed={'id':name,'operator':operator,'sourceUrl':m['url'],'sha256':m['sha256'],'checkedAt':m['checkedAt'],'version':fi.get('feed_version',''),'timezone':'America/New_York','calendarStartDate':min(days),'startDate':max(min(days),fi.get('feed_start_date') or min(days)),'endDate':min(max(days),fi.get('feed_end_date') or max(days)),'calendar':calendar,'exceptions':exceptions,'stops':{},'trips':[],'transfers':rows('transfers')}
 for s in stops:
  feed['stops'][s['stop_id']]={'name':s['stop_name'],'latitude':float(s['stop_lat']),'longitude':float(s['stop_lon']),'timezone':s.get('stop_timezone') or feed['timezone'],'url':s.get('stop_url',''),'parent':s.get('parent_station','')}
 times=collections.defaultdict(list)
 for r in rows('stop_times'):
  ar,dep=seconds(r['arrival_time']),seconds(r['departure_time'])
  if ar is not None and dep is not None:
   times[r['trip_id']].append([r['stop_id'],ar,dep,int(r.get('pickup_type') or 0),int(r.get('drop_off_type') or 0),int(r['stop_sequence'])])
 skipped=0
 for t in rows('trips'):
  route=routes.get(t['route_id']);ts=sorted(times[t['trip_id']],key=lambda x:x[-1])
  if not route or len(ts)<2 or any(x[2]<x[1] for x in ts) or any(ts[i+1][1]<ts[i][2] for i in range(len(ts)-1)):skipped+=1;continue
  ag=agencies.get(route.get('agency_id')) or next(iter(agencies.values()))
  feed['trips'].append({'id':t['trip_id'],'routeId':t['route_id'],'service':t['service_id'],'name':route.get('route_long_name') or route.get('route_short_name') or t.get('trip_headsign') or operator,'number':t.get('trip_short_name',''),'mode':'rail' if route['route_type']=='2' else 'bus','agencyName':ag['agency_name'],'stops':[x[:-1] for x in ts]})
 feed['trips'].sort(key=lambda x:x['id']);feed['skippedTrips']=skipped
 # Associate only sourced exact stop IDs/names; no nearby-city substitution or new routing edges from the catalogue.
 if name=='amtrak':
  for r in batch['modeEvidence']:
   cid=aliases.get(r['cityId'],r['cityId'])
   if cid not in {x['id'] for x in cities}:continue
   for sid in r['stopIds']:
    assert sid in stopindex
    output['cityStops'].setdefault(cid,[]).append(name+':'+sid)
 else:
  for city in cities:
   if city['state']!='NY':continue
   matches=[s for s in stops if s['stop_name'].casefold()==city['name'].casefold() and km(city,s)<20]
   if city['id']=='new-york':matches=[stopindex['237']];assert matches[0]['stop_name']=='Penn Station'
   if city['id']=='stony-brook':matches=[stopindex['14']];assert matches[0]['stop_name']=='Stony Brook'
   for s in matches:output['cityStops'].setdefault(city['id'],[]).append(name+':'+s['stop_id'])
 output['feeds'].append(feed);print(name,len(feed['trips']),'trips',len(stops),'stops','dates',feed['startDate'],feed['endDate'],'skipped',skipped)
# Explicit same Penn Station/Moynihan complex, supported by both official station identity sources.
output['links']=[{'from':'amtrak:NYP','to':'lirr:237','seconds':900,'note':'15 minute planning buffer in Penn/Moynihan complex; not an agency-guaranteed or accessibility-verified transfer.','sourceUrls':['https://www.greatamericanstations.com/stations/new-york-penn-station-ny-nyp/','https://www.mta.info/stations/penn-station']},{'from':'lirr:237','to':'amtrak:NYP','seconds':900,'note':'15 minute planning buffer in Penn/Moynihan complex; not an agency-guaranteed or accessibility-verified transfer.','sourceUrls':['https://www.greatamericanstations.com/stations/new-york-penn-station-ny-nyp/','https://www.mta.info/stations/penn-station']}]
output['cityStops']={k:sorted(set(v)) for k,v in sorted(output['cityStops'].items())}
output['limits']=['Published timetable snapshot, not realtime delays/cancellations, ticket stock or fares.','Search next7days, at most4boardings; optimal arrival only within loaded feeds and stated transfer buffers.','No verified scheduled feed loaded for SEPTA, NJ TRANSIT, Greyhound or FlixBus; their directory presence/sample routes never fill schedule gaps.','Same-station unspecified transfers use10minute planning buffer; explicit GTFS rules take precedence. No arbitrary city/station walking links.']
rawout=json.dumps(output,separators=(',',':'),ensure_ascii=False).encode();version=hashlib.sha256(rawout).hexdigest()[:16];output['version']=version
rawout=json.dumps(output,separators=(',',':'),ensure_ascii=False).encode();dest=root/'server/data/timetables.json.gz';dest.write_bytes(gzip.compress(rawout,mtime=0))
manifest={'version':version,'schema':1,'feeds':[{k:f[k] for k in ['id','operator','sourceUrl','sha256','checkedAt','version','startDate','endDate','skippedTrips']} for f in output['feeds']],'qualifiedChoices':len(cities),'placesWithTimetableStops':len(output['cityStops']),'limits':output['limits']}
(root/'server/data/timetable-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('artifact',len(rawout),'bytes',dest.stat().st_size,'gzipped','version',version,'mapped cities',len(output['cityStops']))
