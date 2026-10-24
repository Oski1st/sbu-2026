# On-demand concept routing — integration stage

This separate feature branch preserves the expansion graph at
`21d77dd618538284d77ee48db7fc34821a04bd99` and incorporates readiness
`49742e76a289f2cf5d396cc66ead01d0ab56c62f` via a normal history-preserving merge. It changes no graph edges, city coverage,
fares, original demo values, live feed behavior or frozen QA target.

## APIs and ownership handoff

- `planTrips(origin, destination): Trip[]` resolves existing graph aliases and
  computes only the requested pair's three static concept profiles. It returns
  the two unchanged original demos for Philadelphia → Stony Brook. A national
  city listing does not create a graph edge; uncovered pairs return an empty list.
- `getTripById(id): Trip | undefined` reconstructs original IDs and exact legacy
  `east-${fromId}--${toId}--${profile}` IDs with no prior Search/cache state. Unknown,
  malformed, oversized IDs and same-city concepts return undefined. Times remain
  the existing fixed illustrative October24,2026 samples, not live schedules.
- `getConceptTrip(fromId, toId, profile)` is the lower-level single-profile API.
  It accepts only known graph IDs and the three existing profiles. It does not
  accept departure/filter inputs silently. Future variable-date/filter routing
  must explicitly version the ID/cache schema and key every affecting input.
- `getRoutingDiagnostics()` returns a frozen snapshot: datasetVersion,
  cacheVersion,cacheMaxEntries,cacheEntries,startupRouteComputations,
  routeComputations,tripCreations,totalQueries,cacheHits,evictions and per-profile
  nodes/edges. Queries count concept profile lookup calls; original hardcoded-demo
  clones do not perform graph routing. Startup computations are captured during
  module initialization separately from later calls.
- `clearRoutingCacheForTests()` and `resetRoutingDiagnosticsForTests()` are explicit
  in-process hooks. Resetting counters does not silently clear the cache; call both
  for independent trials. No global object, HTTP reset endpoint or rider logging.

The immutable graph indexes are built once. Adjacency/heap Dijkstra uses nonnegative
static concept weights, exits at destination and preserves catalogue-order ties.
Every returned path uses existing edges. It is not timetable routing, RAPTOR, A*,
or a road-network model. The bounded128-entry LRU keys dataset/cache version,
origin,destination,profile and fixed sample-start time. Returned trips are copied,
so consumer mutation cannot poison the cache. No user coordinates or live snapshots
are cached; SEPTA's expiry is untouched. Bump dataset/schema versions when inputs
change. Test hooks deliberately have no production UI or external endpoint.

## Important: remaining integration gate

**This PR stage does not claim app-wide zero eager initialization.** `demoTrips`
retains its compatibility batch export until all owners migrate existing consumers.
New direct `tripLookup` imports build zero routes at initialization. Wallet now uses
that lookup, but App still imports other legacy consumers.

P2/P1 must coordinate these changes before removing the final eager export:

1. Search: use `planTrips(origin,destination)` instead of filtering the global array.
2. Journey: use `getTripById(tripId)`; update Journey fixtures to resolve IDs explicitly.
3. TripContext: use `getTripById` for saved/URL IDs while retaining P1's concurrent
   canonical-path versus legacy-query priority fix. Do not overwrite that work.
4. Migrate the remaining shared catalogue tests; remove the batch startup call only
   after no runtime consumer relies on enumerating all trips. Preserve both original
   IDs/times and all supported deep links after reload.
5. Run the integrated build/tests/browser protocol on a newly named exact SHA.

P3 owns the routing/lookup and Wallet changes; P2 owns Search/Journey, P1 currently
owns the concurrent integration/TripContext work. No direct owner-file edits were made; the approved readiness merge preserves P1’s canonical-ID fix and its six tests.
No merge/deployment is authorized by this draft or its performance measurements.

## Correctness and reproducible measurement

Focused tests compare all24×24×3 graph paths with an independent array-Dijkstra
reference, including stable ties, disconnected, zero-weight and parallel edges.
All1,651 existing trips reconstruct byte-equivalent fields after an empty cache.
Additional tests cover original demos, malformed IDs, no fictional national routes,
zero initial engine computations, requested-only work, bounded eviction, direction/
profile separation, mutation isolation and cache hits. The independent reference
is test/benchmark-only and is not imported by the application.

From repository root, using installed dependencies:

```sh
node src/data/routing/benchmark.mjs
```

The script bundles the frozen baseline's original modules directly from Git and
compares the current isolated lookup module. It uses10 fresh Node processes per
module,200 fixed-seed pair queries twice per process, retained import heap after
explicit GC, and1,000 heap/reference path queries per process. Environment,
source digests, exact baseline SHA, graph sizes, p50/p95 and cache counters are in
`node-benchmark.json`. A pre-implementation baseline was measured before the engine
was changed; the committed harness repeats it against the same frozen revision.

These are **Node module** timings on the24-city sample, not browser/Render/phone or
nationwide route results. The candidate import is measured independently of legacy
App consumers. No synthetic graph is passed off as verified nationwide coverage.
Browser metrics, chunk sizes, long tasks and app memory require P4's coordinated
integrated target after the migration gate. Current source data contain no national
edges, so no nationwide journey performance or connectivity is claimed.
