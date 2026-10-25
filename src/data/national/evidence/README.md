# Evidence batch 1 — catalogue follow-up

Base: frozen PR20 `d45b0d3305e154ac93c165af70ecfb6e8812f74b`.
Source checks: 2026-10-24 America/New_York; individual UTC `checkedAt`, final URL,
HTTP result, byte count and SHA-256 are in `batch1.json`. This is a data-only overlay.
The four baseline candidate/operator-place/coverage/source JSON files are unchanged
byte for byte. PR20 and combined app candidate PR26 are not modified or merged.

## Bounded selection and separate repairs

The **original** 25-row selection sorted baseline unresolved rows by missing
verified-state coverage first, then major population descending, then stable ID.
Coordinator comment6392514158 explicitly revised it: **Macon-Bibb replaces PeoriaAZ**
for P4-19 C2. `originalSelection`, `revisedSelection`, `selectionRevision` and
`preliminaryScreening` preserve both lists and Peoria's two saved-directory screens.
Peoria had no individual-page request or substantive investigation and remains
pending for a later batch. The revised sample is not described as the original
population-priority sample. There are exactly25 substantive unresolved-row reviews,
plus that separately labelled preliminary screen. No26th substantive review.

C1 DC, C4 NYC/NYP and C5 mode metadata repair already-qualified records separately;
they do not count as new unresolved investigations. All25 selected rows happen to
be major candidates; smaller verified places still qualify independently of population.
This is not exhaustive all-operator investigation or proof of no service.

| Metric | Baseline | After overlay |
| --- | ---: | ---: |
| Audit rows |1550|1550|
| Qualified audit rows |1370|1374|
| Unresolved rows |179|175|
| Excluded rows |1|1|
| Distinct qualified named markets |1370|1371|
| Raw operator/source row associations |2047|2057|
| Distinct canonical-market/brand/source associations |2047|2053|

Four audit rows resolve: **three name links**, and JerseyCity via the official
NJTRANSIT WestSideAvenue station listing (Hudson-Bergen Light Rail, not an inferred
intercity rail/coach connection). BoiseCity→Boise, Lexington-Fayette→Lexington,
and Macon-Bibb→Macon preserve all IDs, population, aliases and representative points.
Only JerseyCity adds a distinct named market. New brand/source observations are not
new physical service, municipal containment, actual-carrier, availability or route claims.

| Revised stable audit ID | State | Before / after | Result |
| --- | --- | --- | --- |
| anchorage-ak | AK | unresolved → unresolved | no qualifying evidence in bounded sources |
| aurora-co | CO | unresolved → unresolved | no qualifying evidence in bounded sources |
| henderson-nv | NV | unresolved → unresolved | no qualifying evidence in bounded sources |
| lexington-fayette-urban-county-ky | KY | unresolved → verified | sourced name-market link |
| jersey-city-nj | NJ | unresolved → verified | official NJTRANSIT station market |
| north-las-vegas-nv | NV | unresolved → unresolved | no qualifying evidence in bounded sources |
| plano-tx | TX | unresolved → unresolved | no qualifying evidence in bounded sources |
| gilbert-az | AZ | unresolved → unresolved | no qualifying evidence in bounded sources |
| chandler-az | AZ | unresolved → unresolved | no qualifying evidence in bounded sources |
| chula-vista-ca | CA | unresolved → unresolved | no qualifying evidence in bounded sources |
| glendale-az | AZ | unresolved → unresolved | Phoenix market label is not Glendale |
| irving-tx | TX | unresolved → unresolved | no qualifying evidence in bounded sources |
| chesapeake-va | VA | unresolved → unresolved | no qualifying evidence in bounded sources |
| garland-tx | TX | unresolved → unresolved | no qualifying evidence in bounded sources |
| scottsdale-az | AZ | unresolved → unresolved | no qualifying evidence in bounded sources |
| boise-city-id | ID | unresolved → verified | sourced name-market link |
| frisco-tx | TX | unresolved → unresolved | no qualifying evidence in bounded sources |
| cape-coral-fl | FL | unresolved → unresolved | no qualifying evidence in bounded sources |
| hialeah-fl | FL | unresolved → unresolved | no qualifying evidence in bounded sources |
| fontana-ca | CA | unresolved → unresolved | no qualifying evidence in bounded sources |
| moreno-valley-ca | CA | unresolved → unresolved | no qualifying evidence in bounded sources |
| grand-prairie-tx | TX | unresolved → unresolved | no qualifying evidence in bounded sources |
| overland-park-ks | KS | unresolved → unresolved | no qualifying evidence in bounded sources |
| chattanooga-tn | TN | unresolved → unresolved | listing/detail redirect conflict |
| macon-bibb-county-ga | GA | unresolved → verified | sourced name-market link |

