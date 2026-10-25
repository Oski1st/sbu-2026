# Source-backed city/date timetable search

The main Search now uses published dated schedules. The original demonstration
remains at `/demo`, with its original two IDs, Oct24 sample times/fares, concept
planner, Journey and Wallet links intact. Real search never substitutes those
sample times for a missing published connection.

## Provenance and ownership

The integration branch starts at data/helper candidate30
`fe89f9ec5fc67bfdc779121143970684d649f143`, based on combined26
`35ed1965be9a2641fa31a2b8e1de60e7223260a3`. Search29
`3fa52d18aeade0488063f5a1c7d164c14054247a` and its S1/S2 follow-up
`dad01cf86b64ac8f92794345913e067b21edcc74` were conflict-free authored
cherry-picks (`ad713c8`, `54ea41c61d264ec38dc1882834bdada1650ad03d`). No source branch or PR was merged or rewritten.
The reviewed catalogue/helper snapshots are unchanged.

Direct user decisions: use real published timetables and disclose gaps; use the
source-backed catalogue without pretending every entry has verified Google Transit
coverage. There is no Google API/key/billing dependency. No device location is used.

## What is implemented

- 1,371 canonical qualified transit-place suggestions, with state, aliases, exact /
  prefix / word-start / substring ranking, bounded visible results, keyboard and
  pointer selection, Escape, editable manual input and explicit no-match feedback.
  A listed market is not proof of municipal coverage, a route or Google participation.
- Native calendar plus manually editable date/time inputs, stacked through400px.
  Submitted city/date/time/filter/order values round-trip through URL and history.
- Published Amtrak and LIRR service calendars/date exceptions and stop times.
  Queries use the origin station’s timezone. Results display each station’s timezone,
  full date and source station ID; no city-centre or rider-location assumption.
- Earliest-arrival / fewest-transfer ordering within the loaded snapshots, next7days,
  at most4boardings, up to5 feasible trade-offs. Arrival/changes/departure-dominated
  options are suppressed. This is not exhaustive all-operator/global routing or a
  guarantee of the five globally shortest journeys. No fare/inventory or realtime
  disruption feed is present; prices are not invented.
- Versioned `/itinerary/tt1-…` links reconstruct the same dated source events on a
  cold server/refresh. Stale snapshot, tampered and unavailable links fail explicitly;
  they do not silently select a sample. New searches reject past dates; saved published
  records remain readable after departure (including an ongoing overnight trip) with a
  past-departure/reference notice. The hyphenated identifier supports production
  SPA deep-link refresh without being mistaken for an asset filename.

## Sources, dates, licences and refresh

**Publication blocker:** written Amtrak GTFS redistribution permission has not been
established. The derived compressed snapshot is local-only, ignored by Git and absent
from every published branch commit. The manifest records what was actually tested;
it does not grant redistribution permission. A fresh checkout serves the reviewed
city catalogue but returns an explicit timetable-unavailable gap for dated routes.
No snapshot is installed by a build or runtime network request. The local preview
uses the privately prepared artifact. Do not release or bundle it until permission
is resolved. MTA's developer wording alone does not resolve Amtrak's terms.

The local compressed snapshot and committed manifest are under `server/data/`.
Original response SHA-256, retrieval UTC, feed version and validity remain recorded:

| Feed | Official source | Snapshot coverage |
| --- | --- | --- |
| Amtrak | https://content.amtrak.com/content/gtfs/GTFS.zip | 2026-10-25–2027-10-18 |
| LIRR | https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip | 2026-10-21–2026-11-08 |

MTA lists the static LIRR download and states its feeds are free to use at
https://www.mta.info/developers. No new logo/map/IP licence is asserted. The Amtrak
operator-hosted published ZIP is reused as a public static timetable source; no
click-through agreement, account, key, access restriction or paid service is bypassed.
No verified dated feeds are loaded for SEPTA, NJ TRANSIT, Greyhound or FlixBus.
SEPTA/NJT download/access terms require separate handling; no agreement or registration
was completed. Their directory membership and old sample edges never fill the gap.
The existing labelled SEPTA live snapshot proxy is preserved separately.

GTFS static schedules are not live running data and may change. MTA describes frequent
updates with planned changes usually covering7–10days. The app shows the snapshot’s
retrieval and valid service dates and asks riders to confirm current services.

Refresh is explicit offline preparation, not an unbounded runtime download:

1. Retrieve the two exact official HTTPS URLs with certificate validation, keeping
   each ZIP and captured `downloads.json` metadata (`name`, URL, final HTTP status,
   successful exit, UTC checkedAt, SHA-256). No secrets or rider data belong there.
2. Run `python3 scripts/build-timetables.py /path/to/saved-feed-folder`.
3. Review the manifest/source changes, mapping assertions, date coverage and tests;
   build and restart/deploy through the normal separately approved release process.

