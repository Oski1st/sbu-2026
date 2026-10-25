# Combined feature candidate: QA plan (P4-18)

Owner: Person 4. Candidate owner: Person 3 (new isolated combined branch, not yet published).

**Status: preparation only. No combined target is assigned.** Nothing here has been run against a combined candidate. Results will be recorded only after the coordinator posts the pushed branch, PR and full SHA as the P4-18 target in hub issue #2. Release evidence for readiness #21 stays in PR #12. Source-branch evidence stays in [qa-routing-results.md](qa-routing-results.md) (P4-16) and [qa-national-map-results.md](qa-national-map-results.md) (P4-15 / P4-17).

## Provenance

| Part | Verified head | Evidence |
| --- | --- | --- |
| Readiness #21 (base) | `49742e76a289f2cf5d396cc66ead01d0ab56c62f` | PR #12, P4-14: 121 / 52 / 69 / 122, accepted |
| Routing #25 | `c0ff3e47a60a2e5ec91ecffee4d7fcec0fc8c13f` | P4-16: 6 / 6 in-process, 1,651 trips identical, CPU ×4 total blocking 130 → 29 ms |
| National map #22 | `7ff27bf114a25f3355790c7b17b5828ebeafe348` | P4-17: map 69 / 69, X7 / X8 / X9 resolved |

First step on the target: confirm with `git merge-base --is-ancestor` that the candidate contains all three heads, and list any extra commits. Extra application commits get a focused review before the suites run.

## What can only go wrong when they're combined

