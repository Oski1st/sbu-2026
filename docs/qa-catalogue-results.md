# National city catalogue QA (P4-19)

Owner: Person 4. Data owner: Person 3 (PR #20, `feat/national-city-catalogue` → `main`). Assigned in hub issue #2 as **P4-19**.

This is a **data-only audit** of the catalogue's counts and qualification contract. It's separate from combined #26, from production and from the earlier browser results. It isn't exhaustive service verification. Missing evidence in the catalogue is never treated here as a real-service absence.

## Target and environment

| Item | Value |
| --- | --- |
| Tested SHA | **`d45b0d3305e154ac93c165af70ecfb6e8812f74b`** (PR #20 head, open). Merge base with `main`: `db454c030040a07c00986117331f172acf5848f6`. |
| Diff | 12 files, all under `src/data/national/` plus `src/data/nationalCities.ts` and its test. Nothing in `src/` outside them imports the catalogue, and none of its strings appear in the built bundle. |
| Environment | macOS 15.7.7, Node 22.23.4, pnpm 11.25.0, Python 3 (`-I`). Run on October 24, 2026 (US Eastern). |

## Commands and totals

| Check | Command | Result |
| --- | --- | --- |
| Locked install | `pnpm install --frozen-lockfile` | Pass |
| Build (TypeScript `tsc -b` + Vite) | `pnpm build` | Pass. This `main`-based branch has no separate `typecheck` script; `tsc -b` in the build is the type check. |
| Unit tests | `pnpm test` | **56 / 56** (7 files), including the 11 catalogue tests |
| Census source hashes | `shasum -a 256` on fresh downloads from the manifest URLs | Both **match** `sources.json` |
| Census regeneration | `python3 -I src/data/national/build_candidates.py <csv> <zip> --output <tmp>` then `cmp` | **Byte-identical** (346 rows: 342 population, 1 excluded, 3 hubs) |
| Independent Census selection | my own reading of the same CSV and Gazetteer | 343 rows with `SUMLEV 162` and `POPESTIMATE2025 ≥ 100000`, **0** missing Gazetteer joins. The only `LSAD 57` (CDP) row is **Urban Honolulu** (341,868). Every threshold GEOID is present; **0** population or coordinate mismatches across all 346 candidate rows. Smallest selected: 100,109. |
| Operator source hashes | fresh downloads of the Amtrak GTFS zip and both bus directory pages | All three **match** `sources.json` (Amtrak `feed_version 20261024`, start 20261025) |
| Mechanical audit, all records | `qa/p4-19-catalogue-dump.test.ts` then `python3 -I qa/p4-19-catalogue-audit.py <dump> <checkout> <gazetteer zip>` | **0 contract failures** across 1,550 entries and 9,300 operator coverage slots (see below) |

The dump spec is skipped unless `P4_19_DUMP_OUT` is set: in the catalogue checkout, `pnpm test` reports 56 passed and 1 skipped.

## Count reconciliation (runtime exports)

| Quantity | Reported | Reproduced |
| --- | ---: | ---: |
| `nationalCities` (all audit entries) | 1,550 | 1,550 = 346 Census candidates + 1,204 operator-listed |
| Verified / unresolved / excluded | 1,370 / 179 / 1 | 1,370 / 179 / 1 (sum 1,550) |
| `verifiedNationalCities` | 1,370 | 1,370. All verified entries have coordinates, so none drop out. |
| `majorCityCandidates` | 343 | 343 (342 `population-100000` + 1 `excluded-non-incorporated`) |
| Regional hubs | 3 | 3 (Portland ME, Trenton NJ, Stony Brook NY) |
| Operator records | 2,047 | SEPTA 2, NJ TRANSIT 3, LIRR 2, Amtrak 149, Greyhound 563, FlixBus 1,328 |
| Bus page checks | 2,792: 1,891 verified, 901 pending | 1,891 verified (all hashed). Of the 901 pending, 816 are Greyhound request failures with no hash; 85 were fetched and hashed but didn't qualify (68 FlixBus, 17 Greyhound). All dated 2026-10-24. |
| Unresolved breakdown | not stated | 115 of the 342 eligible majors and 64 operator-listed places |
| Geography | | 1,352 incorporated, 101 CDP, 92 operator-market, 5 consolidated-balance |
| Coordinate method | | 1,458 Census internal point, 82 operator-stop representative, 10 unavailable (`null`, all unresolved) |

## Mechanical checks on every record (all pass)

- **IDs:** unique and slug-shaped. Every non-legacy ID carries its state suffix. No duplicate Census GEOID, and no duplicate (name, state).
- **Legacy compatibility:** all **24** original IDs are present, with the same states (`portland` = ME, `albany` = NY, `washington` = DC).
- **Aliases:** every entry has at least one. 206 unqualified aliases (for example "Portland") are shared by more than one entry, as designed; **no** state-qualified alias ("Portland, OR") is shared.
- **Coordinates:**
  - All are within US bounds and rounded to 0.01°.
  - Every Census-point entry matches its Gazetteer `INTPTLAT` / `INTPTLONG`, state and Census name.
  - Operator-stop points carry no GEOID and an operator URL.
  - `null` coordinates only appear with `coordinateMethod: unavailable`, and never on a verified entry.
- **Population:** every `population-100000` entry is ≥ 100,000 with vintage 2025. **No** operator-listed place has a population ≥ 100,000. `null` population always comes with a `null` vintage and source.
- **Coverage records:**
  - Every entry has exactly the six operators, in order.
  - `getVerifiedOperators(id)` equals the verified subset for all 1,550 entries, and an unknown ID returns `[]`.
  - Every verified record has `city-market`, `municipalCoverage: pending`, `operatingCarrier: pending`, non-empty stop names, a note, an ISO date of 2026-10-24, and https URLs on the expected operator host with no credentials or port.
  - Every verified bus record has a matching hashed, verified page check.
  - Pending records carry `unresolved` with a reason, no stops or evidence URL, and no absence claim.
- **No routing payload:** no fare, departure, arrival, legs, route, edge, schedule, duration, price, trip or connection field on any entry or record. The only Amtrak use is stop names.
- **Excluded exception:** Urban Honolulu (GEOID `1571550`) is `excluded`, with all six operators `excluded` and no verified record.
- **Geographic scope:** 50 states + DC only, with **no territory rows**. The directories list no territories, and the limitations say territories aren't inferred. **AK** (Anchorage, unresolved) and **HI** (only the excluded CDP) have no verified entries; the other 49 jurisdictions do. There's no territory supplement in this PR; that's stated, not implied.

## Stratified 20-record sample (official sources)

Selection: 13 records drawn with `random.Random(20261024)` inside the strata below (pools sorted by ID, legacy IDs excluded). I added 7 on purpose: the regional operators (only 7 regional records exist) and the uncertainty cases found by the mechanical audit. Bus pages were fetched with plain `curl` (no browser user agent), the same way as the PR's audit tool. Amtrak records were checked against the hash-matched official GTFS `stops.txt` / `stop_times.txt`.

| # | Stratum (pool size) | Record | Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | FlixBus major (169) | `toledo-oh` | Pass | HTTP 200, same URL, stop "Toledo Bus Stop" matches |
| 2 | FlixBus major | `elgin-il` | Pass | 200, "Elgin IL" matches |
| 3 | FlixBus smaller (763) | `willmar-mn` (22,001) | Pass | 200, "Willmar CCT Downtown Bus Shelter" matches |
| 4 | FlixBus smaller | `blanding-ut` (3,199) | Pass | 200, "Blanding (Exxon)" matches |
| 5 | FlixBus stop-representative (82) | `lexington-ky` | Pass for the record. **See C2**: duplicate of the unresolved major `lexington-fayette-urban-county-ky`. | 200, "Lexington Bus Stop" matches |
| 6 | Greyhound major (168) | `worcester-ma` | Pass | 200, "Worcester Union Station" matches |
| 7 | Greyhound major | `amarillo-tx` | Pass | 200, "Amarillo Multimodal Transfer Sta" matches |
| 8 | Greyhound smaller (254) | `batesville-ms` (7,325) | Pass | 200, "Batesville(Terza One Stop Shop)" matches |
| 9 | Greyhound smaller | `chickasha-ok` (17,313) | Pass | 200, "Chickasha Travel Plaza" matches |
| 10 | Amtrak GTFS (126) | `tempe-az` | Pass as a directory listing. **See C5**: the stop is a bus stop. | `TEM` "Tempe Amtrak Bus Stop", 4.4 km, only on route type 3 (bus) trips |
| 11 | Amtrak GTFS | `south-bend-in` | Pass | `SOB` "South Bend Amtrak Station", 1.5 km, rail trips |
| 12 | Amtrak GTFS | `beaumont-tx` | Pass | `BMT` "Beaumont Amtrak", 2.2 km, rail trips |
| 13 | Amtrak GTFS | `seattle-wa` | Pass | `SEA` "Seattle", 2.8 km, rail and bus trips |
| 14 | NJ TRANSIT (3) | `newark-nj` | Pass | njtransit.com station page 200, title "Newark Penn Station" |
| 15 | LIRR (2) | `stony-brook` | Pass | mta.info station page 200, title "Stony Brook" |
| 16 | SEPTA (2) | `trenton` | Pass | `TRE.pdf` 200 (application/pdf). The text includes "Trenton Line" and "Trenton Transit Center". No timetable values were read. |
| 17 | Uncertainty: legacy bus gap | `washington` (DC), Greyhound / FlixBus | **Gap, C1** | Both official pages `/bus/washington-dc` return 200 with stops; never ingested |
| 18 | Uncertainty: legacy Amtrak gap | `new-york`, Amtrak | **Gap, C4** | GTFS `NYP` "Ny Moynihan Train Hall At Penn Station" (rail) at 11.0 km; not matched |
| 19 | Uncertainty: name-form duplicate | `boise-city-id` (unresolved) / `boise-id` (verified) | **Gap, C2** | Flix and Greyhound `/bus/boise-id` both 200, stops "Boise (Chevron)" and "Boise Airport" |
| 20 | Uncertainty: unresolved major | `chattanooga-tn` | Pass (correctly unresolved) | Absent from both saved directories (1,395 labels each). A guessed `/bus/chattanooga-tn` redirects to the generic `/bus` index, which proves nothing. The record says "missing evidence is not evidence of no service". |

Amtrak station pages (`/stations/sea`, `/stations/nyp`) returned **HTTP 403** to plain `curl`, matching the PR's stated limitation. No bypass was attempted, so Amtrak evidence rests on the GTFS directory only.

Sample limitations:

- 20 records out of 2,047. The random strata cover FlixBus, Greyhound and Amtrak; the regional and uncertainty rows were chosen on purpose.
- A pass means the official page or feed lists the named stop under that market name on October 24, 2026. It doesn't mean the stop is inside the municipality, the brand operates the vehicle, or service runs today.
- These results don't generalize to all 2,047 records, and they're not service verification.

## Findings

No finding blocks the data contract: counts, qualification fields and pending/unresolved honesty all hold. The findings are completeness and labelling gaps that the follow-up branch can act on.

| # | Severity | Owner | Finding | Exact records | Evidence and suggested action |
| --- | --- | --- | --- | --- | --- |
| C1 | **Medium**: legacy city loses evidence | Person 3 | **Washington DC bus pages are dropped.** Both directories label it "Washington, D.C.", and `build_operator_places.py` skips any label whose state token isn't a Gazetteer USPS code (`D.C.` ≠ `DC`). It's the only directory label without a page check, in both directories. | `washington` (bus targets `https://www.flixbus.com/bus/washington-dc`, `https://www.greyhound.com/bus/washington-dc`) | Both pages return 200 with stops "Washington DC (Union Station)", "Washington DC (Dupont Circle)", "Arlington (Rosslyn)" and "Bethesda". The last two show why city-market ≠ municipal. Map `D.C.` → `DC` before matching. |
| C2 | **Medium**: duplicate markets, majors under-counted | Person 3 | **Census name forms don't match operator names**, so the same city appears twice. The major benchmark entry stays unresolved, and a separate `operator-market` entry (stop-representative point, no GEOID) is verified. Search would show both. Display names "Boise City" and "Lexington-Fayette urban county" are also unfriendly. | `boise-city-id` ↔ `boise-id`; `lexington-fayette-urban-county-ky` ↔ `lexington-ky`; `macon-bibb-county-ga` ↔ `macon-ga` | Add these name forms as aliases (as already done for Athens, Augusta, Louisville and Nashville) and rebuild. Related but **not** asserted as duplicates (multi-city or sub-area markets within 8 km of an unresolved major): `el-monte-baldwin-park-ca`, `elizabethport-nj`, `oxnard-ventura-ca`, `orange-county-anaheim-santa-ana-ca`, `los-angeles-international-airport-ca`. |
| C3 | **Medium**: interpretation | Person 3 (wording), Person 2 (UI) | **Greyhound evidence is not independent of FlixBus in this snapshot.** Both directories contain the same **1,395** city labels. All **563 / 563** Greyhound-verified cities have stop lists **identical** to their FlixBus record (page bytes differ: 0 of 579 hash pairs equal), and there are **0** Greyhound-only verified places. The README's "two brands are independent evidence sources" overstates this. | All 563 Greyhound records, for example `new-york` (shared stops include "New York (Hudson Yards Trailways)") | The records stay honest because `operatingCarrier` is `pending`. Say in the README and UI that the two brand pages show a shared network listing, and don't present Greyhound as a separate network. |
| C4 | Low: legacy city | Person 3 | **New York has no Amtrak record.** The official stop name "Ny Moynihan Train Hall At Penn Station" fails the exact name or alias prefix rule. The existing demo routing graph includes New York for Amtrak. | `new-york` | Add a manual Amtrak record (`NYP`) like `kansas-city-mo`, or a `Ny` alias. Other legacy gaps come from conservative, correct no-substitution: the directories list "North Charleston, SC" and "Norfolk-Virginia Beach, VA", not Charleston or Norfolk, and have no Trenton or Stony Brook bus label. |
| C5 | Low: labelling | Person 2 (UI) | **23 of 149** Amtrak GTFS records match only stops that appear solely on route type 3 (bus) trips in this feed. The contract already says these aren't train-only, but a "train" label or icon would be wrong. | `phoenix-az`, `tempe-az`, `bakersfield-ca`, `elk-grove-ca`, `fresno-ca`, `pasadena-ca`, `santa-clarita-ca`, `santa-maria-ca`, `santa-rosa-ca`, `stockton-ca`, `tracy-ca`, `vallejo-ca`, `fort-myers-fl`, `gainesville-fl`, `st-petersburg-fl`, `peoria-il`, `wichita-ks`, `shreveport-la`, `las-vegas-nv`, `sparks-nv`, `wilmington-nc`, `killeen-tx`, `virginia-beach-va` | This describes this feed's trips only, not whether rail service exists elsewhere. Show "Amtrak-listed stop" without a mode. |
| C6 | Info | Person 3 / Person 2 | Some searchable `operator-market` entries are stops or sub-areas rather than places. | `baltimore-greyhound-garage-md`, `los-angeles-international-airport-ca` | Consider labelling them as stops in the UI. Not a contract violation: the README admits "explicitly named markets". |
| C7 | Info | Person 3 | 115 of the 342 eligible majors are unresolved, including Jersey City, Plano, Scottsdale, Chattanooga and Anchorage. None of the 115 matched a label in either saved directory (no bus page check exists for any of them), and none matched the Amtrak name rule, which covers only the 346 Census candidates (smaller-place Amtrak evidence is partial, as stated). | see `qa/p4-19-catalogue-audit.py` output | Correctly unresolved under the contract; no absence claim made. |

## What's confirmed about the contract

- City-market evidence stays distinct: `municipalCoverage` and `operatingCarrier` are `pending` on all 2,047 records, and stops outside the municipality are kept as listed: the live DC pages include Arlington (Rosslyn) and Bethesda, and the Philadelphia records include Camden and Malvern.
- Missing evidence stays `unresolved` with an explicit "not evidence of no service" reason.
- The population benchmark (`majorCityCandidates`) is separate from Search eligibility: 1,204 smaller or operator-listed places are verified-eligible independently, and no operator-listed place is ≥ 100,000.
- No routing edges, pairs, fares or timetable values exist in the data. The SEPTA PDF and Amtrak GTFS are used only for stop names.

## Not tested

- Search UI, browser behaviour, production. This is a data-only task, and nothing in the app imports the catalogue yet.
- Municipal-boundary containment, carrier identity and current service.
- Records outside the 20-record sample, beyond the mechanical checks.

---

# P4-20: catalogue follow-up (#27) audit

Assigned in hub issue #2 as **P4-20** (target `fc844f7`). Checklist: [qa-catalogue-followup-checklist.md](qa-catalogue-followup-checklist.md). The P4-19 section above is unchanged and stays the baseline record. This is a data-only audit with no browser, production or full-regression rerun.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`fc844f72088521c4d0f0dcd3084fc2caf032dda2`** (PR #27 `feat/catalogue-evidence-batch1` → `feat/national-city-catalogue`, open draft) |
| Base / control | PR #20 `d45b0d3305e154ac93c165af70ecfb6e8812f74b`, unchanged. Its runtime dump was regenerated and is byte-identical to the P4-19 dump. |
| Diff | 11 files, all under `src/data/national*`. The four frozen JSON files (`candidates`, `coverage`, `operatorPlaces`, `sources`) are byte-identical to `d45b0d3`. The built app bundle is unchanged (`index-CtqRjWwS.js` on both), and nothing in the app imports the catalogue. |

## Checks run

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile`, `pnpm build` (`tsc -b` + Vite) | Pass. There's no separate `typecheck` script. |
| `pnpm test` | **67 / 67** (8 files) |
| `python3 src/data/national/test_ingestion.py` | **3 / 3** OK |
| P4-19 all-record audit (`qa/p4-19-catalogue-audit.py`) | All checks pass except two expected harness differences: 8 `busNoHashedCheck`, because the new bus records are hashed in the batch ledger rather than the frozen manifest (verified below), and 1 `wrongHost`, because the NYP identity page is `greatamericanstations.com`, whose footer reads "© 2013-2026 Amtrak". Neither is a data defect. |
| Prepared delta (`qa/p4-20-catalogue-delta.py`) | 16 PASS, 6 CHECK, 3 FAIL. The C1 FAILs and the C2, C4 and C5 CHECKs come from the harness expecting manifest page checks and no added metadata fields. #27 instead puts hashes in its ledger, adds `modeEvidence` and `sourceFamily`, and dedupes through `verifiedMarketChoices`. Each is resolved by the verifier below. **The C3 FAIL is real (D1).** |
| Independent verifier (`qa/p4-20-catalogue-verify.py`, dumps from `qa/p4-19-catalogue-dump.test.ts` + `qa/p4-20-catalogue-extra-dump.test.ts`) | **46 PASS, 1 FAIL (D1), 3 NOTE** |
| Minimal live official-source checks (changed records only, plain `curl`) | NJ TRANSIT West Side Avenue 200 ("Hudson-Bergen Light Rail", "Jersey City"). maconbibb.us 200 ("Macon-Bibb County", "Macon, GA 31201"). lexingtonky.gov 200 ("Lexington-Fayette Urban County Government"). Great American Stations NYP 200 ("Moynihan Train Hall (NYP)"). FlixBus and Greyhound `/bus/macon-ga` 200 with "Macon Bus Station". Boise FY19 PDF `HEAD` 200 `application/pdf`. DC pages: already checked live in P4-19 (same day), and their stops equal the new records. |

## Counts reconciled

| Quantity | Reported | Verified |
| --- | ---: | ---: |
| Audit rows / qualified / unresolved / excluded | 1,550 / 1,374 / 175 / 1 | Same |
| Distinct market choices (`verifiedMarketChoices`) | 1,371 | 1,371 = 1,374 − 3 alias rows |
| Raw brand/source associations | 2,057 | 2,057 (2,047 + 10 added) |
| Canonical-market brand/source associations | 2,053 | 2,053. Four deduplicated: Boise FlixBus + Greyhound, Lexington FlixBus, Macon FlixBus. |
| By operator | | SEPTA 2, NJ TRANSIT 4, LIRR 2, Amtrak 150, Greyhound 567, FlixBus 1,332 |
| Benchmark / hubs / operator-listed | 342 (343 rows) / 3 / 1,204 | Unchanged |

- **Resolution vs new markets:** the **four resolved audit rows** are `boise-city-id`, `lexington-fayette-urban-county-ky` and `macon-bibb-county-ga` (alias links) plus `jersey-city-nj`. Only **one new distinct market** appears (`jersey-city-nj`); the three alias rows add no market.
- **Nothing else moved:** no other status changed. All 1,550 rows keep their IDs, names, aliases, population, coordinates and provenance fields. No baseline verified record was removed or altered once the additive `sourceFamily`, `independentCorroboration` and `modeEvidence` fields are ignored. Exactly the 10 expected records were added, none overwriting a baseline city/operator record.
- **Added-record provenance:** each of the 10 has a dated HTTP 200 same-URL response in the ledger with a matching SHA-256 and `checkedAt`. NYP uses the frozen feed hash. All keep `municipalCoverage` and `operatingCarrier` `pending`, and all 2,057 records stay pending.

## C1 to C5 verdict

| # | Verdict | Evidence |
| --- | --- | --- |
| C1 DC | **Resolved** | `washington` gains FlixBus + Greyhound from `/bus/washington-dc` (ledger 200, hashed). Stops: Arlington (Rosslyn), Bethesda, Washington DC (Dupont Circle), Washington DC (Union Station), equal to the P4-19 live fetch. No new entry. `ingestion.py` adds only the explicit `{'D.C.': 'DC'}` exception. |
| C2 links | **Resolved** | Three same-state links (`boise-city-id`→`boise-id`, `lexington-fayette-urban-county-ky`→`lexington-ky`, `macon-bibb-county-ga`→`macon-ga`). Targets are verified and not themselves linked: no chain, cycle, self-link or duplicate. Each link has a dated 200 official source plus the operator page. The canonical map moves only those 3 IDs, and an unknown ID returns `undefined`. Alias rows stay in `nationalCities` and `verifiedNationalCities` (raw audit IDs kept). Choices = verified minus the 3 aliases, so no smaller place is dropped and every choice has coordinates. Evidence is unioned only within the 3 links. |
| C3 provenance | **Data resolved; docs not (D1)** | All 1,899 bus records carry `sourceFamily: flix-greyhound-shared-directories` and `independentCorroboration: false`, and non-bus records don't. 567 / 567 Greyhound stop lists are identical to FlixBus, with 0 Greyhound-only places. But the top-level `src/data/national/README.md` line 124 still says "The two brands are independent evidence sources". |
| C4 NYP | **Resolved** | `new-york` Amtrak = exact GTFS `NYP` "Ny Moynihan Train Hall At Penn Station", plus the Amtrak-run identity page (200). The direct `amtrak.com/stations/nyp` 403 is kept as a failed attempt, with no bypass. No other Amtrak record was added. |
| C5 modes | **Resolved** | All 150 `modeEvidence` entries were recomputed independently from the hash-checked GTFS (stop_times → trips → routes) and match: stop IDs, route IDs, route types, class, feed hash and start date 2026-10-25. Classes are **85 rail-only, 41 rail-and-bus, 23 bus-only, 1 unverified** (`kansas-city-mo`). The bus-only set equals the 23 IDs found independently in P4-19. Portland ME (`POR`) and OR (`PDX`) stay separate. |

## Ledger and sources

- **Selection:** the original 25 can be reproduced from baseline data with the stated rule (verified-state coverage, then major status, then population descending, then ID). The revised list = original − `peoria-az` + `macon-bibb-county-ga`, with 25 unique entries (coordinator comment 6392514158). Peoria's two preliminary directory screens are kept, and Peoria stays unresolved (`pending-next-batch`).
- **Outcomes:** ledger before/after equals the runtime for all 25 rows (4 verified, 21 unresolved), and no unresolved row makes an absence claim.
- **Sources:** 18 dated responses, including the NYP 403 and the Chattanooga detail redirect to the generic `/bus` page; Chattanooga stays unresolved. The batch's directory responses are byte-identical to the frozen manifest hashes. The four frozen JSON files match the recorded baseline hashes. The feed start-date limitation (2026-10-25) is stated on every mode record.

## Findings

| # | Severity | Owner | Finding | Evidence |
| --- | --- | --- | --- | --- |
| D1 | Low: documentation contradicts the data | Person 3 | `src/data/national/README.md` line 124 still says "The two brands are independent evidence sources", which contradicts the new `independentCorroboration: false` contract and the evidence README. | `qa/p4-20-catalogue-verify.py` C3 README line; delta C3 FAIL |
| D2 | Low: stale counts | Person 3 | The new top-level README overlay sentence says "1373 qualified audit rows … 176 unresolved" and "the two explicitly sourced alias duplicates". The runtime, tests and evidence README say **1,374 / 175** and **three** links. | Verifier NOTE (README overlay sentence) |
| D3 | Info | Consumers | `jersey-city-nj` qualifies through an NJ TRANSIT **Hudson-Bergen Light Rail** station. It's correctly labelled "not an inferred intercity rail or coach connection", but a UI shouldn't present it as intercity service. | Live page check |
| D4 | Info | Consumers | `getVerifiedOperators('lexington-ky')` returns FlixBus only, while `getVerifiedMarketEvidence('lexington-ky')` returns FlixBus + Greyhound (from the linked row's Greyhound page). Consumers must use the market-evidence view for linked markets. Same pattern for Macon. | Verifier NOTE |

**No blockers.** C1, C2, C4 and C5 are resolved and C3 is resolved in the data. D1 and D2 are documentation-only corrections. No service, carrier, connectivity or completeness claim is made, and missing evidence still isn't treated as absence.

## Not tested (P4-20)

- Browser, Search UI and production. There's no consumer of these exports in the app.
- The 21 still-unresolved ledger rows beyond what the ledger records.
- Records unchanged since P4-19, beyond the all-record mechanical checks.

---

# P4-24: #27 docs-only recheck (D1/D2)

Self-assigned by the team lead in hub issue #2 (P4-24). Target: **`e607fb940d47ac903570e29a688c0b0995339cd2`** (PR #27, open draft). Its parent is `fc844f72088521c4d0f0dcd3084fc2caf032dda2`, with no history rewrite. This is a narrow documentation recheck: the unchanged data, runtime and live sources weren't rerun. The P4-20 section above stays the record for `fc844f7`.

| Check | Result |
| --- | --- |
| Changed files `fc844f7..e607fb9` | `src/data/national/README.md` only (+32 / −14); `git diff --check` clean |
| **D1** independence wording | **Fixed.** The README now says the brands "share directory/stop-list source provenance … **not independent corroboration**", with the actual carrier **pending** and a pointer to `independentCorroboration=false`. The phrase "independent evidence sources" no longer appears. |
| **D2** overlay counts | **Fixed.** 1,550 rows / 1,374 qualified / 175 unresolved / 1 excluded, **three** sourced alias links, 1,371 choices. Raw 2,057 and canonical 2,053 associations are listed separately as neither independent-source nor verified-carrier counts. All match the P4-20 runtime verification. |
| D3 / D4 guidance | Present. Jersey City evidence is "Hudson-Bergen Light Rail, not intercity rail or coach connectivity". `getVerifiedOperators` is the raw per-row view and `getVerifiedMarketEvidence` the canonical view, with the Lexington and Macon example. |
| Historical content | The #20 operator table (1,370 / 179 / 2,047), the 2,792 / 1,891 / 901 bus-check figures and the 56-test validation are kept, under headings now labelled "Frozen PR20 operator evidence and gaps" and "Historical PR20 validation". |

**Verdict: D1 and D2 resolved on `e607fb9`. No new findings.**
