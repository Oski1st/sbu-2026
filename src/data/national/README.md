# Nationwide candidate catalogue — checked October 24, 2026

This is an auditable city/market directory, not nationwide routing, live service,
verified municipal-stop coverage, or proof that every major city is served.
Application Search migration belongs to Person 2. No legacy data, trip IDs, Search,
router, operator registry, dependencies or frozen expansion branch are modified.

## Consumer contract

Import `nationalCities`, `verifiedNationalCities`, `getVerifiedOperators`,
`nationalOperators`, `majorCityCandidates`, `nationalCoverageAudit` and `nationalCatalogueSources` from
`src/data/nationalCities.ts`. Exported `NationalCity`, `OperatorCoverage` and
`MarketCoverage` types document the data shape. The six operators are the existing
SEPTA, NJ_TRANSIT, LIRR, AMTRAK, GREYHOUND and FLIXBUS identities only.

- `nationalCities`: **all 1,550 audit entries**, including unresolved and excluded
  rows. Never present this whole list as verified supported origins.
- `verifiedNationalCities`: **1,370** entries with at least one qualified listing.
- `majorCityCandidates`: **343** population-benchmark rows, including the explicit
  non-incorporated exception. This set is independent of Search eligibility.
- Smaller operator-listed cities, towns, CDPs and explicitly named markets are
  eligible when verified, regardless of population. There are **1,204 additional
  directory-derived audit entries**, not a blanket population cutoff.
- `getVerifiedOperators(id)`: verified records only, always retaining qualification,
  evidence, date and observed stop names. Unknown IDs return an empty array.
- `auditStatus`: `verified` (at least one city-market listing), `unresolved` (no
  qualifying evidence recorded), or `excluded` (outside the stated inclusion rule).
  Unresolved does **not** mean unserved.
- Verified coverage uses `qualification: "city-market"` and UI wording such as
  **“Listed service area — check boarding stop.”** Exact municipal containment and
  actual operating carrier are explicitly `pending` on every record. The named
  booking brand is `marketedOperator`; partner-carrier identity is not inferred.
- Candidate `latitude`/`longitude` are rounded Census representative internal
  points, **not guaranteed downtown centres**, station locations or user positions.
  They can be far from downtown in large/irregular municipalities. The location
  helper can consume verified entries structurally as origin-city suggestions,
  preserving its approximate-distance, faraway/uncertain and confirmation labels.
  Such a suggestion is not a nearby boarding-stop guarantee. Some operator-market
  entries have no unambiguous Census match: their `coordinateMethod` explicitly
  records a rounded `operator-stop-representative` point sourced from the official
  page, not a claimed city centre. Do not relabel these as downtown coordinates.
  Ten unresolved directory places have unavailable coordinates (`null`) and are
  excluded from verified suggestions; no zero or invented point is substituted.
- All 24 existing expansion city IDs are preserved, including Portland ME,
  Albany NY and Washington DC. Other IDs use a state suffix; ambiguous names must
  be shown with state. Aliases do not merge same-name cities or metro regions.
- No routes, fares, schedules, availability or city-pair combinations are generated.
  There are no runtime requests, API keys, precise user coordinates or persistence.

## Population selection and coordinate reproduction

Latest completed Census population vintage observed on the official
[City and Town Population Totals page](https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-cities-and-towns.html)
is **Vintage 2025**, July 1, 2025 estimates released May 2026.

1. Read the national `sub-est2025.csv` (ISO-8859-1) linked in `sources.json`.
2. Select `SUMLEV == "162"` and integer `POPESTIMATE2025 >= 100000`: **343 raw rows**.
3. Join `STATE + PLACE` (preserving leading zeros) to the **2025 national places
   Gazetteer** `GEOID`. No selected row has a missing coordinate join.
4. This Census population table specially includes **Urban Honolulu CDP**. Its
   Gazetteer `LSAD=57` is non-incorporated: retain it in the audit as excluded,
   yielding **342 eligible major incorporated/consolidated-balance places**. This
   threshold is only a completeness-audit benchmark, not a Search filter.
   Consolidated balances retain the official Census name/geography; their population
   is not relabelled as a different metro or full county population.
5. Retain the 24 prior cities, adding only **3 smaller regional hubs** below/outside
   that threshold: Portland ME, Trenton NJ and Stony Brook NY. Stony Brook is a CDP,
   has a verified MTA named-station listing, and has `population: null` /
   `populationVintage: null`: no 2025 incorporated-place estimate is invented.
   Smaller verified operator-listed places are additionally admitted independently
   of that legacy-hub list. Full smaller-place completeness is not claimed for all
   six operators.
6. Gazetteer `INTPTLAT/INTPTLONG` rounded to 0.01 degrees supply representative
   points. These are public statistical geography, not personal location data.
   The [Gazetteer documentation](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html)
   and source zip URL/vintage/hash are in the manifest.

Download the two source files from the exact URLs in `sources.json`, then run:

```sh
python3 src/data/national/build_candidates.py /path/to/sub-est2025.csv \
  /path/to/2025_Gaz_place_national.zip --output /tmp/candidates.json
cmp src/data/national/candidates.json /tmp/candidates.json
```

