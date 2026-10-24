"""Attach explicitly qualified representative points to operator directory places.
Uses saved public-source audit files only; no network or private locations.
"""
import argparse,json,math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('source_folder',type=Path);a=p.parse_args();root=Path(__file__).parent
places=json.loads((a.source_folder/'all-operator-places.json').read_text());checks=json.loads((a.source_folder/'national-bus-evidence.json').read_text())
for c in places:
 c['coordinateSourceUrl']='https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip' if c['censusGeoid'] else None
 c['coordinateMethod']='census-internal-point' if c['censusGeoid'] else 'unavailable'
 if c['latitude'] is None:
  points=[(x,s) for x in checks if x['cityId']==c['id'] and x['status']=='verified' for s in x['stops'] if isinstance(s.get('latitude'),(int,float)) and isinstance(s.get('longitude'),(int,float)) and math.isfinite(s['latitude']) and math.isfinite(s['longitude']) and abs(s['latitude'])<=90 and abs(s['longitude'])<=180]
  if points:
   x,s=points[0];c['latitude']=round(s['latitude'],2);c['longitude']=round(s['longitude'],2);c['coordinateSourceUrl']=x['sourceUrl'];c['coordinateMethod']='operator-stop-representative'
(root/'operatorPlaces.json').write_text(json.dumps(places,indent=2,ensure_ascii=False)+'\n')
