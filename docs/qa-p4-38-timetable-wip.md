# P4-38 (WIP): first QA pass on the #37 dated-transit checkpoint

Owner: Person 4 (QA). **WORK IN PROGRESS. NO PASS VERDICT.** #37 is a draft, source-gated checkpoint, not a frozen candidate. Everything below applies only to the exact SHA tested. The P4-31 matrix was run as far as a fresh checkout allows; it was not run as a release gate.

Docs/QA only. No application file was changed. No Amtrak or MTA feed data was downloaded, and no feed data is in this branch.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | #37 `feat/dated-transit-search` **`2172466828f6af258281d681e8fb4f513714234b`** (open, **draft**, "Draft: source-gated city/date timetable planner") |
| Base | #30 `feat/catalogue-helper-candidate` **`fe89f9ec5fc67bfdc779121143970684d649f143`** (open draft; its base is #26 `35ed1965be9a2641fa31a2b8e1de60e7223260a3`) |
| Protocol / oracle | P4-31 `docs/qa-p4-31-timetable-protocol.md`, P4-32 `docs/qa-p4-32-oracle-fixtures.md` (this branch's parent, `origin/feat/qa-search-plan` `ca6fbadd5f16d3f7eaa56601edd4374382859f67`) |
| Environment | macOS 15.7.7, Node v22.23.4, pnpm 11.25.0 (corepack), Python 3.9.6, Playwright 1.64.1 / Chromium 156.0.8078.4 headless. Production build served by `PORT=4185 node server/index.mjs`, **without** `server/data/timetables.json.gz` (fresh checkout). Run on 2026-10-25. |

## 1. Entry gate

| # | Gate | Result | Evidence |
| --- | --- | --- | --- |
| 1 | PR open and frozen, full head/base | **FAILED (expected): open and draft, not frozen.** Head and base match the assignment exactly. | GitHub API `pulls/37`: state `open`, draft `true`, head `2172466…`, base `feat/catalogue-helper-candidate` @ `fe89f9e…`, mergeable_state `clean`. P3 calls it "inspectable, not frozen". |
| 2a | #30 provenance | **PASSED** | #37's base SHA is #30's current head (`pulls/30` head `fe89f9e…`). The diff below is computed against that SHA. |
| 2b | #29 transfers are patch-id identical | **PASSED** | `git patch-id --stable`: `3fa52d1` = `ad713c8` = `4f87b6918fe76718e394a9bc26adb09726a1e6b4`; `dad01cf` = `54ea41c` = `b1de2be5d94d7a3b052b84670a0d4a9646502660`. Author is Juan Usme on both. #29 is still open/draft at `dad01cf` (unchanged). |
| 3 | Changed paths within P3's declared scope | **PASSED, with shared-file note** | 32 files, +3394/−63, in 4 commits (`ad713c8`, `1ab308d`, `54ea41c`, `2172466`). Paths: server API/engine/tests, `scripts/` compiler and verifiers, `server/data/` manifest and places, new scheduled pages/card/service, Search components, router/layout, `vite.config.ts`, `src/index.css`, README, `.gitignore`, `docs/dated-timetable-search.md`. **No** `JourneyPage`/`SegmentCard`/P2 files. Shared files that need coordination: `src/index.css`, `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `server/index.mjs`, `vite.config.ts`, `README.md`. |
| 4 | Snapshot manifest exists | **PASSED (partial for A1)** | `server/data/timetable-manifest.json` has the URL, `checkedAt`, SHA-256, feed version and start/end for Amtrak (`20261024`, 2026-10-25 to 2027-10-18) and LIRR (`GO202_26`, 2026-10-21 to 2026-11-08). It does **not** record the HTTP status. The compiler asserts `200` from a local `downloads.json` but doesn't write the status out. |
| 5 | No snapshot, credentials or secrets committed | **PASSED** | `.gitignore` adds `server/data/timetables.json.gz`. `git log --all -- 'server/data/timetables*'` is empty. No `gz`/`zip`/`gtfs` objects in `fe89f9e..2172466`. The largest new blob is `server/data/transit-places.json`, 150,194 B: 1,371 rows with only `id,name,state,aliases`, so no stop or timetable data. A diff grep for key/secret/token/password/bearer/`ghp_`/`sk-`/`AKIA`/private-key found only prose and a test URL `?secret=wrong`. |

## 2. Install, typecheck, build, test (fresh checkout, no artifact)

| Step | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm build` | exit 0 (`index-Bz9Sxs-q.js`, `index-Bs3pRR8d.css`, lazy `ScheduledJourneyPage-splDrzNB.js`) |
| `pnpm test` | **206/206 tests, 25/25 files**. Matches P3's report. |
| `python3 src/data/national/test_ingestion.py` | 3/3 OK. Fails with `ModuleNotFoundError` under `python3 -I` (needs the script dir on the path); not a product issue. |
| `node scripts/verify-timetables.mjs` | **NOT RUN (artifact absent)**: ENOENT `server/data/timetables.json.gz`, exit 1 |
| `node scripts/verify-timetable-host.mjs` | **NOT RUN (artifact absent)**: first plan request returns 503, so the assertion fails, exit 1 |

## 3. Open inputs resolved from code and docs

| Input | Resolution at `2172466` | Source |
| --- | --- | --- |
| **U2** API / IDs | `GET /api/transit/catalogue` → `{version,cities,feeds,limits}`. If the artifact is missing it returns `version:"catalogue-only"`, the 1,371 places with `hasTimetableStops:false`, and `feeds:[]`. `GET /api/transit/plan` takes `from`/`to` or `fromId`/`toId`, `date` YYYY-MM-DD, `time` HH:mm, `mode` (all/rail/bus/mixed), `operator` (all/AMTRAK/LIRR/SEPTA/NJ_TRANSIT/GREYHOUND/FLIXBUS), `order` (arrival/transfers), `amtrak` (0/1). Unknown or duplicate keys, or a query over 1,500 chars, get 400 `invalid-query`. `GET /api/transit/itinerary/:id`. Non-GET gets 405. Without the artifact, plan/itinerary return **503 `timetable-unavailable`**. Dated ID = `tt1-` + base64url(JSON `{v: snapshot version, fromId, toId, date, time, mode, operator, order, includeAmtrak, pick: 16-hex sha256 of legs}`), max 900 chars. It is rebuilt by re-planning with `allowPast`. Engine stop mapping: `cityStops[cityId] = ["feed:stopId"]`. | `server/timetable-api.mjs`, `server/timetable-engine.mjs` |
| U2 status codes | 400 invalid input, 404 `invalid-itinerary` / `itinerary-not-found`, **409 `stale-itinerary`**, 503 unavailable / `search-limit`. The docs say "404 invalid/stale record", which doesn't match the 409 (finding N1). | engine l.~690; docs §Checkpoint |
| **U4** past dates / DST | New searches are refused when `date` < today in the origin station's time zone (400 `past-date`). The check is **date-only**: an earlier time on today's date is accepted, and trains that have already left are returned (observation O1). A nonexistent DST local time gets 400 `nonexistent-time`. A repeated local time uses the **earlier** occurrence and adds the warning "occurs twice". Itinerary links allow past dates. All four verified by probes in `qa/p4-38-oracle.test.ts`. | engine `parse()` |
| **U5** tie-break | `order=arrival`: earliest arrival, then fewer boardings, then **later** first departure, then a stable leg digest. `order=transfers`: boardings first, then the same chain. Options that are worse on arrival, boardings and departure together are removed. Up to 5 results. | engine `run()` |
| **U8** window | Searches **forward across days** for 7 × 24 h of clock time from the requested local instant (`end = epoch + 7 days`). It also includes earlier service days so trips past 24:00 are found. The requested **date** must be inside the feed's start/end dates, otherwise the result is `date-outside-snapshot`, even if service starts within the 7 days (observation O3). | engine `instances()`, `covered()` |
| **U9** transfers | A `transfers.txt` row **replaces** the 10-minute default. Type 2 = `min_transfer_time` (a blank value means 0). Type 3 = forbidden. Type 1 = 0 s. Trip-level and route-level rules are supported, and the most specific rule wins. A same-stop change with no rule gets 600 s. A change between different stops with no rule isn't allowed, and **a type-0 row between different stops is also not allowed** (observation O2). The only cross-feed link is Amtrak NYP ↔ LIRR 237 at 900 s. | engine `transfer()` |
| **U10** fixture loading | The public export `createTimetableEngine(snapshot, { now, maxWork })` accepts an injected snapshot object. `scripts/build-timetables.py` **can't** compile a synthetic feed without app changes: it needs the two named operator ZIPs plus `downloads.json`, it checks the stop mapping against the national evidence, and it writes into `server/data/`. The fixtures were therefore fed to the engine through a QA-owned GTFS-text → snapshot adapter in the test file. **The compiler step is not covered** by the oracle results. | |
| U1 / A2 | **Still open.** P3 says written Amtrak redistribution permission is unresolved, so the snapshot is deliberately absent. | PR body, docs |
| U6 | `/` and `/search` = new timetable planner. `/demo` = original sample Search. `/itinerary/:id` = scheduled journey. `/journey/*` and `/wallet/*` are unchanged. | `src/App.tsx` |
| U7 | Committed server data: `transit-places.json` 150,194 B (28,298 B gzip -9) and the manifest 1,427 B. P3 states the local artifact is 334,842 B gzip / 2,580,068 B raw. That figure is **UNKNOWN / not verified** because the artifact isn't in the repo. | |

## 4. Oracle fixtures F1–F6 (P4-32) against the engine

Method: `qa/p4-38-oracle.test.ts`, skipped unless `P4_38=1`, run in a checkout of `2172466`. The fixture GTFS text is converted to the engine's snapshot shape: each stop becomes its own place, one feed, `America/New_York`, and feed start/end = calendar min/max. The clock is injected as 2026-10-20 12:00Z so the fixture dates aren't rejected as past. Raw output: [`qa/p4-38/p4-38-oracle-results.json`](qa/p4-38/p4-38-oracle-results.json). Command: `P4_38=1 corepack pnpm exec vitest run qa/p4-38-oracle.test.ts` → **23/23** (15 fixture queries, 1 write step, 3 U4 probes, 1 random differential, 3 observations).

| Case | Expected (P4-32, EDT) | Actual (engine, first itinerary) | Result |
| --- | --- | --- | --- |
| F1a | 09:30, T2+T3 | 2026-10-26 09:30 EDT, T2+T3 (also listed: T1 10:00, T4 11:00) | **MATCH** |
| F1b | 11:00, T4 | 11:00, T4 | **MATCH** |
| F2a | 10:00, T1+T3 (T2 missed) | 10:00, T1+T3 | **MATCH** |
| F2b | 11:15, T1+T5 (T1→T3 forbidden) | 11:15, T1+T5 | **MATCH** |
| F2c | 09:30, T1+T2 (type-2 300 s overrides default) | 09:30, T1+T2 | **MATCH** (U9 confirmed) |
| F3 | 2026-10-25 02:30 (06:30Z), T1+T2 | `2026-10-25T06:30:00.000Z`, T1@2026-10-24 + T2@2026-10-25 | **MATCH** (engine level; date display in UI NOT RUN) |
| F4a | 10:45, T2 | 10:45, T2 | **MATCH** |
| F4b | 2026-10-27 09:00, T1 | 09:00, T1 | **MATCH** |
| F4c | 10-26 10:45 T2 (forward search) *or* none | 2026-10-26 10:45, T2 | **MATCH** (U8: forward search) |
| F5 | 10:00, 1 boarding T1 | 10:00, T1 first; T2+T3 (also 10:00) second | **MATCH** |
| F6a | none (gap) | D mapped but unserved: `no-connection`. D with no stop mapping (`F6a-gap`): `coverage-gap`. No sample route in either case. | **MATCH** |
| F6b | none (needs 5 boardings) | `no-connection`, message names "four-boarding limit" | **MATCH** |
| F6c | 10:20, 4 boardings L1–L4 | 10:20, L1+L2+L3+L4 | **MATCH** |
| F6d | none (outside validity) | `date-outside-snapshot` | **MATCH** |

**14/14 P4-32 queries match** (plus the extra F6a-gap mapping). No mismatches.

**Random differential (extends G1):** 4,000 seeded random single-day networks, run against an independent brute-force round search written for QA. Half are dense (6 stops, 10 trips of 2–4 stops) and half sparse (9 stops, 16 two-stop trips). Earliest arrival and boardings were compared: **0 mismatches**. Coverage of the expected answers: 1,580 one-boarding, 475 two-boarding, 28 three-boarding, 1,917 no-route; **no 4-boarding random case** (F6c covers 4). Limits: there were no `transfers.txt` rows and no multi-day service in this check. Results: [`qa/p4-38/p4-38-random-differential.json`](qa/p4-38/p4-38-random-differential.json).

## 5. Browser (production build on :4185, no artifact)

Script: `qa/p4-38-browser-check.cjs` → **26/26 checks passed**. Raw output: [`qa/p4-38/p4-38-browser.json`](qa/p4-38/p4-38-browser.json). The 9 console errors are all the expected `503` resource loads from the plan/itinerary API.

| Area | Result | Notes |
| --- | --- | --- |
| Fresh root | PASSED | "1,371 source-backed transit places. Only 0 currently have mapped stops…". The coverage panel says "No published timetable snapshot is loaded on this checkout. Source redistribution clearance is pending." No plan request is sent before submit. |
| Submit Boston, MA → Philadelphia, PA (2026-10-26 08:00) | PASSED | URL `/?from=Boston%2C+MA&to=Philadelphia%2C+PA&date=2026-10-26&time=08%3A00&search=1`. Status: "Published timetables are unavailable on this checkout…". Empty state "We couldn't verify this search… We won't substitute sample times." **0 route cards; no sample IDs, times or fares.** Screenshot: [`fresh-search-unavailable-1280.png`](qa/p4-38/fresh-search-unavailable-1280.png). |
| Operator SEPTA filter | PASSED | Same honest unavailable state; no sample route. |
| Fake `/itinerary/tt1-…` | PASSED | "Itinerary unavailable" with retry and back links; no sample. Screenshot: [`itinerary-fake-1280.png`](qa/p4-38/itinerary-fake-1280.png). |
| Autocomplete (1,371) | PASSED | "Phil" ranks Philadelphia PA, then Philadelphia NY, Philpsburg PA, New Philadelphia OH. Typing 4 keys took 136 ms. ArrowDown+Enter selects "Philadelphia, PA". "Portland" lists ME/OR/IN. Escape closes the list. "Atlantis" shows the no-match message. |
| URL/history (J1) | PASSED | A date-only change → back restores 10-26, forward restores 10-27. Reload and a shared URL in a fresh context both restore the form and the honest state. |
| Request race (J2) | PASSED | QA-intercepted mock JSON responses, first search delayed 2.5 s. The newer reply is shown and the stale one never appears. |
| Date/time at 320/360/375/390/400 px (M1) | PASSED | Inputs are **stacked**, 172 px each. No document or input overflow at any width. "12/30/2026" and "11:45 PM" are fully visible. Screenshots: [`form-320.png`](qa/p4-38/form-320.png), [`form-390.png`](qa/p4-38/form-390.png). **KNOWN S1b (361–389 px clipping) is fixed.** |
| Privacy (K1) | PASSED | 0 third-party requests. 0 geolocation calls (instrumented). `localStorage` and `sessionStorage` are empty after the session. |
| Wording (L1) | PASSED with note | Every Google/live/realtime/fare match is a disclaimer: "Google Transit coverage is not verified", "NOT REALTIME OR TICKET INVENTORY", "Fares and live disruption data are not included", "Live data limited to labelled SEPTA snapshots". See N3. |
| Focus contrast (KNOWN F1/F1b from P4-35) | **PASSED, both fixed** | `qa/p4-38-focus-root-check.cjs` on `/` and the unchanged P4-35 script on `/demo`. All 6 controls (From, To, Date, Time, Swap, Find my way) get a **3 px `rgb(23,63,53)` outline at 11.67:1** against white. Pixels changing by ≥ 3:1 exceed the 2 px perimeter area on every control (for example, From 1,554 vs 1,080). P4-35 had measured 2.30:1 and 2.94:1. JSON: [`p4-38-focus-root.json`](qa/p4-38/p4-38-focus-root.json), [`p4-38-focus-demo.json`](qa/p4-38/p4-38-focus-demo.json). |

**Legacy suites, run against `/demo`.** These are harness adaptations, made by `qa/p4-38-demo-adapt.py`. Only the root entry URLs change (`base + "/"` → `base + "/demo"` and similar); every assertion is unchanged.

| Suite | Result |
| --- | --- |
| `qa/e2e-check.cjs` (blob `9b96228`, identical in the app repo and here) | **121/121** |
| `qa/p4-14-check.cjs` (from `origin/feat/qa-expansion` `2286ddd`) | **52/52** |
| `qa/p4-25-search-check.cjs` | **38/38** |
| `qa/p4-27-search-polish-check.cjs` | **13/16**. The 3 failures are S1 at 361/375/390 px asserting the #29 "side-by-side retained" design. #37 deliberately stacks the inputs through 400 px, and the values are visible at 166 px. **The old expectation no longer applies; this is not a defect.** |
| `qa/p4-35-search-focus-check.cjs` on `/demo` | measured, see above |

## 6. Bundle and data size (gzip -9, against a #30 `fe89f9e` build from `git archive`)

| Asset | #30 raw / gz | #37 raw / gz | Δ gz |
| --- | ---: | ---: | ---: |
| main JS `index-*.js` | 447,171 / 145,414 | 464,602 / 150,902 | **+5,488** |
| main CSS `index-*.css` | 60,386 / 13,380 | 64,249 / 14,061 | **+681** |
| new lazy `ScheduledJourneyPage-*.js` | — | 2,086 / 1,116 | +1,116 |
| All assets | 545,729 / 170,976 | 569,109 / 178,260 | **+7,284** |
| Server data committed | — | `transit-places.json` 150,194 / 28,298; manifest 1,427 / 761 | not in the client bundle |
| Timetable artifact | — | absent (P3: 334,842 gz / 2,580,068 raw) | UNKNOWN |

## 7. Findings

| ID | Sev | KNOWN/NEW | Finding |
| --- | --- | --- | --- |
| N1 | Low | NEW | A stale itinerary link returns **HTTP 409** `stale-itinerary`, but `docs/dated-timetable-search.md` says "404 invalid/stale record". No HTTP-level test covers it. Fix either the docs or the code. |
| N2 | Low | NEW | The first submit sends **two identical** `/api/transit/plan` requests; the first ends `net::ERR_ABORTED`. Nothing stale is shown (J2 passes). This is wasted server work only. |
| N3 | Low | NEW | On a fresh checkout the hero ("Search published train and connecting-bus timetables") and footer ("Published timetables + separate sample journeys") still imply timetables are loaded. The coverage panel and the result state do disclose that none are. |
| O1 | Owner decision | NEW | The past-date rule is date-only. A same-day time earlier than now is accepted and returns trains that have already left (probe at 10:00 EDT asking for 07:30). |
| O2 | Owner decision | NEW | A GTFS `transfer_type 0` row between **different** stops is treated as not allowed. This is conservative, not unsafe. Impact on the real LIRR `transfers.txt` is **UNKNOWN** (artifact absent). |
| O3 | Info | NEW | A query date before a feed's start date gets `date-outside-snapshot` even when service starts within the 7-day window. |
| O4 | Info | NEW | Options 2–5 are often the **same train on later days** (F4a/F4b/F6c). They survive the dominance filter because they depart later. It's a UX question whether that counts as "trade-offs". |
| F1/F1b, S1b | — | KNOWN → **fixed on this SHA** | Focus contrast is now 11.67:1 with a 3 px outline, and date/time no longer clip at 361–389 px. |

## PASSED / FAILED / NOT RUN / UNKNOWN

- **PASSED:** entry gates 2a/2b/3/4/5; install, typecheck, build; 206/206 tests; Python 3/3; U2/U4/U5/U8/U9/U10 resolved; **P4-32 F1–F6 14/14 match**; random differential 4,000/0 mismatches; browser 26/26; legacy `/demo` e2e 121/121, P4-14 52/52, P4-25 38/38; focus F1/F1b and M1 rechecks.
- **FAILED:** entry gate 1 (not frozen, by design). P4-27 S1 3/16 fails on a superseded expectation (not a defect). Low findings N1–N3.
- **NOT RUN (artifact absent or out of scope):** A1 HTTP-status record, A3 byte-identical rebuild, A4 tampered snapshot, A5/B/C/D/F real-feed cases, **G2 real-feed spot checks**, E1 non-Eastern origin, F4 pickup/drop-off fixture (P3 unit tests only), I1 refresh of a *real* dated link, I2 stale-version link in the browser, H2 same-place/ambiguous through the real API, F3 next-date display in the UI, `verify-timetables.mjs`, `verify-timetable-host.mjs`, O1 performance on the real snapshot, P1 devices and screen readers (P5), the compiler (`build-timetables.py`) on fixtures.
- **UNKNOWN:** A2/U1 Amtrak redistribution permission; the real artifact size, memory and cold start (U7); real LIRR type-0 transfer impact (O2).

## Blockers and owner decisions

1. **Release blocker (A2/U1):** Amtrak redistribution permission. Without it there are no dated routes on any checkout or deployment, and G2 can't run. Decision needed from the owner/team lead, plus a decision on how QA gets the artifact for G2 without redistributing it.
2. **Freeze:** full functional QA needs a frozen SHA and access to an artifact.
3. **Decisions:** O1 (same-day past times), O2 (type-0 transfers between different stops), O4 (repeated-train options), N3 (wording on a fresh checkout), and edits to shared files (`index.css`, `App.tsx`, `AppLayout.tsx`, `server/index.mjs`, `vite.config.ts`, README).
