import csv,json,re,unicodedata,hashlib,zipfile
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Rebuild frozen Census candidate snapshot; no network access.')
parser.add_argument('population_csv',type=Path);parser.add_argument('gazetteer_zip',type=Path);parser.add_argument('--output',type=Path,default=Path(__file__).parent/'candidates.json')
args=parser.parse_args();root=args.output.parent
manifest=json.loads((Path(__file__).parent/'sources.json').read_text())
for file,source in [(args.population_csv,manifest['population']),(args.gazetteer_zip,manifest['coordinates'])]:
 if hashlib.sha256(file.read_bytes()).hexdigest()!=source['sha256']:
  raise SystemExit('Source hash differs from frozen manifest: '+str(file))
r=list(csv.DictReader(args.population_csv.open(encoding='latin1')));archive=zipfile.ZipFile(args.gazetteer_zip); import io
g={x['GEOID']:x for x in csv.DictReader(io.StringIO(archive.read(archive.namelist()[0]).decode()),delimiter='|')}
pop={x['STATE']+x['PLACE']:x for x in r if x['SUMLEV']=='162'}
legacy=[('portland','Portland','ME'),('boston','Boston','MA'),('providence','Providence','RI'),('hartford','Hartford','CT'),('new-haven','New Haven','CT'),('albany','Albany','NY'),('new-york','New York','NY'),('stony-brook','Stony Brook','NY'),('trenton','Trenton','NJ'),('philadelphia','Philadelphia','PA'),('baltimore','Baltimore','MD'),('washington','Washington','DC'),('richmond','Richmond','VA'),('norfolk','Norfolk','VA'),('raleigh','Raleigh','NC'),('charlotte','Charlotte','NC'),('fayetteville','Fayetteville','NC'),('charleston','Charleston','SC'),('savannah','Savannah','GA'),('jacksonville','Jacksonville','FL'),('orlando','Orlando','FL'),('tampa','Tampa','FL'),('fort-lauderdale','Fort Lauderdale','FL'),('miami','Miami','FL')]
def slug(x):return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower()).strip('-')
def short(x):
 for term in [' unified government (balance)',' consolidated government (balance)',' metropolitan government (balance)',' metro government (balance)',' city (balance)',' city and borough',' municipality',' city',' town',' village',' borough',' CDP']:
  if x.endswith(term):return x[:-len(term)]
 return x
selected={x['STATE']+x['PLACE'] for x in r if x['SUMLEV']=='162' and int(x['POPESTIMATE2025'])>=100000}
legacyids={}
for id,name,state in legacy:
 a=[x for x in g.values() if x['USPS']==state and short(x['NAME'])==name]
 assert len(a)==1,(name,a)
 selected.add(a[0]['GEOID']);legacyids[a[0]['GEOID']]=id
cities=[]
for geoid in sorted(selected):
 x=g[geoid];p=pop.get(geoid);name={'1303440':'Athens','1304204':'Augusta','2148006':'Louisville','4752006':'Nashville'}.get(geoid,short(x['NAME']));state=x['USPS'];v=int(p['POPESTIMATE2025']) if p else None
 # Census includes Urban Honolulu as a special exception, not an incorporated place.
 excluded=x['LSAD']=='57' and v is not None and v>=100000
 id=legacyids.get(geoid,f'{slug(name)}-{state.lower()}')
 aliases=[name,f'{name}, {state}',x['NAME']]
 special={'new-york':['NYC','New York City'],'philadelphia':['Philly'],'washington':['DC','Washington, DC','Washington D.C.'],'stony-brook':['Long Island'],'portland':['Portland Maine','Portland ME']}
 aliases+=special.get(id,[])
 cities.append(dict(id=id,name='Washington, DC' if id=='washington' else name,state=state,censusGeoid=geoid,censusName=x['NAME'],geography='census-designated-place' if x['LSAD']=='57' else 'consolidated-balance' if '(balance)' in x['NAME'] else 'incorporated-place',latitude=round(float(x['INTPTLAT']),2),longitude=round(float(x['INTPTLONG']),2),aliases=list(dict.fromkeys(aliases)),population=v,populationVintage=2025 if v is not None else None,inclusionReason='excluded-non-incorporated' if excluded else 'population-100000' if v and v>=100000 else 'regional-hub',legacyId=id in [i[0] for i in legacy]))
root.mkdir(exist_ok=True,parents=True);args.output.write_text(json.dumps(cities,indent=2,ensure_ascii=False)+'\n')
print('TOTAL',len(cities),'POP',sum(x['inclusionReason']=='population-100000' for x in cities),'EXCLUDED',sum(x['inclusionReason'].startswith('excluded') for x in cities),'HUBS',sum(x['inclusionReason']=='regional-hub' for x in cities))
