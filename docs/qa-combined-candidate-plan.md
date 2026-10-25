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
5. **Bundle budget conflict:** the proposed C3 budget (≤ readiness + 5 KB gzip) can't hold with the map's bundled geography (~+39 KB). Either the budget is revised for the map or the geography is lazy-loaded. That's a decision for Persons 1 / 2 / 3, not a QA failure.

## When the target arrives

1. ACK the target (already ACKed for preparation; results are reported under P4-18).
2. Clean checkout of the exact SHA and the ancestry check above. Then K8, K1–K7 and the performance re-run, serving on port 4173.
3. Record results in a new section of this file (or a separate results file) on PR #18, with full SHA, commands, totals, screenshots and blockers. Then post one report in hub #2.