## C1–C5 evidence and retained gaps

- **C1 — DC:** the explicit `D.C.`→`DC` state-label exception is used by the saved
  directory ingestion script. Both official Washington DC city pages return200 and
  contain stop listings. Full ingestion of the frozen directories now yields2794
  targets (2792+2), still1204 additional places; the two DC targets use existing
  `washington`. No broad punctuation/fuzzy state conversion or invented place.
- **C2 — three sourced links:** CityofBoise FY2019 annual-report page16 uses BoiseCity;
  its title/branding supplies name identity, not current service/population. The official
  Lexington homepage identifies Lexington-FayetteUrbanCountyGovernment and LexingtonKY.
  Macon-Bibb's official government homepage names its MaconGA address; operator pages
  name MaconGA. These are same named-market associations, not equal municipal/county
  polygons, all boarding stops, operating carriers or routable connections. Sources,
  dates and scope remain on each relation. NJTRANSIT JerseyCity is a separate
  qualified named-station observation with municipal/carrier fields still pending.
- **C3 — shared bus provenance:** P4-19 independently found1395 shared directory
  labels, identical stop lists for563/563 baseline Greyhound records, and no
  Greyhound-only place. Evidence report6392411912 / PR18 SHA
  `3b297e01407b3735de674560cedfe49f22797b16` is retained in the manifest. This batch
  separately confirms equal dual-brand stop-name lists for Boise,Lexington,Macon,DC.
  Every bus coverage record exposes `sourceFamily=flix-greyhound-shared-directories`
  and `independentCorroboration=false`. Two brand/URL associations **are not independent
  corroboration**, and do not verify Greyhound as the actual vehicle operator.
- **C4 — NYC/NYP:** the explicit `new-york`→GTFS stop ID **NYP** association uses the
  Amtrak GreatAmericanStations page identifying NewYorkNY/Moynihan/Penn/NYP and exact
  feed stop `Ny Moynihan Train Hall At Penn Station`. No fuzzy city-name expansion.
  Direct `amtrak.com/stations/nyp` returned**403**; its failed attempt/hash is retained,
  not bypassed or relabelled successful. The successfully retrieved official station
  identity source is supplemental; GTFS snapshot supplies the stop record.
- **C5 — mode:** all150 resulting Amtrak records have `modeEvidence` with exact stop
  IDs, route IDs/types, feed version/start-date and source hash. Mode joins are
  stops→stop_times→trips→routes on IDs; only route types/IDs are retained, no timetable,
  route geometry, fare, city-pair edges or current inventory. Original recorded stop
  names plus the original<50km representative-point disambiguation prevent PortlandME
  from acquiring PortlandOR evidence; NYC is the explicit NYP exception. This is not
  municipal containment or boarding-location verification. Results: **85rail-only,
  41rail-and-bus,23bus-only,1unverified**. `route_type=2` is rail,3bus; Amtrak branding
  alone never proves train service. Manual KansasCityMO station name has no exact
  feed-name match and remains mode-unverified. The feed version20261024 begins
  2026-10-25, so these are snapshot classifications, not evidence of service today.