The network-free compiler verifies hashes before writing and produces deterministic
gzip bytes (`mtime=0`). It retains calendar/exception/transfer rules, agency timezone,
exact trip/route/stop IDs and pickup/drop-off restrictions. Source stop identity and
reviewed mapping radius are revalidated; changed identities fail for review. It does
not generate fares, fill missing schedules or import route shapes into the client.
Runtime uses the local compressed artifact, loaded lazily once; no feed fetch, paid
API, precise rider coordinate, logging, browser storage or external request is needed
for a timetable query. Canonical cities/date are shareable public search inputs.

## Routing constraints and transfer assumptions

Service-day epochs follow GTFS local-noon-minus12h;>24h stop times and previous service
days are retained. Calendar-date exceptions override weekdays, including feeds with
only calendar_dates. Nonexistent DST local input is rejected; repeated clock times
use the earlier occurrence with an explicit warning. Published no-pickup/no-dropoff
stops cannot be boarded/alighted. Through trains remain one boarding.

Within a feed, explicit GTFS timed/minimum/forbidden and trip-specific transfer rules
take precedence. Unspecified same-stop changes use a10minute planning buffer.
There is one explicit cross-feed complex: Amtrak NYP↔LIRR237 (Penn/Moynihan), with
15minutes as a planning assumption, not an operator guarantee or accessibility/
walking-time verification. Identity sources are the Amtrak-run GreatAmericanStations
NYP page and the official MTA Penn Station page. No arbitrary nearby station or
same-city walking link is created. All boarding points are named source stops.

Round-based timetable search retains exact trip contexts where transfer rules depend
on them. Uniform transfer contexts use sorted arrival/prefix-best-departure indexes;
feasible destination arrivals safely bound later scanning. Single-gateway feed
excursions that return to the same station are omitted when neither endpoint needs
them; this removes unnecessary commuter detours without removing useful intercity
connections. The query work limit remains2million scan/candidate steps: if exceeded,
return an explicit search-limit error instead of an incomplete “optimized” result.
The64-entry LRU keys snapshot and all result inputs and returns isolated copies.
No public cache-reset/diagnostics endpoint is exposed.

## Verification and practical limits

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
python3 src/data/national/test_ingestion.py
node scripts/verify-timetables.mjs
node scripts/verify-timetable-host.mjs
```

Deterministic tests cover an exhaustive small-grid earliest-arrival reference,
calendar exceptions, DST/nonexistent/repeated times, previous-day/>24h services,
missed/minimum/forbidden/timed transfers, pickup/drop-off restrictions, no invented
station walks, cache/ID/stale-link behavior, limits, missing operator coverage and
source-backed versus sample UI contracts. The real-feed matrix verifies exact active
source trip/stop times and cold reconstruction for Boston–Philadelphia on several
dates/times, Philadelphia↔StonyBrook, NYC–Boston, NYC–StonyBrook, Portland–Seattle,
NYC–LosAngeles and Boston–Miami, plus unsupported/ambiguous/same-place/past/invalid/
expired-coverage searches. Each successful leg matches a published source event.

Browser checks are local, not hosted deployment evidence: keyboard/pointer city
selection, Philly alias, calendar/manual dates, date-only history back/forward,
refresh and itinerary links, manual unsupported input, missing operator coverage,
and320/390px layout. Production-host checks exercise SPA deep links, JSON planning/
reconstruction, method/duplicate-query/error handling, existing SEPTA delegation and
missing assets. The original site remains unchanged until an authorized release.


### Checkpoint verification (2026-10-25)

206/206 Vitest tests in25 files, typecheck/build,3/3 Python ingestion tests,
20 real-feed cases /152 source-contract checks and17 production-host HTTP checks
passed with the local artifact. Fresh checkout without the artifact is intentionally
blocked for routing and retains1371 city suggestions. Native/browser checks cover
selection, editable dates, history, reload and gaps; no real-device or screen-reader
coverage is claimed. Independent QA and redistribution clearance remain required.
Focus and320–400px layout corrections are candidate changes; source29 stays frozen.

API: GET `/api/transit/catalogue` returns `{version,cities,feeds,limits}`;
GET `/api/transit/plan` accepts `from/to` or canonical`fromId/toId`, `date` YYYY-MM-DD,
`time` HH:mm, `mode`, `operator`, `order`, `amtrak`0/1. Duplicate/unknown keys reject.
GET `/api/transit/itinerary/:id` reconstructs the versioned dated record. Errors carry
`{error,message}` with400 invalid input,404 invalid/stale record,503 unavailable or
work-limited planning. No mutation endpoint exists. Arrival order ties use fewer
boardings, then later first departure, then stable leg digest; transfer order first
compares boardings, then the same arrival tie-break.

Local prepared artifact334842 gzip bytes /2580068 uncompressed. This is no Render
memory/cold-start or production performance result. The browser bundle includes the
existing catalogue dependencies; no total release-size approval is claimed. Prior
legacy browser harnesses need explicit `/demo` entrypoint adaptation and were not
rerun as though the new root were the old sample. Request-race browser injection,
full privacy network/storage capture, independent real-feed optimum oracle and
real-device/screen-reader matrix remain independent QA gaps.
