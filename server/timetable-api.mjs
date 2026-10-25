import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createTimetableEngine, PlanningError } from './timetable-engine.mjs';
import { sendJson } from './septa-proxy.mjs';
let enginePromise;
export function loadTimetableEngine(){
  enginePromise??=readFile(new URL('./data/timetables.json.gz',import.meta.url)).then(raw=>createTimetableEngine(JSON.parse(gunzipSync(raw)))).catch(error=>{enginePromise=undefined;throw error;});
  return enginePromise;
}
export function createTimetableApi({getEngine=loadTimetableEngine}={}){
 return async(req,res,next=()=>{})=>{
  const url=new URL(req.url??'/','http://localhost');
  if(!['/api/transit/catalogue','/api/transit/plan'].includes(url.pathname)&&!url.pathname.startsWith('/api/transit/itinerary/'))return next();
  if(req.method!=='GET'){res.setHeader('Allow','GET');return sendJson(res,405,{error:'method_not_allowed'});}
  try{
   const engine=await getEngine();
   if(url.pathname==='/api/transit/catalogue')return sendJson(res,200,engine.metadata());
   if(url.pathname==='/api/transit/plan'){
    const allowed=new Set(['from','to','fromId','toId','date','time','mode','operator','order','amtrak']);
    for(const key of url.searchParams.keys())if(!allowed.has(key)||url.searchParams.getAll(key).length!==1)throw new PlanningError('invalid-query','Invalid or duplicate planning parameters.');
    if(url.search.length>1500)throw new PlanningError('invalid-query','Planning query too long.');
    const q=Object.fromEntries(url.searchParams);q.includeAmtrak=q.amtrak!=='0';
    return sendJson(res,200,engine.plan(q));
   }
   if(url.pathname.startsWith('/api/transit/itinerary/')){
    const id=url.pathname.slice('/api/transit/itinerary/'.length);return sendJson(res,200,engine.itinerary(id));
   }
   return sendJson(res,404,{error:'not_found'});
  }catch(error){
   if(error instanceof PlanningError)return sendJson(res,error.status,{error:error.code,message:error.message});
   return sendJson(res,503,{error:'timetable-unavailable',message:'Published timetables are unavailable. Try again or check directly with the operators.'});
  }
 };
}
