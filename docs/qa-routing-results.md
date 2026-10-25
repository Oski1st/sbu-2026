# On-demand routing QA results (P4-16)

Owner: Person 4. Feature owner: Person 3 (draft PR #25, `feat/routing-integration` → `feat/demo-readiness`). Protocol: section **C** and the instrumentation hook in [qa-nationwide-coverage-plan.md](qa-nationwide-coverage-plan.md).

These are **future-feature PR results**, separate from the #21 release evidence (PR #12) and from the national-map results ([qa-national-map-results.md](qa-national-map-results.md)). Nothing here is a `main` or production result.

## Targets

| Role | Commit | Contents |
| --- | --- | --- |
| **Candidate** | **`c0ff3e47a60a2e5ec91ecffee4d7fcec0fc8c13f`** (`feat/routing-integration`, #25) | readiness `49742e7` + engine #23 `05dbaa3` + consumers #24 `e24b794` + fixture fix `3438578` + eager-removal / startup tests. Ancestry verified. |
| **Baseline** | `49742e76a289f2cf5d396cc66ead01d0ab56c62f` (readiness #21) | Eager: every city pair × 3 profiles built at module load |

Environment: macOS 15.7.7, Apple M4 (10 cores, 16 GB), Node 22.23.4, pnpm 11.25.0, Playwright 1.64.1 with Chromium 156.0.8078.4. Both builds served by `node server/index.mjs` (production build) on the same machine at the same time: candidate on 4173, baseline on 4174. Run on October 24, 2026.

Dataset: 24 cities. Graph per profile: AMTRAK 24 nodes / 46 edges, GREYHOUND 24 / 48, FLIXBUS 24 / 48. 1,651 trips in total (2 original + 1,649 `east-…`). No national graph exists, and no synthetic graph was used.

## Correctness and regression on the candidate (browser)

| Check | Command | Result |
| --- | --- | --- |
| Install, build, typecheck | `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck` | Pass |
| Unit tests | `pnpm test` | **80 / 80** (15 files). With the P4-16 QA specs present but not enabled: 80 passed, 7 skipped. |
| Regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121**, including SEPTA success / unavailable / empty / **stale (60 s expiry) and Refresh**, so expiry is unchanged |
| Canonical route IDs | `node qa/p4-14-check.cjs <url>` | **52 / 52** |
| Expansion suite (aliases, invalid IDs, fresh-browser deep links, refresh, reverse, overnight, filters) | `node qa/expansion-check.cjs <url>` | **122 / 122** |
| Map and coach (#21 map, X1–X6, coach guidance, guided flows, motion) | `node qa/p4-09-check.cjs <url>` | **69 / 69** |
| Proxy outage / deploy smoke | `node qa/septa-proxy-outage.mjs` / `node qa/smoke.mjs` (LAN IP) | 5 / 5 / 6 / 6 |
| Demo rehearsal | online / `--offline` | 8 / 8 / 8 / 8 |

## In-process checks (Node / vitest module import, not browser)

`qa/p4-16-routing.test.ts`, run inside the candidate checkout with `P4_16_BASELINE_IN` pointing to the baseline dump made by `qa/p4-16-baseline-dump.test.ts` in the baseline checkout. Both are skipped unless their variable is set. **6 / 6 pass.**

| Check | Result |
| --- | --- |
| **Startup work** | Cold import of `App`, `demoTrips` and `tripLookup`: `getRoutingDiagnostics()` shows `startupRouteComputations 0`, `routeComputations 0`, `tripCreations 0`, `cacheEntries 0`, `totalQueries 0`. `demoTrips` exports exactly `regional-connection`, `amtrak-connection`. **Verdict: initialization no longer generates all city pairs.** |
| **Equivalence with baseline** | **All 1,651 baseline trips** (the eager list exported by `49742e7`) are reproduced **byte-for-byte** (JSON-equal) by `getTripById(id)` after an empty cache: **0 mismatches**. This is independent of Person 3's own equivalence test, which compares against the candidate's builder. |
| Original demo exports / times | Golden IDs, durations (315, 250) and every leg time unchanged (covered by the equivalence above and the browser regression) |
| **Cache bounds and eviction** | 153 distinct trips → `cacheEntries 128` (= `ROUTING_CACHE_MAX_ENTRIES`), `evictions 25`. The most recent entry is a hit (no new computation); the first entry was evicted and recomputes. |
| **Cache copy isolation** | Mutating a returned trip (leg field, duration, legs array) doesn't change the next result, which still equals the baseline trip |
| Version keys | Every cache key starts `[ROUTING_DATASET_VERSION, ROUTING_CACHE_VERSION, …]` (source assertion). Runtime invalidation by changing the version **isn't testable** without a version-override hook. The constants are module-level, so a version change happens only with a new build, which also starts with an empty in-memory cache. |
| Direction / profile separation | Boston→New York, New York→Boston and Boston→New York (Greyhound) are three distinct entries with correct origins and operators |
| Invalid IDs | `bogus`, unknown city, same city, missing profile, unknown profile, 200+ character ID, empty, `null` and the reserved Philadelphia→Stony Brook `east-` ID all return `undefined` |
| Aliases | `planTrips('NYC','DC')` → three New York→Washington concepts; `planTrips('Philly','Long Island')` → the two original demos; unknown and same city → `[]` |
| No eager call in production source | `buildEastCoastTrips(` isn't called in `demoTrips`, `tripLookup`, `SearchPage`, `JourneyPage`, `WalletPage`, `TripContext` or `App` (it remains exported for tests only) |
| No global or endpoint | Diagnostics and reset hooks are module exports only (names are minified away in the production bundle). In the browser, on `/`, an `east-` Journey and a Wallet page, the only non-platform global is React Router's `__reactRouterVersion`; no routing, diagnostic or cache global exists. `/api/routing`, `/api/routing/reset` and `/api/diagnostics` return 404, and the `server/` diff against the baseline is empty. |

Person 3's own isolated Node benchmark (`node src/data/routing/benchmark.mjs`, Node-only, not browser) reports heap-Dijkstra path p50 0.0015 ms / p95 0.0026 ms against the array reference at 0.0045 / 0.0255 ms. It's quoted as Person 3's measurement, not mine.

## Browser measurements: baseline `49742e7` vs candidate `c0ff3e4` (same protocol)

Script: `node qa/p4-16-perf.cjs <label> <url> <out.json>`. Raw output: [baseline](qa-perf/p4-16-baseline-49742e7.json), [candidate](qa-perf/p4-16-candidate-c0ff3e4.json). Cold loads: 10 fresh contexts each, per CPU rate (CDP throttling). Heap: `JSHeapUsedSize` after a forced GC. Search: seed **20261024**, 200 cases over 28 inputs (24 cities, 3 aliases, 1 unknown city), run twice in one page.

| Metric (p50 / p95) | Baseline `49742e7` | Candidate `c0ff3e4` |
| --- | --- | --- |
| JS + CSS loaded on `/`: raw / gzip / brotli (bytes) | 386,161 / 118,765 / 102,145 | 387,979 / 119,496 / 102,973 (**+731 gzip**) |
| CPU ×1: first route card visible (ms) | 108.1 / 109.1 | **71.0 / 72.8** |
| CPU ×1: DOMContentLoaded (ms) | 42.9 / 44.4 | **19.2 / 19.5** |
| CPU ×1: long tasks / total blocking (ms) | 0 / 0 | 0 / 0 |
| CPU ×1: heap after load (MB) | 4.35 / 4.35 | **3.58 / 3.59** |
| CPU ×4: first route card visible (ms) | 407.3 / 410.5 | **255.5 / 269.9** |
| CPU ×4: DOMContentLoaded (ms) | 152.9 / 154.7 | **60.6 / 61.8** |
| CPU ×4: long tasks (count) | 2 / 2 | **1 / 1** |
| CPU ×4: longest task (ms) | 123 / 126 | **79 / 88** |
| CPU ×4: total blocking time (ms) | 130 / 134 | **29 / 38** |
| CPU ×4: heap after load (MB) | 4.37 / 4.37 | **3.60 / 3.61** |
| Search, first time per pair in the page (ms) | 49.9 / 51.4 | 33.3 / 34.8 |
| Search, same sequence again (ms) | 50.0 / 50.9 | 33.3 / 35.3 |
| Heap after 400 searches (MB) | 5.90 | 5.22 |
| Cold deep link, Journey content visible (ms, wall clock) | 846 / 847 | 820 / 825 |
| Cold deep link, Wallet tickets visible (ms, wall clock) | 845 / 847 | 821 / 824 |
| Autocomplete | n/a: no app autocomplete in either build | n/a |

How to read this honestly:

- **Startup is the real, measured difference.** Under 4× CPU throttling the baseline spends about 100 ms more blocking the main thread at load (total blocking time 130 → 29 ms, longest task 123 → 79 ms) and shows its first route card about 150 ms later, consistent with removing the all-pairs build. At ×1 neither build has a task over 50 ms.
- **Search latency is frame-quantised.** The timing includes two animation frames, so values cluster at about 33 ms (2 frames) and about 50 ms (3 frames). The candidate settles one frame sooner; the underlying compute difference is below frame resolution and isn't claimed as a speed-up. Pass 1 vs pass 2 shows no measurable cache-hit difference at this resolution.
- **Cold deep links** are about 0.8 s wall clock in both, dominated by page load. All 6 deep-linked IDs (2 original, 4 `east-`) render with no saved selection or warm cache.
- Bundle size is essentially unchanged (+731 bytes gzip).
- No comparison with Google, Apple or other routing systems is made or implied.

### Proposed budgets (from the measured baseline; for agreement with Persons 2 and 3)

| Metric | Proposed budget | Candidate |
| --- | --- | --- |
| C1 startup route computations / trip creations | **0** at import (pass / fail) | 0 / 0 ✓ |
| C2 CPU ×4 total blocking time at load | ≤ 50 ms p95 | 38 ✓ |
| C2 CPU ×4 first route card | ≤ 300 ms p95 | 269.9 ✓ |
| C3 JS + CSS on `/` gzip | ≤ baseline + 5 KB (≤ 123,885 bytes) | 119,496 ✓ |
| C4 heap after 400 searches | ≤ 8 MB, and no growth beyond the 128-entry cache | 5.22 ✓ |
| C5 search click-to-update | ≤ 3 frames (≤ 55 ms p95) at ×1 | 35.3 ✓ |
| C7 / C8 correctness / deep links | 0 mismatches against baseline; all IDs reconstruct cold | 0; 6 / 6 ✓ |

These are proposals until Persons 2 and 3 agree.

## Verdict

**No QA blockers for #25 at `c0ff3e4`.** Startup routing is eliminated (0 computations at import) and every baseline trip is reproduced exactly. The cache is bounded, isolated and correctly keyed, SEPTA expiry is unchanged, and all regression suites pass. Measured load-time blocking under CPU throttling drops substantially.

Limitations stated plainly:

- Version invalidation isn't runtime-testable without an override hook.
- The search-latency method can't resolve differences below one frame.
- The Node-import results are separate from the browser results.
