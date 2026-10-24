// Explicit Node benchmark, never imported by the app. Uses installed esbuild only.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd(), require = createRequire(import.meta.url);
const { build } = require(require.resolve('esbuild', { paths: [require.resolve('vite')] }));
const baselineSha = '21d77dd618538284d77ee48db7fc34821a04bd99';
const folder = mkdtempSync(join(tmpdir(), 'oneline-routing-'));
const common = { bundle: true, format: 'esm', platform: 'node', target: 'es2022', logLevel: 'silent' };
const percentile = (xs, p) => [...xs].sort((a,b) => a-b)[Math.ceil(xs.length*p)-1];
const stats = xs => ({ p50: percentile(xs,.5), p95: percentile(xs,.95) });
try {
  const original = join(folder,'original.mjs'), candidate = join(folder,'candidate.mjs');
  const entry = { contents: 'export { demoTrips } from "./src/data/demoTrips"; export { findTrips } from "./src/data/tripUtils"; export { cities } from "./src/data/eastCoast";', resolveDir: root };
  await build({ ...common, stdin: entry, outfile: original, plugins: [{ name: 'frozen-baseline', setup(builder) {
    builder.onLoad({ filter: /src\/data\/(demoTrips|eastCoast|tripUtils)\.ts$/ }, args => ({
      contents: execFileSync('git',['show',`${baselineSha}:${args.path.slice(root.length+1)}`],{encoding:'utf8'}), loader:'ts', resolveDir:resolve(args.path,'..'),
    }));
  }}] });
  await build({ ...common, stdin: { contents: 'export * from "./src/data/tripLookup"; export { cities, getConceptEdges } from "./src/data/eastCoast"; export { createGraph } from "./src/data/routing/graph"; export { reference } from "./src/data/routing/reference";', resolveDir: root }, outfile: candidate });
  const child = `
    global.gc();const before=process.memoryUsage().heapUsed,t=performance.now();
    const m=await import(process.argv[1]);const init=performance.now()-t;global.gc();
    const heap=process.memoryUsage().heapUsed-before;let seed=20261024;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
    const cases=Array.from({length:200},()=>{const a=random()%24;let b=random()%23;if(b>=a)b++;return [m.cities[a].name,m.cities[b].name]});
    const cold=[],warm=[];
    for(const values of [cold,warm])for(const [a,b] of cases){const t=performance.now();if(m.planTrips)m.planTrips(a,b);else m.findTrips(m.demoTrips,a,b);values.push(performance.now()-t)}
    const algorithms={heap:[],reference:[]};if(m.createGraph){const nodes=m.cities.map(c=>c.id),edges=m.getConceptEdges('AMTRAK'),g=m.createGraph(nodes,edges);
    for(let i=0;i<1000;i++){let a=random()%24,b=random()%23;if(b>=a)b++;let t=performance.now();g.path(nodes[a],nodes[b]);algorithms.heap.push(performance.now()-t);t=performance.now();m.reference(nodes,edges,nodes[a],nodes[b]);algorithms.reference.push(performance.now()-t)}}
    console.log(JSON.stringify({init,heap,cold,warm,trips:m.demoTrips?.length,diagnostics:m.getRoutingDiagnostics?.(),algorithms}));
  `;
  const results = {};
  for (const [name,path] of [['baseline',original],['candidate',candidate]]) {
    const runs = Array.from({length:10},()=>JSON.parse(execFileSync(process.execPath,['--expose-gc','--input-type=module','-e',child,path],{encoding:'utf8'})));
    results[name] = { coldImportMs:stats(runs.map(r=>r.init)), retainedHeapDeltaBytes:stats(runs.map(r=>r.heap)),
      firstPassQueryMs:stats(runs.flatMap(r=>r.cold)), repeatPassQueryMs:stats(runs.flatMap(r=>r.warm)),
      tripsCreatedAtBaselineImport:runs[0].trips ?? null, diagnostics:runs[0].diagnostics ?? null,
      heapPathMs:runs[0].algorithms.heap.length ? stats(runs.flatMap(r=>r.algorithms.heap)) : null,
      arrayReferencePathMs:runs[0].algorithms.reference.length ? stats(runs.flatMap(r=>r.algorithms.reference)) : null };
  }
  const files=['src/data/tripLookup.ts','src/data/routing/graph.ts','src/data/eastCoast.ts','src/data/originalDemoTrips.ts'];
  const output={baselineSha,checkedDate:'2026-10-24',environment:{node:process.version,v8:process.versions.v8,os:platform(),release:release(),cpu:cpus()[0].model},
    protocol:'10 fresh Node processes per module; fixed seed20261024,200 pair queries twice/process; retained import heap after explicit GC;1000 heap/reference graph queries/process. Not browser or production timings. Candidate isolated module only: legacy app eager consumers remain pending migration.',
    sourceHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),results};
  const target=process.argv[2] ?? 'src/data/routing/node-benchmark.json';writeFileSync(target,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
} finally { rmSync(folder,{recursive:true,force:true}); }
