# Nationwide coverage: QA acceptance plan (P4-10, extended by P4-12)

Owner: Person 4. Catalogue: Person 3 (source-verified national city list). Search integration: Person 2. Coordination: Person 1.

**Status: plan and evidence checklist only. No nationwide application SHA has been assigned, so nothing here has been executed.** Results are recorded only against a full pushed SHA, branch and included PRs given in a later numbered P4 instruction in hub issue #2. Shared search behaviour (suggestions, keyboard, location permission, date and time) is specified in [qa-search-improvements-plan.md](qa-search-improvements-plan.md) and referenced here as S1–S8.

## Goal and definition

Every **served place** (any city or town explicitly listed by one of the **existing** operators: SEPTA, NJ TRANSIT, LIRR, Amtrak, Greyhound or FlixBus) is searchable, and **major-city coverage is reconciled** against Census. No new operators or paid data.

Two independent sets, per Person 1 (P4-12) and Person 3's contract:

1. **Searchable served places** (`verifiedNationalCities`): every place with verified operator-directory evidence, **regardless of population**. Search eligibility is never filtered by population.
2. **Major-city audit benchmark** (`majorCityCandidates`): U.S. Census Bureau incorporated places with population **≥ 100,000**. Person 3 reports **Census Vintage 2025** (July 1, 2025 estimates, released May 2026): 343 raw SUMLEV162 rows ≥ 100,000, which is **342** strictly incorporated places plus the Census "Urban Honolulu" CDP exception (kept as excluded-with-reason), plus 3 smaller legacy hubs. Those counts are context. QA checks that the cited files and rules reproduce whatever list they produce (A1). This set measures completeness. It is not a Search filter.

**Scope (Person 1, P4-10 answer):** the base major-city audit is the **50 states + DC**. **Puerto Rico and other territories** are a **separate, explicitly scoped supplementary audit**, never mixed into the incorporated-place counts, and never declared unserved without evidence.