Eighteen dated saved HTTP responses (including one403 and one generic redirect)
plus the reused hashed official GTFS snapshot support this batch. No new bulk feed
request/crawl, paid API or permission bypass. Source URLs/hashes remain in the ledger;
the reused feed is explicitly labelled a baseline snapshot, not a fresh retrieval.
The four frozen baseline file hashes are asserted in tests. All2047 baseline qualified
records have required city-market fields;2047 municipalCoverage and operatingCarrier
values remain explicitly pending. Pending details were not fabricated or treated as
missing required fields. New observations retain the same pending qualifications.

Chattanooga's popular-stop listing conflicts with a detail redirect to the generic
/bus page, so it stays unresolved. Phoenix-labelled PhoenixGlendale does not establish
Glendale market membership. Anchorage stays unresolved; UrbanHonoluluCDP stays excluded;
no AK/HI/territory service is inferred. Absence in a source never means no service.

## Consumer contract

- `nationalCities` and `verifiedNationalCities` retain raw audit IDs (1374 qualified).
  Existing `verifiedCityMarkets` remains a row count; use `distinctVerifiedMarkets`
  for markets. Do not copy consolidated-place geometry/population onto a linked target.
- Future choices should use **`verifiedMarketChoices`** (1371), selecting the existing
  target `boise-id`, `lexington-ky`, or `macon-ga` once. No UI is changed here.
- `sameMarketAsCityId` is optional and only follows the three explicit sourced links.
  `getCanonicalMarketCityId` returns undefined for unknown IDs. Validation rejects
  unknown/cross-state/self/duplicate/cyclic links and missing/invalid dated provenance.
- `getVerifiedOperators` keeps raw per-row observations. `getVerifiedMarketEvidence`
  deduplicates exact marketedOperator/sourceURL pairs within the explicit class,
  retaining evidenceCityIds and the latest observation; it does not infer operators
  from a metro, nearby stop, region or agency union. The2053 distinct associations
  remain **brand/source counts**, not independent-source or verified-carrier counts.
- Read `sourceFamily`, `independentCorroboration` and `modeEvidence` alongside the
  city-market/municipal/carrier qualifications. A bus-only or unverified Amtrak record
  must not be labelled train service. Rail evidence also does not prove a pair's route,
  today's departures, ticket stock or the rider's exact boarding stop.

## Reproduction and validation

```sh
python3 src/data/national/evidence/build_batch1.py /path/to/saved/batch1-responses
python3 src/data/national/test_ingestion.py
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The network-free builder consumes captured `attempts.json`, response HTML/PDF,
reviewed Boise page16 extraction, and the sibling `amtrak-GTFS.zip`. It verifies
response hashes and frozen feed hash before regeneration. Exact byte reproduction
uses the saved task inputs (`work/catalogue-batch1`, sibling feed), not fresh pages
whose bytes may change. Full HTML/PDF/GTFS files are not bundled into application data;
all dated URLs/hashes, observations, both selections and positive/negative outcomes
are committed. CityofBoise PDF extraction was read locally after a web-reader size
limit; no alternate source or access bypass was used.

Baseline reproduction to original2792 targets remains historical; intentionally fixed
DC ingestion generates2794 to a separate output folder and does not rewrite frozen
JSON files. Batch overlay reproduction is byte-identical from captured inputs.
Targeted regressions cover original/revised selection, DC ingestion, three links and
operator dedup/no accidental union, explicit NYP, failed403, all Amtrak modes and
same-name cross-state disambiguation. Final actual checks and full PR/SHA are reported
in hub issue1; the follow-up freezes for coordinator-assigned P4-20 review.

Actual handoff checks: locked install passed; **67/67 Vitest tests in8 files**,
**3/3 Python ingestion regressions**, TypeScript/Vite build, diff whitespace check,
byte-identical batch regeneration and four frozen-JSON byte comparisons all passed.
Saved-directory ingestion separately verified2794 targets including both DC brands.
No browser, service-completeness, production-performance or deployment claim.