The generator verifies both SHA-256 hashes against the frozen manifest, then emits
byte-for-byte reproducible candidates. Different source bytes require an explicit
new provenance audit. Do not silently substitute a new vintage. Census geography
scope here is the population-estimates source's states/DC; territories have no
verified operator entry and are not claimed covered by omission. Anchorage is
present but unresolved. Hawaii's non-incorporated exception is explicitly excluded.

## Operator evidence and gaps

| Marketed operator | Verified city-market records | Pending eligible entries |
| --- | ---: | ---: |
| SEPTA | 2 | 1,547 |
| NJ TRANSIT | 3 | 1,546 |
| LIRR | 2 | 1,547 |
| Amtrak | 149 | 1,400 |
| Greyhound | 563 | 986 |
| FlixBus | 1,328 | 221 |

**2,047 operator-market records**, **1,370 places with evidence**, **179 unresolved
places**, **1 excluded entry**, **zero confirmed municipal-containment records**.
Every candidate has exactly one audited state per operator. An operator's pending
count includes unreviewed evidence; it is not an exclusion from that operator's
actual network. See per-city entries for the complete verified/unresolved/excluded
coverage audit. `getVerifiedOperators` never returns pending/excluded records.

Bus process: independently read each operator's official US directory, match exact
normalized city+state (only St/Saint and Mt/Mount normalization; no nearby-city
substitution), follow its actual listed city URL, and require HTTP200 at that URL
with observed `BusStop` JSON-LD names. **2,792 city-page audit requests** were processed from the full saved US
directories; **1,891** supplied qualifying records (1,328 FlixBus / 563 Greyhound).
The remaining **901** stay pending: 816 request failures and 85 pages without
structured stop data. The two brands are independent evidence sources; a successful
FlixBus listing never verifies Greyhound membership. The
Grand Rapids MI and Columbia SC pages on both sites lacked this structured stop
evidence and remain pending. Directory page and per-city response hashes, dates and
outcomes are in `sources.json`; observed stop-name snapshots are in `coverage.json`.
This is a checked public-page snapshot, not a live API or future availability claim.

A city-market page may list stops outside the municipality. The Philadelphia pages
include Camden and Malvern; their schema locality strings cannot establish municipal
containment. Stop names are preserved without upgrading them to exact-city service.
No claim is made that FlixBus or Greyhound directly operates every listed vehicle.

Amtrak process: successfully downloaded the operator-hosted GTFS zip whose
`feed_info` version is **20261024**, service horizon **October 25, 2026 onward**.
Only stop-directory names were extracted: exact city-name/alias prefix plus <50km
from the representative point, **never municipal containment or service today**.
Ambiguous shared-name near-border assignments are removed; Kansas City MO is
separately supported by its official station-page title, not attributed to KS.
The bulk stop-directory source URL is retained rather than claiming inaccessible
station pages were checked. Public station-page HTTP requests were blocked in this
environment, and Amtrak ArcGIS returned `Token Required`; no bypass was attempted.
The feed includes connecting stops, so a record does not establish train-only
service or actual carrier. Schedules, routes, fares and departure data are not used.

Regional records use individually checked MTA/NJ TRANSIT/SEPTA station pages and
SEPTA's official Trenton Line station list. Exact source URLs, checked dates, stop
names and limits are carried on each record. No four-w SEPTA ticket URL is changed.

## Actual validation

On separate main-based data branch: locked install, TypeScript/Vite build and
56 tests passed, including 11 focused catalogue tests. Census regeneration
and byte comparison passed. Additional test totals, final PR/SHA and source audit
are reported in hub issue #1. These checks do not constitute Search UI, production,
real-device location, nationwide route or municipal-boundary validation.


## Re-running an operator audit (explicit offline preparation / manual network step)

The Python tools under this folder are never imported or executed by the website.
Use a scratch source folder containing the saved Census CSV, extracted Gazetteer
text, official `flix-directory.html` / `greyhound-directory.html`, and Amtrak GTFS
zip. Source URLs/hashes and the checked date are in `sources.json`.

```sh
python3 src/data/national/build_operator_places.py /path/to/sources --output-folder /path/to/sources
python3 src/data/national/audit_bus_pages.py /path/to/sources/national-bus-targets.json /path/to/sources
python3 src/data/national/build_operator_snapshot.py /path/to/sources
python3 src/data/national/build_coverage.py /path/to/sources
```

Only the audit step makes explicit public HTTP requests (four workers,20-second
timeout, TLS-verifying curl). Its cache stores public page evidence, never user
location. A request failure or missing structured stop listing stays pending.
Do not bypass access controls or claim a failed request proves a destination is
unserved. Date/vintage and manifest counts must be reviewed for any new snapshot.
Bus directories were scanned in full for the captured US listing snapshot;
remaining regional/Amtrak smaller-stop inventory is only partially recorded.
There is no claim every small US place is complete. Unsupported manual entries
need helpful UI feedback owned by P2, never invented routes.

The runtime module builds city/operator indexes once and creates no city-pair
itineraries. A separate routing performance PR is queued; this data-only PR does
not change the existing router or eager expansion planner.
