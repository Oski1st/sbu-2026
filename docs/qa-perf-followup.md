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

## Results (single pre-specified run)

The protocol was committed and pushed at `80ed8854ef2889898a4d7b500fff43d3a6450a40` before this run. The run went from 02:32:27 to 02:34:47 UTC on October 25, 2026 (October 24 US Eastern). Raw JSON with the schedule, per-load timestamps, metrics and long-task lists: [`qa-perf/p4-21-followup.json`](qa-perf/p4-21-followup.json).

- **Accounting:** 100 / 100 scheduled loads completed: readiness 50 / 50, combined 50 / 50. **0 failures, 0 timeouts, 0 errors.** Nothing was trimmed, replaced or rerun, and there was only this one run.
- **Build identity:** the served assets match P4-18 exactly. Readiness serves `index-DOTT7OlX.js` + `index-kVAFhamt.css`; combined serves `index-BL_X6Ku1.js` + `index-Cgcrj_ju.css`.
- **Order:** the seeded coin put readiness first in 14 of the 50 pairs and combined first in 36. Pair 0 started with readiness.
- **Contention:** the 1-minute load average was 2.67 at the start and 1.58 at the end, below the 5.0 limit, and there were no non-app failures. The run is **not** flagged as contended. Chromium 156.0.8078.4, Node v22.23.4, Apple M4 (10 cores).

### CPU ×4 cold load, 50 per build (min / p50 / p95 / max; p95 = rank 48 of 50)

| Metric | Readiness `49742e7` | Combined `35ed196` |
| --- | --- | --- |
| **First route card (ms)** | 396.1 / 403.1 / **425.4** / 493.5 | 246.3 / 251.7 / **260.4** / 270.3 |
| **Total blocking time (ms)** | 121 / 130 / **136** / 171 | 26 / 29 / **33** / 38 |
| Longest task (ms) | 115 / 124 / 127 / 146 | 76 / 79 / 83 / 88 |
| Long tasks (count) | 2 on every load | 1 on every load |
| DOMContentLoaded (ms) | 132.1 / 153.1 / 159.2 / 176.8 | 46.9 / 59.8 / 62.0 / 62.8 |
| Heap after load (MB) | 4.36 / 4.37 / 4.37 / 4.37 | 3.68 / 3.69 / 3.69 / 3.69 |
| Exceedances: TBT > 50 ms | **50 / 50** | **0 / 50** |
| Exceedances: first card > 300 ms | **50 / 50** | **0 / 50** |
| p95 within proposed thresholds? | **No** for both (miss) | **Yes** for both |

Full sorted distributions (ms):

- **Combined TBT:** 26, 27 ×3, 28 ×9, 29 ×13, 30 ×14, 31 ×7, 33, 34, 38
- **Combined first card:** 246.3, 246.7, 246.8, 247.2, 247.2, 247.5, 248.3, 248.7, 248.7, 249.1, 249.1, 249.2, 249.4, 249.5, 249.8, 249.8, 249.9, 250.0, 250.4, 250.5, 250.8, 251.0, 251.0, 251.2, 251.7, 251.7, 251.9, 252.0, 252.0, 252.3, 252.3, 252.7, 252.9, 253.1, 253.3, 253.8, 253.8, 254.2, 254.5, 254.5, 254.6, 254.8, 256.3, 256.6, 259.0, 260.1, 260.4, 260.4, 260.8, 270.3
- **Readiness TBT:** 121, 125, 126 ×2, 127 ×9, 128 ×6, 129 ×4, 130 ×10, 131 ×4, 132 ×4, 133, 134 ×4, 136 ×2, 139, 171
- **Readiness first card:** 396.1 … 425.4 (rank 48), 430.0, 493.5. The full list is in the JSON.

### Interpretation (this sample only)

- **Combined `35ed196` meets both proposed CPU ×4 p95 thresholds in this pre-specified sample:** TBT p95 33 ms (≤ 50) and first card p95 260.4 ms (≤ 300). No load exceeded either threshold: the worst was 38 ms and 270.3 ms. This answers the open P4-18 question for this machine and protocol. The single slow load in P4-18 combined run 1 (which produced the 57 ms / 317.3 ms p95 from 10 loads) **did not recur** in 50 interleaved loads. For scale: if 1 load in 10 really exceeded, the chance of seeing 0 of 50 would be about 0.5% (0.9^50). That's an illustration, not a significance test, and the P4-18 runs stay on record unchanged.
- **Readiness `49742e7` misses both proposed thresholds on every load** (p95 136 ms / 425.4 ms). That's consistent with P4-16 and P4-18 (eager all-pairs build at startup). It's a measured miss against proposed budgets, reported as such, not a new bug claim.
- Readiness shows two long tasks per load and combined shows one, as in P4-18.
- Limits: one machine, headless Chromium with CDP CPU throttling, and a local production server. This isn't a production, real-device or network measurement. The thresholds remain **proposals**.
