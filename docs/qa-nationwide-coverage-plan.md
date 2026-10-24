# Nationwide coverage: QA acceptance plan (P4-10)

Owner: Person 4. Catalogue: Person 3 (source-verified national city list). Search integration: Person 2. Coordination: Person 1.

**Status: plan and evidence checklist only. No nationwide application SHA has been assigned, so nothing here has been executed.** Results are recorded only against a full pushed SHA, branch and included PRs given in a later numbered P4 instruction in hub issue #2. Shared search behaviour (suggestions, keyboard, location permission, date and time) is specified in [qa-search-improvements-plan.md](qa-search-improvements-plan.md) and referenced here as S1–S8.

## Goal and definition

Every **major US city** is served by at least one of the **existing** operators: SEPTA, NJ TRANSIT, LIRR, Amtrak, Greyhound or FlixBus. No new operators or paid data.

- **Major city** = an incorporated place with population **≥ 100,000** in the latest U.S. Census Bureau city and town population estimates. Record the vintage, file URL, retrieval date and SHA-256 of the downloaded file. The same file must reproduce the same candidate list.
- **Plus** documented smaller operator hubs, each with a written reason (for example a major Amtrak or Greyhound interchange below 100,000).
- **"Served"** means an official operator source (station or stop page, or the operator's own published station or stop list) shows a station or stop **in, or explicitly serving, that city**, with the URL and retrieval date. It does **not** mean a verified direct route, timetable or availability between any two cities.

**A sample of cities can't prove nationwide completeness.** Acceptance is a full reconciliation of the Census candidate set, not spot checks.

## A. Catalogue audit (Person 3's data), run on the assigned SHA

| # | Check | Pass criterion | SHA | Result |
| --- | --- | --- | --- | --- |
| A1 | Reproducible candidate list | A script or documented step turns the recorded Census file into the candidate list. Re-running it gives an identical list (same count, same IDs). Vintage, URL, date and hash are in the repo. | | |
| A2 | **Full reconciliation** | Every candidate place is in exactly one bucket: **covered**, **excluded** (with reason) or **unresolved** (with owner). Set equality is checked by script: no candidate missing, no extra un-sourced city. Counts per bucket are reported. | | |
| A3 | Evidence per covered city | At least one `(operator, official URL, retrieval date, station or stop name)` row per covered city. URLs are on the operator's own domain (`septa.org`, `njtransit.com`, `mta.info`, `amtrak.com`, `greyhound.com`, `flixbus.com`). No aggregators or third-party timetable sites. | | |
| A4 | Source freshness | Every evidence row has a date. A documented staleness threshold (for example more than 90 days) is flagged for re-check. | | |
| A5 | City versus metro qualification | Each row says whether the stop is **inside city limits** or **serves the city from elsewhere** (airport, suburb, neighbouring city). "Serves from elsewhere" is labelled as such in the UI and never shown as "in <city>". | | |
| A6 | Spot re-verification | Independently re-open a **random sample of at least 30 covered rows** (stratified across operators and states, with the seed recorded) and confirm the official page still lists the stop. Any miss counts as a defect. This checks evidence quality only and is not a completeness proof (A2 is). | | |
| A7 | Duplicate city names | Same-name places are distinct IDs with the state shown everywhere: for example Portland ME / OR, Springfield MA / IL / MO, Columbus OH / GA, Kansas City MO / KS, Aurora CO / IL, Arlington TX, Glendale AZ / CA, Pasadena CA / TX, Rochester NY / MN, Lancaster CA / PA. No bare-name lookup resolves silently to one of them. | | |
| A8 | Non-incorporated and consolidated places | Census-designated places (for example Arlington, VA) and consolidated city-counties are handled by a documented rule, not ad hoc | | |
| A9 | Coordinates | A source is recorded for each city's coordinates. Each point lies inside its state's boundary and within a documented tolerance of the place. Coordinates are city-level (no rider location involved). | | |
| A10 | Aliases | Documented and tested: `NYC`, `LA`, `DC`, `Philly`, `SF`, `St.` / `Saint`, `Ft.` / `Fort`, `Mt.` / `Mount`, accents (for example `San José`). No alias maps to two cities. | | |
| A11 | Explicit exclusions | Places with no service from these operators (expected candidates: Honolulu and Anchorage) are listed as **excluded with reason**, never dropped silently. Puerto Rico scope is stated explicitly. | | |
| A12 | Existing data unchanged | The original demo trips and IDs (`regional-connection`, `amtrak-connection`) and all `east-…` IDs still resolve, with the same times | | |

Evidence file expected from Person 3: a CSV or JSON with one row per candidate:
`city_id, name, state, census_geoid, population, vintage, bucket(covered|excluded|unresolved), reason, operator, official_url, retrieved_on, stop_name, in_city_limits(bool), lat, lon, coord_source, aliases`.

## B. Application behaviour, on the assigned SHA

| # | Check | Pass criterion | SHA | Result |
| --- | --- | --- | --- | --- |
| B1 | National suggestions | S1 / S2 cases pass for the national list. Same-name cities show the state, and typing `Portland` offers both Portland, ME and Portland, OR. | | |
| B2 | **Coverage-only versus route** | For two covered cities with no sample route, the UI says "both cities are served by <operators>; no sample route is planned", with operator links. It **never** shows a direct route, connection, duration, fare or timetable it doesn't have. | | |
| B3 | No implied service between covered cities | A covered city pair never produces "Greyhound Boston → Seattle" style wording unless the catalogue supplies that sample route, and any route that is shown stays labelled a sample concept | | |
| B4 | Excluded and unresolved cities | Searching an excluded city (Honolulu) gives its reason. An unresolved city says "not yet verified". Neither is an error. | | |
| B5 | Location out of area | Uses S5 / S6, plus positions in Alaska, Hawaii, Puerto Rico, Canada, Mexico and the ocean. The nearest-city suggestion is honest about distance and never claims a station. | | |
| B6 | Location permission errors | S5.3–S5.6 (denied, timeout, unavailable, insecure context) | | |
| B7 | Date / time | S3 / S4. Wording doesn't imply schedules for national cities. Timezone wording: the app states which zone it uses, with checks for a Pacific / Mountain / Central city searched from an Eastern device and the reverse. | | |
| B8 | Persistence | National city IDs (including same-name cities) survive refresh, share and Back / Forward, and the URL holds IDs that don't depend on display names | | |
| B9 | Privacy | S7: no rider coordinates in URLs, storage or requests | | |
| B10 | Disclosures | The live-claim scan (S8.2) passes across national results. SEPTA is still the only live element. Ticket links still go to official operator domains only. | | |
| B11 | Original demo and expansion regression | `qa/e2e-check.cjs`, `qa/expansion-check.cjs`, `qa/p4-09-check.cjs` and `qa/demo-rehearsal.cjs` (online and offline) pass, apart from findings that are listed as open | | |
| B12 | Mobile and keyboard | S2 at 320px and 390px with the long national list. The map (if extended) passes the X5 label-size check (≥ 10px rendered) or hides labels on phones in favour of a list. | | |

## C. Performance and size (large catalogue)

The current expansion builds **every city pair for every operator profile at module load** (`demoTrips.push(...buildEastCoastTrips())`): about 24 × 23 × 3 candidate trips today. At about 350 cities that's on the order of 350 × 349 × 3 ≈ 366,000 path searches at page load, each using an array-sort shortest-path routine. Without lazy, per-query computation this is a likely blocker.

| # | Check | Pass criterion | SHA | Result |
| --- | --- | --- | --- | --- |
| C1 | Startup cost | First load at 320px on Playwright CPU throttling ×4: interactive within a documented budget (proposed: under 3 s on local `pnpm start`). No main-thread task over 200 ms attributable to catalogue building. | | |
| C2 | Search latency | Suggestions update within 100 ms per keystroke. A search result renders within 300 ms. Measured over 20 queries, including same-name and alias cases. | | |
| C3 | Bundle size | The gzip size increase of the main JS and catalogue data is reported. Proposed budget: under 150 KB of extra gzip, or the catalogue is lazy-loaded. | | |
| C4 | Memory | Heap after load is reported, with no growth across 50 searches | | |
| C5 | Offline and no external requests | No runtime calls to geocoders, map tiles, Census or operator sites. Everything is bundled. Offline local `pnpm start` still works (demo fallback). | | |

## D. What acceptance looks like

- A2 reconciliation passes with counts reported, and every unresolved city has an owner.
- A3–A11 pass, or failures are recorded as findings.
- B1–B12 and C1–C5 pass, or failures are recorded with owners.
- The report names the exact SHA and states plainly that **coverage means an operator serves the city, not that any listed connection, timetable, fare or availability is verified.**

## How it will be run

1. Wait for `Next instructions — Person 4 — P4-NN` in hub #2 with the branch, full SHA, included PRs and Person 3's evidence file path.
2. Clean checkout; `pnpm install --frozen-lockfile && pnpm build && pnpm test`; serve with `PORT=4173 pnpm start`.
3. Write `qa/nationwide-check.cjs` (catalogue reconciliation, evidence-row validation, the sampled URL re-checks recorded with a seed) and browser checks for B and C against the real selectors.
4. Record results against that SHA in this file, and report under the task ID in hub #2.
