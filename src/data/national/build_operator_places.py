import json,csv,re,unicodedata
from pathlib import Path
import argparse
from ingestion import directory_state
parser=argparse.ArgumentParser(description='Build operator-listed place inputs from saved official directories; no network calls.')
parser.add_argument('source_folder',type=Path);parser.add_argument('--output-folder',type=Path,required=True);args=parser.parse_args();root=Path(__file__).parent;folder=args.source_folder
from html.parser import HTMLParser
class Links(HTMLParser):
 def __init__(self):super().__init__();self.href=None;self.text='';self.links=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a':self.href=dict(attrs).get('href');self.text=''
 def handle_data(self,text):
  if self.href:self.text+=text
 def handle_endtag(self,tag):
  if tag=='a' and self.href:
   if ', ' in self.text and '/bus/' in self.href:self.links.append((self.text.strip(),self.href))
   self.href=None
args.output_folder.mkdir(parents=True,exist_ok=True)
for brand in ['flix','greyhound']:
 parser=Links();parser.feed((folder/(brand+'-directory.html')).read_text())
 (folder/(brand+'-links.json')).write_text(json.dumps(parser.links))

cities=json.loads((root/'candidates.json').read_text());gaz=list(csv.DictReader((folder/'2025_Gaz_place_national.txt').open(),delimiter='|'));pop={x['STATE']+x['PLACE']:x for x in csv.DictReader((folder/'sub-est2025.csv').open(encoding='latin1')) if x['SUMLEV']=='162'}
def slug(x):return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower()).strip('-')
def norm(x):return slug(x).replace('saint','st').replace('mount','mt')
def short(x):
 for suffix in [' city (balance)',' city and borough',' municipality',' city',' town',' village',' borough',' CDP']:
  if x.endswith(suffix):return x[:-len(suffix)]
 return x
gazindex={}
for item in gaz:gazindex.setdefault((item['USPS'],norm(short(item['NAME']))),[]).append(item)
states={g['USPS'] for g in gaz};allplaces={};targets=[]
for brand,host,operator in [('flix','www.flixbus.com','FLIXBUS'),('greyhound','www.greyhound.com','GREYHOUND')]:
 for label,url in json.loads((folder/(brand+'-links.json')).read_text()):
  if ', ' not in label:continue
  name,state=label.rsplit(', ',1)
  state=directory_state(state,states)
  if state is None:continue
  matches=[c for c in cities if c['state']==state and any(norm(a)==norm(name) for a in c['aliases'] if ', ' not in a)]
  if len(matches)==1:id=matches[0]['id']
  else:
   id=slug(name)+'-'+state.lower()
   if id not in allplaces:
    gg=gazindex.get((state,norm(name)),[])
    g=gg[0] if len(gg)==1 else None;p=pop.get(g['GEOID']) if g else None
    allplaces[id]=dict(id=id,name=name,state=state,censusGeoid=g['GEOID'] if g else None,censusName=g['NAME'] if g else None,geography='census-designated-place' if g and g['LSAD']=='57' else 'incorporated-place' if g else 'operator-market',latitude=round(float(g['INTPTLAT']),2) if g else None,longitude=round(float(g['INTPTLONG']),2) if g else None,aliases=list(dict.fromkeys([name,label]+([g['NAME']] if g else []))),population=int(p['POPESTIMATE2025']) if p else None,populationVintage=2025 if p else None,inclusionReason='operator-listed-place',legacyId=False)
  targets.append(dict(cityId=id,operator=operator,directoryLabel=label,sourceUrl='https://'+host+url))
# Retain a deterministic union of official directory entries, not invented places.
unique={(t['cityId'],t['operator'],t['sourceUrl']):t for t in targets};targets=list(unique.values())
(args.output_folder/'national-bus-targets.json').write_text(json.dumps(targets,indent=2));(args.output_folder/'all-operator-places.json').write_text(json.dumps(list(allplaces.values()),indent=2,ensure_ascii=False))
print('TARGETS',len(targets),'NEW PLACES',len(allplaces),'NO CENSUS MATCH',sum(c['censusGeoid'] is None for c in allplaces.values()))
