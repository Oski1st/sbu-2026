import json,re,hashlib,concurrent.futures,subprocess
from pathlib import Path
from datetime import datetime,timezone
import argparse
parser=argparse.ArgumentParser(description='Manually audit official bus city URLs with TLS-verifying curl; never imported by the app.')
parser.add_argument('targets',type=Path);parser.add_argument('output_folder',type=Path);args=parser.parse_args()
cache=args.output_folder/'national-bus-cache';cache.mkdir(exist_ok=True,parents=True)
items=json.loads(args.targets.read_text())
def check(item):
 path=cache/(item['operator']+'-'+item['cityId']+'.json')
 if path.exists() and json.loads(path.read_text()).get('sourceUrl') != item['sourceUrl']:
  path=path.with_name(path.stem+'-'+hashlib.sha256(item['sourceUrl'].encode()).hexdigest()[:10]+'.json')
 if path.exists():return json.loads(path.read_text())
 out={**item,'checkedDate':datetime.now(timezone.utc).date().isoformat()}
 try:
  page=path.with_suffix('.html')
  response=subprocess.run(['curl','-L','--fail','--silent','--show-error','--max-time','20',item['sourceUrl'],'-o',str(page),'-w','%{http_code} %{url_effective}'],capture_output=True,text=True,check=True)
  code,final=response.stdout.split(' ',1);code=int(code);raw=page.read_bytes()
  html=raw.decode();stops=[]
  for script in re.findall(r'<script[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>',html,re.S):
   try:data=json.loads(script)
   except ValueError:continue
   for node in data.get('@graph',[]) if isinstance(data,dict) else []:
    if node.get('@type')=='BusStop':
     address=node.get('address',{});geo=node.get('geo',{})
     stops.append({'name':node.get('name',''),'address':address.get('streetAddress',''),'reportedLocality':address.get('addressLocality',''),'postalCode':address.get('postalCode',''),'latitude':geo.get('latitude'),'longitude':geo.get('longitude')})
  out.update(httpStatus=code,finalUrl=final,sha256=hashlib.sha256(raw).hexdigest(),stops=stops,status='verified' if stops and final==item['sourceUrl'] else 'pending')
 except Exception as e:out.update(status='pending',error=type(e).__name__+': '+str(e)[:120],stops=[])
 path.write_text(json.dumps(out,indent=2));return out
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 results=[]
 for i,r in enumerate(pool.map(check,items)):
  results.append(r)
  if (i+1)%40==0:print(i+1,'/',len(items),flush=True)
(args.output_folder/'national-bus-evidence.json').write_text(json.dumps(results,indent=2))
print('COMPLETE',len(results),'verified',sum(x['status']=='verified' for x in results),flush=True)
