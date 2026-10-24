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

## Integration candidate status

Candidate `feat/routing-integration` starts directly at reviewed P2 consumer head
`e24b794d7e231b07687bd4f17241bde7d7f77976`, containing engine
`05dbaa31d981dca20fbae9b5f300b62b044765cf` and readiness
`49742e76a289f2cf5d396cc66ead01d0ab56c62f`. Source PR heads are not moved.
Search uses planTrips; Journey, Wallet and TripContext use getTripById. The final
production eager call is removed; demoTrips keeps its named export and original two
samples. Exhaustive legacy arrays are explicitly constructed only in owned tests.
Cold App/data import regression asserts zero routing/trip creation/cache entries.
Expanded IDs reconstruct independently of Search, selection or a populated cache.

Initial candidate run:73/78 passed; five pre-existing Journey fixture lookups still
used demoTrips.find for east IDs. P2 owns that two-file fixture correction and will
supply a separate unchanged patch. No assertions are weakened. Candidate build and
two startup checks pass. Final integrated test totals/patch SHA will be recorded
in the coordination report after actual full checks; this paragraph preserves the
initial failure evidence. Do not treat the initial candidate as a green QA target.

No direct Search/Journey/TripContext owner-file edits by P3. P1's canonical-path
priority and its tests remain preserved. No merge/deployment or production claim.
The prior engine-stage Node benchmark remains an isolated-module measurement,
not a browser performance measurement of this integration candidate.

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
