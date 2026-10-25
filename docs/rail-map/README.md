# Contiguous-U.S. passenger rail map

Task P2-CONUS-RAIL-MAP. Base: reviewed #33 `4e415429e583792f90746ee8e4c055730e090fa4`. This is a map-only package. It does not alter trip planning, timetables, fares, Search inputs, or the separately audited national city-market database.

## What the map means

The boundaries show the 48 contiguous states and District of Columbia, north-up in Albers equal-area. Alaska/Hawaii and their inset space are removed. The lines are generalized **physical Amtrak route alignments** from the FRA/BTS National Transportation Atlas Database, rather than straight links between city centres. The selected route names are separately checked against Amtrak's passenger-service pages. Dots are source train-station coordinates, not city-centre approximations. The map is partial, static geographic information: it is not a dated service, current disruption, guaranteed train-stop/connection, or bookable itinerary claim.

No transit API is called at runtime. Public-domain source snapshots and build inputs are bundled in the repository; only generated geometry and the small audit are imported by the application. Source links open only when clicked.

## Geometry sources and rights

Retrieved 2026-10-25. Exact URLs, source-file SHA256 hashes, dataset descriptions and last-edit metadata are in `src/data/railMap/provenance.json`.

- [FRA/BTS NTAD Amtrak Routes](https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_Amtrak_Routes/FeatureServer/0): dataset description updated May 12, 2026; layer edited May 14, 2026. Single-line route geometry derived from the North American Railroad Network, WGS84/EPSG:4326. Selected OBJECTIDs: 11, 16, 20, 32, 34, 39, 48, 49.
- [Amtrak/NTAD Stations](https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_Amtrak_Stations/FeatureServer/0): October 8, 2026 snapshot. The source includes bus and train terminals: this package explicitly requires `StnType=TRAIN` for all 26 markers.
- Both federal layers explicitly state they are works of the U.S. government, unprotected by U.S. copyright and available for unrestricted public use. Their actual copyright text is preserved in metadata snapshots. This does not license agency logos; none are copied.
- [Natural Earth Admin 1](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-1-states-provinces/): 1:50m state boundaries, [public domain](https://www.naturalearthdata.com/about/terms-of-use/). Exact GitHub source URL and content hash are recorded. Its polygons are used as a geographic reference, not a precise legal boundary assertion.

No general freight-network layer was used to infer passenger service. No route named in an old dataset is automatically shown. The source's old Silver Star and Capitol Limited entries are deliberately excluded; Floridian uses its own source record. Other Amtrak corridors are not asserted absent: they are outside this selected eight-corridor audit.

## Passenger-service evidence

See `src/data/railMap/serviceAudit.json` for the bounded route and city audit. Each of the eight routes carries an official operator URL and a qualified description. The federal route records provide route-specific alignment provenance; Amtrak's published pages/directory independently describe passenger-service corridors. These descriptions do not verify every train's stops or service on a selected travel date. The former Carolinian/Piedmont page redirects to [Amtrak's current directory](https://www.amtrak.com/routes), which lists New York-Richmond-Raleigh-Charlotte. That redirect is not treated as a page establishing dated schedules.

The eight included routes are Downeaster, Northeast Regional, Amtrak Hartford Line, Empire Service, Carolinian, Palmetto, Silver Meteor and Floridian. Their complete source multipart alignments are shown, including portions beyond the 24 city markers. No missing source pieces are connected with invented segments.

Boston is an important discontinuity: Downeaster uses North Station; Northeast Regional uses South Station/Back Bay. Their distinct source endpoints are preserved. No through-rail line or transfer duration is invented between the terminals.

## Complete audit of the starting app's city scope

The starting branch contains **24 sample-routing cities**, not a national major-city database. Audit inclusion follows those stable IDs without a population cutoff. All 24 are listed in the accessible map details. 23 have a verified Amtrak TRAIN record and source-coordinate marker; Stony Brook has a documented LIRR station with missing alignment. A marker near a route does not establish that every mapped train stops there.

| Catalogue city | Train station record(s) | Qualification / missing input |
| --- | --- | --- |
| Portland, ME | POR | Downeaster / Boston North distinction |
| Boston, MA | BON, BOS, BBY | Separate north/south boarding terminals |
| Providence, RI | PVD | Amtrak train station |
| Hartford, CT | HFD | Amtrak train station |
| New Haven, CT | NHV | Union Station |
| Albany, NY | ALB | Boarding is in Rensselaer, not Albany municipality |
| New York, NY | NYP | Penn/Moynihan; LIRR geometry not asserted |
| Stony Brook, NY | Not plotted | MTA confirms Port Jefferson station; LIRR shape missing |
| Trenton, NJ | TRE | Amtrak layer only; no SEPTA/NJT geometry claim |
| Philadelphia, PA | PHL | Amtrak layer only; no SEPTA commuter shape |
| Baltimore, MD | BAL | Penn Station |
| Washington, DC | WAS | Union Station |
| Richmond, VA | RVM, RVR | Distinct stations; no municipal-boundary claim |
| Norfolk, VA | NFK | Train station, not a bus/Thruway substitute |
| Raleigh, NC | RGH | Union Station |
| Charlotte, NC | CLT | Amtrak train station |
| Fayetteville, NC | FAY | Amtrak train station |
| Charleston, SC | CHS | Boarding is in North Charleston |
| Savannah, GA | SAV | Amtrak train station |
| Jacksonville, FL | JAX | Amtrak train station |
| Orlando, FL | ORL | Amtrak train station |
| Tampa, FL | TPA | Floridian alignment; not Silver Meteor service inference |
| Fort Lauderdale, FL | FTL | Amtrak, no Brightline assertion |
| Miami, FL | MIA | Actual station location, not downtown proxy |

## Explicit coverage gaps / fallback

- **LIRR:** [MTA Stony Brook station](https://www.mta.info/stations/stony-brook) confirms Port Jefferson service. This package has no validated, permitted LIRR geometry. It does not draw a New York-Stony Brook straight-line substitute.
- **SEPTA:** [official GTFS download](https://www3.septa.org/developer/) identified; shape geometry/usage conditions have not been validated in this package. No SEPTA-branded rail line is drawn. Shared physical rail with Amtrak does not prove which SEPTA services are present.
- **NJ TRANSIT:** [official rail GTFS documentation](https://developer.njtransit.com/registration/appdoc?app=GTFS-RAIL) requires developer registration/token access. No account, permission, agreement or token was obtained; no NJT-branded alignment is inferred from Amtrak tracks.
- **Greyhound/FlixBus:** coach services, excluded from the rail layer by definition.
- No checked alignment is available here for additional nationwide cities beyond this branch's 24-city scope. The partial corridor footprint must not be presented as a complete U.S. passenger network or the complete separate national catalogue.

These are missing inputs rather than proof that service is absent. The visible map details expose the gaps. Further permitted shape ingestion can extend this package in a coordinated task without editing P3's timetable engine.

## Reproduction and preprocessing

Node 24, built-in modules only:

```sh
node src/data/railMap/build.mjs --verify     # offline, reproduces committed outputs
node src/data/railMap/build.mjs              # rebuilds from gzip source snapshots
node src/data/railMap/build.mjs --download   # intentional refresh, network required
```

Only the last command accesses external sources. Before a refresh, re-audit service semantics and set the actual retrieval date; dataset freshness and service availability are different concepts. Source metadata snapshots and hashes permit exact offline reproduction even if remote layers later change.

Each boundary/rail vertex and station uses the same Albers projection and uniform CONUS fit in an 800x420 view box. Routes preserve original multipart breaks and endpoints. Douglas-Peucker simplification uses 0.12 SVG-unit tolerance before 0.01-unit rounding (at most an additional 0.0071-unit planar error). This is a scale-dependent generalized alignment, not track-level navigation. No clipping, snapping, station-to-station interpolation or route planning is performed. 161,372 source rail vertices are reduced to 1,181 retained vertices; per-route path parts remain separate.

Native details/summary gives keyboard access to route descriptions, every city/boarding station, external evidence links and coverage gaps. HTML legend and notes stay at least 11px, do not scale with SVG, and occupy normal document flow. The map uses no animation, masks, forced fixed height, interactive focus traps or runtime external resources. Existing browser restrictions apply; responsive and assistive-technology claims require Person 4's numbered QA.

Validation results and bundle comparisons will be recorded in the draft PR after the package's checks complete. No map changes are merged or deployed by this task.
