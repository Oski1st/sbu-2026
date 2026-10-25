# P4-36: CONUS passenger-rail map acceptance and source-audit protocol

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-36`). Map owner: Person 2 (the owner authorized a separate CONUS / passenger-rail map branch from #33). **This is a plan, not a result.** The candidate SHA is **PENDING**, every implementation check is **NOT RUN**, and nothing here declares a map pass.

## Planning baseline (#33, not a candidate)

| Item | Value on #33 `4e415429e583792f90746ee8e4c055730e090fa4` |
| --- | --- |
| Map files | `src/components/search/CorridorMap.tsx`, `mapProjection.ts`, `src/data/buildUsOverviewMap.mjs`, `src/data/usOverviewMap.json`, `src/data/eastCoastMap.json` |
| Geography source | Natural Earth 1:50m Admin 1 (public domain). Snapshot 2026-10-24, `sourceSha256` `69a0e06e640b2d505858ae1cb63034e4677f3000b35a98e16312932b98c426b9`. 49 contiguous entries (48 states + DC) plus **Alaska and Hawaii insets**. 135,290 bytes. |
| Projection | Albers equal-area, north-up (P4-17 fixed the earlier X7 vertical mirror) |
| Main JS | `index-sWwrd8Ot.js`: 452,497 bytes raw, **147,484 bytes `gzip -9`** (the size baseline for the new map) |
| Prior harness | `qa/p4-15-map-check.cjs` (69 checks, P4-15 / P4-17). Reused here with **no-inset** expectations replacing the AK/HI inset checks. |

## Two kinds of evidence, never interchangeable

- **Alignment:** where the track physically runs. Evidence: a licensed railway geometry dataset.
- **Service:** that a **passenger** operator actually runs scheduled trains on that segment. Evidence: the operator's published timetable or GTFS, or an official route page.

A line drawn from real railway geometry doesn't prove passenger service. A passenger route on an operator site doesn't prove the drawn geometry is accurate. **Each mapped segment needs both** (or must be labelled as a schematic or unverified concept).

## Acceptance matrix

Severity if it fails: **Blk** = release blocker, **Hi**, **Med**, **Low**. Kind: **D** = data/script, **B** = browser, **P5** = real device / screen reader.

| # | Claim | Required source evidence | Observable failure condition | Kind | Sev |
| --- | --- | --- | --- | --- | --- |
| M1 | **CONUS only, no insets** | Data has no AK / HI / territory features; the build script filters them out | Any `alaska` / `hawaii` / territory geometry, inset frame, or "not to scale" inset note is present | D+B | Hi |
| M2 | Projection and orientation | Projection name and parameters in the data manifest | West→east or north→south order wrong (P4-15 / 17 state-pair checks: WA above CA, ND above TX, ME north-east, the Florida peninsula pointing south); aspect ratio implausible | D+B | Blk |
| M3 | Basemap provenance | URL, version, retrieval date, SHA-256, licence for every geography input | Any input without a hash or licence, or a hash that doesn't match a fresh download | D | Blk |
| M4 | **Rail geometry provenance and licence** | Dataset name, publisher, URL, version/date, SHA-256 and **licence that allows redistributing derived geometry** (e.g. a government open-data or ODbL dataset, with any attribution it requires shown in the UI) | No licence, a non-redistributable licence, or a missing attribution line in the UI | D+B | **Blk** |
| M5 | Preprocessing reproducibility | Build script + saved inputs → committed output; simplification tolerance and CRS documented | Rebuild isn't **byte-identical**, or the tolerance isn't stated | D | Hi |
| M6 | **Actual alignment vs schematic** | Each drawn segment carries a geometry-source ID or a `schematic: true` flag | A segment drawn as real track has no geometry-source ID; a straight city-to-city line without a schematic label; a sampled path more than *T* km from the source geometry (*T* set from the stated simplification tolerance) | D+B | Blk |
| M7 | **Passenger service evidence** | For each displayed passenger corridor: operator, route name, an official timetable / GTFS route or route page, and a check date | A corridor shown as passenger service with no operator evidence; a freight-only line shown as passenger | D | **Blk** |
| M8 | Freight-only / bus / catalogue exclusions | The classification rule and a list of excluded segments | Freight-only track, Amtrak Thruway / intercity bus, or **catalogue directory membership** used as evidence of passenger rail (P4-19 / 28: directory membership ≠ service; 23 Amtrak listings are bus-only) | D | Blk |
| M9 | City / station mappings | Each city marker maps to a named station with its operator stop ID and coordinates, and the representative-point caveat (P4-19) | A marker with no station ID; a station placed more than the stated tolerance from the source coordinates; a city shown as served by a corridor with no station on it | D+B | Hi |
| M10 | **Missing corridors disclosed** | A list of known gaps (operators not loaded, e.g. NJ TRANSIT / SEPTA access gaps per P3), visible as a text note | The map implies national completeness; no visible "not shown / not verified" note | B | Hi |
| M11 | Accessible legend and descriptions | Legend outside any mask fade. `role="img"` (or equivalent) with a name that says what the map is and isn't. A text alternative listing corridors and cities. | Missing or insufficient name; legend only conveyed by colour; contrast < 3:1 for lines and markers (SC 1.4.11) or < 4.5:1 for text (SC 1.4.3); focusable elements inside a decorative image | B | Hi |
| M12 | Small-screen readability | — | At **320 / 375 / 390 px**: text < 11 px, overlapping labels, clipped legend, or page overflow (P4-15 harness rules) | B | Hi |
| M13 | Offline, bundle and runtime requests | — | **Any runtime third-party request** (tiles, fonts, APIs); main JS gzip growth over the #33 baseline (147,484 B) beyond the budget the owner sets; geometry not bundled or lazy-loaded as documented | B+D | Blk (requests) / Med (size) |
| M14 | No service claims | Wording review | The map implies live service, schedules, fares, Google Transit coverage, or that a line means a bookable connection | B | Blk |
| M15 | Regression | — | Search, Journey and Wallet controls regress. Rerun e2e 121, canonical 52, P4-28 / 29 / 30 Journey scripts, and the P4-35 focus checks if the map adds focusable UI. | B | Blk |
| M16 | Real devices / screen readers | — | Not run by P4 (Chromium only). The SVG/text alternative needs testing in VoiceOver / TalkBack / NVDA. | P5 | Med |

## Source-audit worksheet (P2 to fill in; P4 verifies)

| Input | Publisher / dataset | URL | Version / date retrieved | SHA-256 | Licence (exact name + link) | Redistribution of derived data allowed? (quote) | Attribution text shown in UI | Used for |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Basemap (states) | | | | | | | | CONUS outline |
| Rail geometry | | | | | | | | alignments (M6) |
| Passenger service evidence (one row per operator) | | | | | | | | service (M7) |
| Station coordinates / IDs | | | | | | | | markers (M9) |

**Per-segment table** (one row per drawn line):

| Segment ID | From station | To station | Geometry source + feature IDs | Schematic? | Operator | Service evidence URL + check date | Notes / gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Recheck procedure (when Person 6 assigns a frozen map SHA)

1. **Entry gate:** PR open and frozen; full head/base; patch-id provenance from #33; changed paths limited to the map scope; worksheet filled in.
2. **Data:** verify hashes and licences against fresh downloads (no access bypass), rebuild byte-identically, and audit the per-segment table (M3–M10). Sample at least 10 segments against their sources, stratified across operators and long vs short segments, and record their IDs.
3. **Browser:**
   - Run the adapted `p4-15-map-check.cjs` (no-inset expectations, state-order checks).
   - Run new checks for M1, M6 (schematic labels), M10, M11, M13 (request log), M14 and M12 at 320 / 375 / 390 px.
   - Record bundle size against 147,484 B gzip.
4. **Regression:** M15 suites.
5. Report PASSED / FAILED / NOT RUN separately, with P5 gaps listed.

## Preserved: P4-35 correction / retest checklist for P3's later candidate

From `docs/qa-p4-35-search-focus.md` (QA #18 `9f0466a` / `7850c0e`), to run unchanged on P3's frozen candidate:
- **Focus contrast:** From/To/Date/Time indicators ≥ 2 px and ≥ 3:1 against `#ffffff` and `#fbfcf8`. The global `:focus-visible` ≥ 3:1 (currently 2.94:1).
- **Script:** rerun `qa/p4-35-search-focus-check.cjs`; expect every row ≥ 3:1 with `:focus-visible` true.
- **S1b:** date/time fully readable at every width from 320 to 400 px. Rerun `qa/p4-27-search-polish-check.cjs` with the S1 sweep extended.
- **Combobox:** rerun `qa/p4-25-search-check.cjs`; behaviour unchanged.

## Missing inputs (needed from P2 / the owner)

- **R1:** the chosen rail-geometry dataset and its redistribution licence and attribution requirements (M4).
- **R2:** passenger-service evidence per operator, and the rule for excluding freight-only and Thruway / bus segments (M7, M8).
- **R3:** the simplification tolerance *T* and the station-placement tolerance (M5, M6, M9).
- **R4:** the owner's bundle-size budget for the map (M13).
- **R5:** whether segments without full geometry may be shown as labelled schematics, or must be omitted (M6).
