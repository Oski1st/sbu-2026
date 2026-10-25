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
