# P4-21 performance follow-up: readiness vs combined, CPU ×4

Owner: Person 4. Assigned in hub issue #2 as **P4-21**. This resolves one open P4-18 question: two 10-load CPU ×4 runs of combined #26 gave mixed p95 outcomes (run 1 missed the proposed budgets at 57 ms / 317.3 ms, run 2 met them at 30 / 256.7). Those runs stay as historical evidence in [qa-combined-candidate-plan.md](qa-combined-candidate-plan.md) and `docs/qa-perf/p4-18-*.json`, unchanged.

Browser results only. Node startup and cache evidence (P4-16 in-process checks) stay separate, and functional results are reused from P4-18; there's no regression, visual or production rerun.

## Protocol (frozen before measurement)

This section was committed and pushed **before** any P4-21 load was run. Results are added below it afterwards. The protocol isn't changed after collection.

| Item | Fixed value |
| --- | --- |
| Builds | Readiness #21 **`49742e76a289f2cf5d396cc66ead01d0ab56c62f`** and combined #26 **`35ed1965be9a2641fa31a2b8e1de60e7223260a3`**. Both PR heads re-verified on GitHub on October 24, 2026. The clean P4-18 checkouts and builds are reused; their served assets are the same files P4-18 measured (readiness `index-DOTT7OlX.js` / `index-kVAFhamt.css`, combined `index-BL_X6Ku1.js` / `index-Cgcrj_ju.css`), and the harness records them again. |
| Serving | `node server/index.mjs` (production build) per checkout, both running at the same time on the same machine. Combined on `127.0.0.1:4173`, readiness on `127.0.0.1:4174` (as in P4-18). |
| Environment | macOS 15.7.7, Apple M4 (10 cores, 16 GB), Node 22.23.4, Playwright 1.64.1 with Chromium 156.0.8078.4 (headless), one browser instance for the whole run. No builds, tests or other measurement run during the sample. |
| Sample size | **50 cold loads per build, 100 scheduled in total**. Fixed; no early stopping and no extra loads. |
| Order | 50 pairs, interleaved. In each pair a seeded coin flip (`mulberry32(20261024)`, `< 0.5` → readiness first) picks which build loads first. The full schedule is written to the raw JSON. |
| Cold load | Unchanged from the `qa/p4-16-perf.cjs` cold-load section: fresh browser context (empty cache and storage), viewport 1280 × 900, CDP `Emulation.setCPUThrottlingRate` **4**, long-task `PerformanceObserver` (buffered) installed before navigation, `goto("/", commit)`, wait for the first visible `.route-card`, then 1 s settle, forced GC, `JSHeapUsedSize`. |
| Pre-step | As in the existing harness, one unscored load per build runs first to record the served assets (build identity). It isn't part of the 100. |
| Metrics | **First route card** = `performance.now()` when the first `.route-card` is visible. **Total blocking time** = Σ max(0, long-task duration − 50 ms) over long tasks observed through the 1 s settle. Also recorded: longest task, long-task count, DOMContentLoaded and heap. |
| Statistics | Per build: the full sorted distribution, min, **p50 = rank 25 of 50**, **p95 = rank 48 of 50** (nearest rank), max, and exceedance counts (TBT > 50 ms, first card > 300 ms). |
| Proposed thresholds | **CPU ×4 TBT ≤ 50 ms p95** and **first route card ≤ 300 ms p95**. These are proposals, not accepted budgets. A measured miss is reported as a miss, not automatically as an app bug. |
| Failures | Every scheduled load is reported. A load that errors or times out (Playwright's default 30 s wait) is kept as a failure with its message and ranks as +Infinity, so it counts toward p95 and as an exceedance. Slow loads are never trimmed or replaced, and there's no rerun until green. |
| Contention | 1-minute load average recorded before and after the run, with a timestamp on every load. Interleaving spreads background effects across both builds. The run is reported as **potentially contended**, and no compliance claim is made from it, if the load average is ≥ 5.0 (half the cores) at the start or end, or if a failure isn't attributable to the app (for example a browser crash). |

Command:

```sh
PORT=4173 node server/index.mjs   # in the combined checkout
PORT=4174 node server/index.mjs   # in the readiness checkout
node qa/p4-21-perf-followup.cjs http://127.0.0.1:4174 http://127.0.0.1:4173 docs/qa-perf/p4-21-followup.json
```

## Results

_Pending: added after the single pre-specified run._