| # | Risk | Why it's new | Check (reused) |
| --- | --- | --- | --- |
| K1 | Eager startup creeps back | The map and routing both touch `SearchPage` / data imports | `qa/p4-16-routing.test.ts` (cold import of `App`: 0 startup route computations and trip creations) plus a source grep for `buildEastCoastTrips(` in production files |
| K2 | Cold canonical Journey / Wallet links | Routing's `getTripById` meets the readiness canonical-ID fix and the map's Search changes | `qa/p4-14-check.cjs` (52), `qa/expansion-check.cjs` E1 / E2 / E3, and the cold deep-link section of `qa/p4-16-perf.cjs` |
| K3 | Lookup equivalence | Merge resolution in `demoTrips` / `tripLookup` | `qa/p4-16-routing.test.ts`: all 1,651 baseline trips from `49742e7` byte-identical (the baseline dump is reused, not regenerated) |
| K4 | Search / Compare interplay | The map replaces the hero beside the search form; routing replaces `findTrips` | `qa/e2e-check.cjs` (Compare dialog, keyboard, 320 / 390), `qa/expansion-check.cjs` C1–C7, D1–D5, F1–F4, and the X2 search persistence / history checks in `qa/p4-09-check.cjs` |
| K5 | Map readability, orientation and network | CSS and layout merges | `qa/p4-15-map-check.cjs` with the candidate's own `src/data/usOverviewMap.json` (69 checks: geometry, AK / HI / Florida, ≥ 10 / 11px, disclosure, accessibility, no external requests) |
| K6 | Original demo and SEPTA expiry | Shared files | `qa/demo-rehearsal.cjs` online and `--offline`; `qa/e2e-check.cjs` SEPTA success / unavailable / empty / stale / Refresh; golden times in K3 |
| K7 | Cache behaviour | Routing cache with the map's added queries | `qa/p4-16-routing.test.ts` bounds, eviction, copy isolation, keys, invalid IDs, aliases |
| K8 | Build health | Merge correctness | `pnpm install --frozen-lockfile`, `build`, `typecheck`, `test` (expect at least 73 + routing's tests; report the actual count), `qa/smoke.mjs`, `qa/septa-proxy-outage.mjs` |

**Performance (C2–C6):** the combined bundle carries the map's roughly 38 KB gzip, which changes P4-16's bundle conclusion. So `qa/p4-16-perf.cjs` will be re-run on the same machine and protocol (seed 20261024) against readiness `49742e7` and the candidate, and the routing-only head `c0ff3e4` as a reference point. Browser and Node results stay separate; no speed-up is claimed beyond what's measured.

## Instrumentation gaps (known before running)

1. **`qa/p4-09-check.cjs` map section doesn't apply.** It targets the East-Coast map (`.east-map`), which the national map replaces. On P4-15 it ran its 32 non-map checks and then stopped at the map section. On the combined target I'll report those non-map checks and mark the map section as superseded by `qa/p4-15-map-check.cjs`, not as passed or failed.
2. **Cache version invalidation** (plan F3) still can't be tested at runtime without a version-override hook. It's covered only by a source assertion and the fact that a new build starts with an empty cache.
3. **Search latency is frame-quantised** (two-frame method), so differences under one frame aren't resolvable.
4. **No national graph or catalogue** in the candidate (as scoped), so national performance, coverage and search cases (plan sections A / B / E for national data) remain out of scope.
5. **Bundle budget conflict:** resolved by Person 1. See the decisions below: the routing-only comparison is kept, and combined ≤ map-only + 5 KB gzip is the provisional regression check.

## Decisions from Person 1 (hub #2, comment 6392047036)

- **Results location:** PR #18, in a distinct "Combined results" section naming the exact target. No separate QA PR.
- **Bundle accounting** (gap 5 resolved for this candidate). Measure all four builds with the **same** method: `qa/p4-16-perf.cjs` "JS + CSS loaded on `/`" totals (raw / `gzip -9` / brotli), plus main-JS `gzip -9`, built and served identically.

  | Build | Head |
  | --- | --- |
  | Readiness | `49742e7` |
  | Routing-only | `c0ff3e4` |
  | Map-only | `7ff27bf` |
  | Combined | target SHA |

  - The original **readiness + 5 KB gzip** proposal stays a **routing-only** comparison. It is not applied to the geography-inclusive candidate and is never marked passing for it.
  - **Provisional integration-regression check: combined ≤ map-only + 5 KB gzip.** It doesn't approve a total release budget.
  - Report separately: the **map contribution** (map-only − readiness), **combined − map-only**, and the **total increase over readiness**, stated plainly for review.
  - Lazy-loading the geography is a possible follow-up, not a change to this frozen candidate.
- **Latency and heap budgets** stay proposals. They're reported with actual results and never adjusted to fit.
- **Old East-Coast map section:** marked superseded, with its non-map assertions and historical results kept. The national-map harness covers current geography. The build-constant invalidation and frame-quantised search limits stay stated.

## When the target arrives

1. ACK the target (already ACKed for preparation; results are reported under P4-18).
2. Clean checkout of the exact SHA and the ancestry check above. Then K8, K1–K7 and the performance re-run, serving on port 4173.
3. Record results in a new section of this file (or a separate results file) on PR #18, with full SHA, commands, totals, screenshots and blockers. Then post one report in hub #2.

## Combined results: `35ed196` (P4-18)

**Target:** `35ed1965be9a2641fa31a2b8e1de60e7223260a3` on `feat/map-routing-candidate` (draft PR #26 → `feat/demo-readiness`). Run on October 24, 2026 from a clean checkout. Toolchain: macOS 15.7.7, Apple M4, Node 22.23.4, pnpm 11.25.0, Playwright 1.64.1, Chromium 156.0.8078.4. Served by `node server/index.mjs` on port 4173. These are future-feature PR results, not `main` or production.

**Ancestry and merge integrity:**

- `35ed196` is a merge commit with parents routing `c0ff3e4` and map `7ff27bf`, and it contains readiness `49742e7`.
- The two sides change **no files in common**: the map side brings 6 files, the routing side 24. Every file in the merge is identical to one of its parents, so **there are no manual resolutions**, independently confirming Person 3's report.

| Check | Command | Result on `35ed196` |
| --- | --- | --- |
| K8 build, typecheck | `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck` | Pass |
| K8 unit | `pnpm test` | **85 / 85** (16 files) |
| K4 / K6 regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121**, including the SEPTA success / unavailable / empty / **stale (60 s) and Refresh** states |
| K2 canonical route IDs | `node qa/p4-14-check.cjs <url>` | **52 / 52**: path wins over a conflicting `?trip=`; legacy entry works; invalid IDs never substitute |
| K2 / K4 expansion suite | `node qa/expansion-check.cjs <url>` | **122 / 122**, including fresh-browser deep links, refresh, aliases, invalid IDs, filters and 320 / 390 |
| K5 national map | `node qa/p4-15-map-check.cjs <url> <shots> src/data/usOverviewMap.json` | **69 / 69**: north-up, Florida, Alaska / Aleutians, Hawaii, ≥ 10 / 11px, disclosure, accessibility, no external requests |
| K4 search persistence, coach, guided flows, motion | `node qa/p4-09-check.cjs <url>` | **32 / 32 non-map checks pass.** The East-Coast map section is **superseded** (`.east-map` no longer exists; current geography is covered by K5). Historical results stay in `qa-expansion-plan.md`. |
| K1 / K3 / K7 startup, equivalence, cache (in-process, Node / vitest, **not browser**) | `P4_16_BASELINE_IN=<49742e7 dump> pnpm exec vitest run qa/p4-16-routing.test.ts` | **6 / 6**: cold import of `App` / data / lookup gives `startupRouteComputations 0`, `routeComputations 0`, `tripCreations 0`, `cacheEntries 0`; **all 1,651 baseline trips byte-identical (0 mismatches)**; LRU bound 128 with eviction; copy isolation; version-prefixed keys; direction / profile separation; invalid IDs; aliases; no `buildEastCoastTrips(` in production source |
| K8 proxy / smoke | `node qa/septa-proxy-outage.mjs` / `node qa/smoke.mjs` (LAN IP) | 5 / 5 / 6 / 6 |
| K6 demo rehearsal | online / `--offline` | 8 / 8 / 8 / 8 |

Evidence: [national map 1280px](qa-screenshots/combined/p4-18-national-map-1280.png), [320px](qa-screenshots/combined/p4-18-national-map-320.png), [canonical Journey](qa-screenshots/combined/p4-18-journey-canonical-wins.png).

### Bundle accounting (same build, compression and measurement for all four)

JS + CSS loaded on `/` (`qa/p4-16-perf.cjs`), and main JS alone (`gzip -9`). Bytes.

| Build | Head | On `/` raw | On `/` gzip -9 | On `/` brotli | Main JS gzip -9 |
| --- | --- | --- | --- | --- | --- |
| Readiness | `49742e7` | 386,161 | **118,765** | 102,145 | 105,327 |
| Routing-only | `c0ff3e4` | 387,979 | 119,496 | 102,973 | 106,004 |
| Map-only | `7ff27bf` | 505,707 | **158,752** | 125,444 | 144,735 |
| **Combined** | `35ed196` | 507,527 | **159,425** | 126,235 | 145,434 |

- **Routing-only comparison** (readiness + 5 KB proposal; routing only, not applied to the combined build): +731 bytes gzip, within the proposal.
- **Map contribution** (map-only − readiness): **+39,987 bytes gzip** (+33.7%).
- **Combined − map-only: +673 bytes gzip.** The provisional integration-regression check (≤ map-only + 5,120 bytes) **passes**. This doesn't approve a total release size.
- **Total increase over readiness: +40,660 bytes gzip (+34.2%)**; main JS +40,107 bytes gzip. Reported for review. Lazy-loading the geography remains a possible follow-up.

### Browser performance (same protocol: 10 cold loads per CPU rate, seed 20261024, 200 search cases × 2)

p50 / p95. Two runs for the builds whose CPU ×4 results varied. Raw JSON: `docs/qa-perf/p4-18-*.json`.

| Metric | Readiness | Routing-only (run 1 / run 2) | Map-only (run 1 / run 2) | **Combined (run 1 / run 2)** |
| --- | --- | --- | --- | --- |
| CPU ×1 first route card (ms) | 106.6 / 110.2 | 70.4 / 72.3 | 106.9 / 108.2 | **70.0 / 71.0** |
| CPU ×1 long tasks / blocking | 0 / 0 | 0 / 0 | 0 / 0 | **0 / 0** |
| CPU ×1 heap after load (MB) | 4.35 | 3.58 | 4.32 | **3.67** |
| CPU ×4 total blocking (ms) | 124 / 127 | 28 / 29 · 28 / 30 | 130 / 162 · 126 / 133 | **29 / 57 · 30 / 30** |
| CPU ×4 first route card (ms) | 397.9 / 406.4 | 251.8 / 256.7 · 254.1 / 264.2 | 402.8 / 445.5 · 396.2 / 406.8 | **254.4 / 317.3 · 251.2 / 256.7** |
| CPU ×4 longest task (ms) | 120 / 122 | 78 / 79 · 78 / 80 | 123 / 133 · 122 / 124 | **79 / 104 · 80 / 80** |
| CPU ×4 heap after load (MB) | 4.37 | 3.60 | 4.34 | **3.69** |
| Search, first time / repeat (ms) | 50.0 / 51.3 · 50.0 / 51.2 | 33.4 / 35.0 · 33.4 / 34.8 | 50.0 / 51.6 · 50.0 / 51.2 | **33.4 / 34.5 · 33.3 / 34.8** |
| Heap after 400 searches (MB) | 5.88 | 5.22 | 5.96 | **5.41** |
| Cold deep link Journey / Wallet (ms, wall clock) | 844 / 844 | 820 / 821 | 844 / 844 | **820 / 821** (p50) |

How to read this:

- At p50 the combined build behaves like routing-only: the startup gain from removing the all-pairs build is kept with the map included. Compared with routing-only, the combined build uses 0.09 MB more heap at load (CPU ×1 and ×4) and 0.19 MB more after 400 searches.
- **Proposed budgets (still proposals, not adjusted):** CPU ×4 total blocking ≤ 50 ms p95 and first card ≤ 300 ms p95 were **missed in combined run 1** (57 ms, 317.3 ms), driven by one slow load of 10. They were **met in run 2** (30 ms, 256.7 ms). Map-only shows the same single-outlier variance (run 1 p95 162 vs run 2 133). Both runs are reported. Heap ≤ 8 MB is met. Search ≤ 3 frames is met.
- Search latency is frame-quantised (two-frame method); the 50 → 33 ms step is one frame and isn't claimed as a compute speed-up.
- Node-import results (K1 / K3 / K7) are separate from browser results. Cache version invalidation is still only a build-constant / source assertion.

### Verdict

**No QA blockers for #26 at `35ed196`.** K1–K8 pass. The provisional integration size check passes (+673 bytes over map-only). The total size increase over readiness (+40,660 bytes gzip) is a reported trade-off from the bundled geography. The proposed CPU ×4 p95 budgets were missed in one of two runs because of a single outlier load and are flagged for budget review, not for a fix.