**What "served" means (Person 1's qualification decision):** an official operator directory listing verifies a **named city-market listing** (`qualification: "city-market"`) with the official city-page URL, checked date and observed stop names. It does **not** establish a stop inside municipal limits, the actual operating carrier, live availability or a connection to any other city. Exact municipal or stop coverage stays separately qualified or pending. UI copy for market listings: **"Listed service area — check boarding stop."** Missing directory membership is **unresolved, not unserved**.

**A sample of cities can't prove completeness.** Acceptance is full reconciliation of the candidate set (A2), not spot checks.

## A. Catalogue audit (Person 3's data), run on the assigned SHA

| # | Check | Pass criterion | SHA | Result |
| --- | --- | --- | --- | --- |
| A1 | Reproducible candidate list | A script or documented step turns the **cited** Census file(s) and written selection rules (for example Vintage 2025, SUMLEV162, ≥ 100,000, with the stated handling of CDP exceptions and hubs) into `majorCityCandidates`. Re-running it from the recorded file URL, vintage, date and hash gives an identical list. Pass is judged on **reproducing the sourced method**, not on matching any previously reported count. If the source or rules change, the new count is accepted as long as it reproduces. Person 3's earlier report (343 raw / 342 strict + Urban Honolulu + 3 hubs) is a reference point, not a hardcoded expectation. | | |
| A2 | **Full reconciliation** | Every candidate place is in exactly one bucket: **covered**, **excluded** (with reason) or **unresolved** (with owner). Set equality is checked by script: no candidate missing, no extra un-sourced city. Counts per bucket are reported. | | |
| A3 | Evidence per covered city | At least one `(operator, official URL, retrieval date, station or stop name)` row per covered city. URLs are on the operator's own domain (`septa.org`, `njtransit.com`, `mta.info`, `amtrak.com`, `greyhound.com`, `flixbus.com`). No aggregators or third-party timetable sites. | | |
| A4 | Source freshness | Every evidence row has a date. A documented staleness threshold (for example more than 90 days) is flagged for re-check. | | |
| A5 | Market versus municipality | Each verified record carries `qualification` (`"city-market"` or a stricter municipal or stop qualification). `municipalCoverage` and `operatingCarrier` stay **pending** unless separately evidenced. The audit reports **market listings and confirmed municipal or stop coverage as separate totals**. No record is silently upgraded from market to municipal. Operator locality strings (for example Camden / Malvern stops labelled "Philadelphia") are not accepted as boundary proof. | | |
| A6 | Spot re-verification | Independently re-open a **random sample of at least 30 covered rows** (stratified across operators and states, with the seed recorded) and confirm the official page still lists the stop. Any miss counts as a defect. This checks evidence quality only and is not a completeness proof (A2 is). | | |
| A7 | Duplicate city names | Same-name places are distinct IDs with the state shown everywhere: for example Portland ME / OR, Springfield MA / IL / MO, Columbus OH / GA, Kansas City MO / KS, Aurora CO / IL, Arlington TX, Glendale AZ / CA, Pasadena CA / TX, Rochester NY / MN, Lancaster CA / PA. No bare-name lookup resolves silently to one of them. | | |
| A8 | Non-incorporated and consolidated places | Census-designated places (for example Arlington, VA) and consolidated city-counties are handled by a documented rule, not ad hoc | | |
| A9 | Coordinates | A source is recorded for each city's coordinates. Each point lies inside its state's boundary and within a documented tolerance of the place. Coordinates are city-level (no rider location involved). | | |
| A10 | Aliases | Documented and tested: `NYC`, `LA`, `DC`, `Philly`, `SF`, `St.` / `Saint`, `Ft.` / `Fort`, `Mt.` / `Mount`, accents (for example `San José`). No alias maps to two cities. | | |
| A11 | Explicit outcomes | Every candidate without verified evidence is **excluded with a reason** (for example the Urban Honolulu CDP exception) or **unresolved / pending**, never dropped silently and never labelled "no service" without evidence. Alaska and Hawaii are included only where evidence supports service. Territories appear only in the supplementary audit. | | |
| A12 | Existing data unchanged | The original demo trips and IDs (`regional-connection`, `amtrak-connection`) and all `east-…` IDs still resolve, with the same times | | |

### Evidence field mapping (Person 3's contract is canonical)

Every evidence field the audit needs maps to a field in Person 3's exported contract (`nationalCities`, `verifiedNationalCities`, `getVerifiedOperators(cityId)`, `majorCityCandidates`). A required field that's missing or empty for a record makes that record **unresolved** for the audit, not verified.

| Audit needs | Contract field (Person 3) | Check |
| --- | --- | --- |
| Stable ID | `id` (the 24 existing IDs unchanged; new IDs include the state) | Unique; existing IDs preserved (A12) |
| Name, state | `name`, `state` | Duplicates disambiguated by state (A7) |
| Population, source, vintage, inclusion reason | population / source / vintage / `inclusionReason` on candidates | Reproduces A1 |
| Representative point and its provenance | `latitude`, `longitude`, coordinate provenance (Census Gazetteer GEOID join) | Inside the state; provenance present (A9) |
| Aliases | `aliases` | Unique alias → city (A10) |
| Operator | per-operator coverage record; `marketedOperator` | One of the six operators only |
| Evidence status | coverage `status`: verified / pending / excluded | Only `verified` reaches search or verified totals |
| Evidence scope | `qualification` (`"city-market"` …), `municipalCoverage`, `operatingCarrier` | Shown in the UI; pending stays pending (A5) |
| Official source and date | `sourceUrl`, `checkedDate` | Operator's own domain; dated (A3, A4) |
| Observed stops | `stops` | Non-empty for verified market records |

## B. Application behaviour, on the assigned SHA

| # | Check | Pass criterion | SHA | Result |
| --- | --- | --- | --- | --- |
| B1 | National suggestions | S1 / S2 cases pass for the national list. Same-name cities show the state, and typing `Portland` offers both Portland, ME and Portland, OR. | | |
| B2 | **Coverage-only versus route** | For two covered cities with no sample route, the UI says "both cities are served by <operators>; no sample route is planned", with operator links. It **never** shows a direct route, connection, duration, fare or timetable it doesn't have. | | |
| B3 | No implied service between covered cities | A covered city pair never produces "Greyhound Boston → Seattle" style wording unless the catalogue supplies that sample route, and any route that is shown stays labelled a sample concept | | |
| B4 | Excluded and unresolved cities | Searching an excluded entry gives its reason. A pending or unresolved city says "not yet verified". Neither is an error, and neither is offered as a supported origin or destination. |
| B4a | Market wording | Every verified market listing shown in search, results, Journey or Wallet uses qualified wording ("Listed service area — check boarding stop"). It never says "station in <city>" unless municipal or stop coverage is verified. |
| B4b | **Smaller towns** | A sample of small verified listings (population under 10,000, under 100,000, and with no Census population) is searchable exactly like major cities. The sample is drawn by a recorded seed from `verifiedNationalCities` and has at least 20 entries. Searching a pending small place gives "not yet verified", not invented service. |
| B4c | Unsupported manual input | Unknown or unlisted towns get helpful feedback (nearest verified listings by name or state, and a manual retry), never invented service | | |
| B5 | Location out of area | Uses S5 / S6, plus positions in Alaska, Hawaii, Puerto Rico, Canada, Mexico and the ocean. The nearest-city suggestion is honest about distance and never claims a station. | | |
| B6 | Location permission errors | S5.3–S5.6 (denied, timeout, unavailable, insecure context) | | |
| B7 | Date / time | S3 / S4. Wording doesn't imply schedules for national cities. Timezone wording: the app states which zone it uses, with checks for a Pacific / Mountain / Central city searched from an Eastern device and the reverse. | | |
| B8 | Persistence | National city IDs (including same-name cities) survive refresh, share and Back / Forward, and the URL holds IDs that don't depend on display names | | |
| B9 | Privacy | S7: no rider coordinates in URLs, storage or requests | | |
| B10 | Disclosures | The live-claim scan (S8.2) passes across national results. SEPTA is still the only live element. Ticket links still go to official operator domains only. | | |
| B11 | Original demo and expansion regression | `qa/e2e-check.cjs`, `qa/expansion-check.cjs`, `qa/p4-09-check.cjs` and `qa/demo-rehearsal.cjs` (online and offline) pass, apart from findings that are listed as open | | |
| B12 | Mobile and keyboard | S2 at 320px and 390px with the long national list. The map (if extended) passes the X5 label-size check (≥ 10px rendered) or hides labels on phones in favour of a list. | | |

## C. Performance: measurement protocol (P4-12)

**Why:** the expansion currently **enumerates every city pair × 3 profiles at module load** (`demoTrips.push(...buildEastCoastTrips())`, with an array-sort shortest-path routine per pair). Person 1 has told Person 3 not to scale that approach. Person 3 owns a separate routing PR (indexes built once, per-query planning, binary-heap Dijkstra with early exit where benchmarks justify it, a bounded versioned cache, and a central `getTripById` lookup). QA measures **baseline versus optimized** on the same protocol. **Budgets are agreed with Persons 2 and 3 after the baseline is measured. No speed-up numbers are assumed in advance**, and no equivalence to proprietary Google or Apple routing is claimed. RAPTOR, road contraction hierarchies and similar are context only; our data is static sample concepts, not timetables or a road network.

### Environment (recorded for every run)

Commit SHA; dataset size (searchable places, major candidates, graph nodes and edges per profile, profiles); Node, pnpm, Playwright and Chromium versions; OS and CPU model; device emulation (desktop 1280×900; mobile 390×844 with `isMobile`); CPU throttling (none and ×4 through CDP `Emulation.setCPUThrottlingRate`); production build served by `pnpm start` on port 4173; cache state (cold = fresh browser context; warm = repeated in the same context).

### Metrics

| # | Metric | How | Baseline | Optimized |
| --- | --- | --- | --- | --- |
| C1 | **Initialization work** | Count route computations and trips created at module load (instrumented build or exported counters). **Pass condition (not a timing budget): no all-pairs × profiles enumeration at startup**; startup route computations are bounded and independent of N². | | |
| C2 | Main-thread blocking at load | `PerformanceObserver` long tasks (over 50 ms): count, longest, total blocking from navigation to idle; plus `domcontentloaded` / `load` and time to first visible route card. Report p50 / p95 over 10 cold loads. | | |
| C3 | Compressed bundle | gzip and brotli size of every JS chunk and data file loaded on `/`, and which load lazily. The delta versus `21d77dd` is reported. | | |
| C4 | Memory (where measurable) | CDP `Performance.getMetrics` `JSHeapUsedSize` after load and after 100 searches. Report the growth. `performance.measureUserAgentSpecificMemory` only if cross-origin isolation exists (it currently doesn't, so not measurable that way). | | |
| C5 | **Search latency, cold and warm** | Time from submitting a search to the results status updating, p50 / p95 over a **seeded** case set (seed recorded; PRNG documented) of at least 200 origin / destination / profile / filter combinations, including same-name cities, aliases, reverse, long-haul and no-route pairs | | |
| C6 | **Autocomplete latency** | Keystroke to suggestion list update, p50 / p95 over at least 200 seeded prefixes (1–4 characters), cold and warm | | |
| C7 | **Route correctness** | For a small reference graph (the current 24-city sample plus a hand-built ≤10-node graph with known answers), the optimized planner's path cost equals a simple reference Dijkstra (array scan) for **every** origin / destination / profile pair. Ties are allowed only if documented. Every displayed leg exists as a catalogue edge (**no fictitious national edges**). | | |
| C8 | **Deep links preserved** | `getTripById` reconstructs `regional-connection`, `amtrak-connection`, every `east-…` ID from the expansion, and a seeded sample of new IDs after reload and in a fresh browser, with the same times and legs as before | | |
| C9 | Offline and no external requests | No runtime calls to geocoders, tiles, Census or operator sites. Local `pnpm start` works offline. | | |

**Synthetic data:** any synthetic or stress graph (for example N = 1,000 random nodes) is reported **separately** and labelled synthetic, never mixed into real-catalogue results or presented as real coverage.

### Instrumentation hook (accepted by Person 1, October 24)

Person 3's proposed **`getRoutingDiagnostics()`** read-only snapshot covers the hooks QA needs. It's to be implemented in the separate routing PR; no benchmark SHA is assigned yet.

| Snapshot field (proposed) | Used by | How |
| --- | --- | --- |
| startup route computations, startup trip creations | **C1** | Read right after first load in a fresh context. Pass: bounded and independent of city-pair count (not N² × profiles). Compare baseline and optimized. |
| queries (count) | C1, C5 | Confirms work happens per query, not at load. Stays in step with the number of searches issued. |
| cache max, cache entries | **F1** | Issue more distinct queries than `max`; `entries` must never exceed `max` |
| dataset / cache version | **F3** | Snapshot the version. After a simulated version change, earlier entries must not be served. |
| test-only reset / clear | C1, F1, F3 | Used only in test builds to isolate runs. QA also checks that **no production reset endpoint** exists (no `/api` route, no global on `window` in the production bundle). |

**Confirmed: this supports C1, F1 and F3.** Constraints carried into QA: the snapshot contains no precise coordinates and no per-rider query log (it's checked alongside F5).

**Agreement step:** after the first baseline run, I post the table here and in hub #2, and Persons 2 and 3 confirm budgets for C2, C3, C5 and C6 before the optimized run is judged.

## E. Full-US map (P4-12)

| # | Check | Pass criterion | SHA | Result |
| --- | --- | --- | --- | --- |
| E1 | Accurate geography | Continental US from a documented source (for example Natural Earth, bundled). Markers sit at each place's representative point within a stated tolerance, and states run north-up. | | |
| E2 | Alaska and Hawaii honesty | Shown as **labelled insets** ("Alaska — not to scale / different scale"), or an equivalent honest view. Never placed so they imply real distance or position. Shown only if evidence-backed places exist there. | | |
| E3 | Readable on phones | Uses the P4-11 rules: every visible label is at least 11px rendered at 320 and 390px (desktop at least 10px); no label / label or label / legend collisions; the legend and any disclosure sit outside mask fades; every marker is named in visible text or an accessible list | | |
| E4 | Coverage versus route | Markers mean "listed service area". Any lines are labelled as concepts or omitted. No line implies a verified route. The caption or legend says so in visible text at every width. | | |
| E5 | Density | With hundreds of markers, labels are thinned or clustered, with a list or search fallback. Hidden labels are still reachable as text. | | |
| E6 | No external requests and no overflow | Same as the P4-11 map checks | | |

## F. Caches (P4-12)

| # | Check | Pass criterion | SHA | Result |
| --- | --- | --- | --- | --- |
| F1 | Bounded | Issue more distinct queries than the cache limit. Size never exceeds the documented maximum (LRU or similar), and memory doesn't grow without bound (C4). | | |
| F2 | Keyed by every input that affects the result | Changing any of origin, destination, profile, mode, operator, sort, Amtrak toggle, date / time or **catalogue version** produces a fresh result, never a stale cached one | | |
| F3 | Versioned | Changing the catalogue / data version (simulated by the exported version constant or a test hook) invalidates old entries | | |
| F4 | Stale-result races | Rapid search A then B, with A slowed (by throttling or a test delay), never shows A's result under B's criteria. The same applies to autocomplete and the location result after a manual edit (Person 3's helper contract: ignore obsolete results). | | |
| F5 | **No precise coordinates** | No cache key or value contains rider coordinates (only rounded transient helper output, never stored). The S7 privacy checks still pass. | | |
| F6 | **No expired live-snapshot reuse** | The SEPTA snapshot is never served from a route or search cache past its 60 s expiry. The P4-09 stale checks (fake clock) still pass with caching on. | | |

## D. What acceptance looks like

- A2 reconciliation passes with counts reported, and every unresolved city has an owner.
- A3–A11 pass, or failures are recorded as findings.
- B1–B12, E1–E6 and F1–F6 pass; C1, C7, C8 and C9 pass; C2–C6 meet the budgets agreed after the baseline. Failures are recorded with owners.
- The report names the exact SHA and states plainly that **coverage means an operator serves the city, not that any listed connection, timetable, fare or availability is verified.**

## How it will be run

1. Wait for `Next instructions — Person 4 — P4-NN` in hub #2 with the branch, full SHA, included PRs and Person 3's evidence file path.
2. Clean checkout; `pnpm install --frozen-lockfile && pnpm build && pnpm test`; serve with `PORT=4173 pnpm start`.
3. Write `qa/nationwide-check.cjs` (catalogue reconciliation, evidence-row validation, the sampled URL re-checks recorded with a seed) and browser checks for B and C against the real selectors.
4. Record results against that SHA in this file, and report under the task ID in hub #2.
