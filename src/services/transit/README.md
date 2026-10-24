# OneLine wallet handoff (Person 3)

## Integration

Person 1's foundation and fixed-upstream SEPTA proxy are merged through PRs #3
and #4. Latest main (`3d94bff`) is merged into `feat/wallet` using a normal merge.
The existing `src/App.tsx` automatically loads WalletPage at `/wallet/:tripId` and
passes `septaEndpoint="/api/transit/septa/trains"`. The wallet forwards this supplied
endpoint unchanged. No alternate proxy, router, shared dependency, or global style
changes are included here.

Named `Trip`, `Leg`, and `Agency` exports come from `src/types/transit.ts`, and
`demoTrips: Trip[]` comes from `src/data/demoTrips.ts`. No duplicate production
contracts or invented journeys are included here. The shared layout owns the main
page landmark; WalletPage renders inside it.

WalletPage reads `tripId` using React Router so navigation between wallet URLs
updates the rendered trip. A host wrapper can instead pass `tripId` explicitly.
The host must serve its application shell
for direct wallet URLs. Search results should link to
`/wallet/${encodeURIComponent(trip.id)}`. Unknown/missing IDs show an empty state;
they never select an unrelated journey. Changing the trip resets its checklist.
All wallet CSS is scoped beneath `.oneline-wallet`.

Person 1's `feat/search` now extends the initial agreed `Agency` union with `AMTRAK`.
The wallet consumes that expanded shared union and supports all four agencies.
No shared types are changed in this branch. Amtrak booking/app information:
https://www.amtrak.com/mobile

## What is simulated and what is real?

- Shared `demoTrips` supplies every journey, leg, duration, and time. These are
  displayed as simulated itinerary data, never live departures or availability.
- Checklist marks are in-memory demo UI state. They reset on wallet unmount or trip
  change, do not store personal information, and cannot establish payment or validity.
- Agency links are real official information/purchase destinations. Links supplied
  by shared trip data must be HTTPS and on the matching agency's domain; otherwise
  the verified default information page is used. No payment, activation, barcode,
  QR code, boarding pass, fare quote, or ticket verification is implemented.
- SEPTA observations are real only after a successful validated request. Retrieval
  time is displayed; the feed does not supply an observation timestamp. The badge
  expires after 60 seconds and hides observations until refreshed. This is a feed
  snapshot, not a guarantee of agency freshness, a matched train, or a live journey.

## Public data investigation — checked October 24, 2026

### SEPTA

Official documentation: https://api.septa.org/

`GET https://api.septa.org/api/TrainView/index.php` returned HTTP 200 and real
Regional Rail train observations without credentials. The adapter parses train
number, line, destination, next stop, and reported delay. It does not fabricate
missing values, infer departures, or overwrite demo journey times.

The agency's direct response lacks `Access-Control-Allow-Origin`. Person 1's
existing fixed-upstream same-origin proxy solves this for the integrated app:
`/api/transit/septa/trains`. Both Vite and the production `pnpm start` server host
that endpoint. The wallet uses the endpoint supplied by App.tsx and does not add
another proxy or disable browser protections.

Production validation returned HTTP 200 with a real JSON observation array and
`Cache-Control: no-store`. The actual regional wallet rendered those observations,
retrieval time, and agency-wide/non-journey-matched labeling. The fallback remains
available on failure; a successful check is not an availability guarantee.

Requests time out after six seconds, abort on unmount, and fall back on HTTP errors,
bad JSON, invalid records, access restrictions, or offline conditions. An empty
successful response is explicitly distinguished from a service outage. Failure
never generates substitute train data. A manual refresh retries the request.
Snapshot expiry also checks elapsed time on focus, page restoration, and visibility
changes so throttled background timers cannot leave expired observations labeled live.

### MTA / LIRR

https://www.mta.info/developers publishes static LIRR GTFS schedules and links to
railroad GTFS-Realtime feeds. These need GTFS/protobuf decoding and station/trip
mapping; not added in this timebox. Static GTFS must not be called live data.
No LIRR API integration or key requirement is assumed without testing the feed.

### Amtrak

The first-party static schedule archive at
https://content.amtrak.com/content/gtfs/GTFS.zip returned HTTP 200 (ZIP, about 18 MB).
It requires GTFS parsing and calendar/station mapping; not integrated here.
No documented public live JSON API suitable for this implementation was verified.
Do not scrape booking endpoints or present static schedules as live data.

## Official ticketing references

- SEPTA payment options: https://wwww.septa.org/fares/ways-to-pay/
- NJ TRANSIT official app and ticketing: https://www.njtransit.com/app
- LIRR MTA TrainTime: https://www.mta.info/traintime
- Amtrak official booking/app information: https://www.amtrak.com/mobile

These are agency information pages, not prefilled carts. Riders select and verify
their route, date, fare product, and eligibility with the agency.

## Validation

Verified against merged main (`3d94bff`, PRs #3 and #4) in the actual feature checkout:

- `pnpm install --frozen-lockfile` completed without dependency/lockfile changes.
- `pnpm build` passed TypeScript and Vite production bundling.
- `pnpm test`: 5 suites / 30 tests passed (shared trips, existing proxy, wallet,
  snapshot freshness, and transit adapter).
- `pnpm build && pnpm start` launched the integrated production server. Real
  `/api/transit/septa/trains` response was HTTP 200, no-store, with agency records.
- Browser verification: regional-connection shows 4 legs (SEPTA, NJ TRANSIT,
  LIRR) and real agency-wide observations; amtrak-connection shows 3 legs (Amtrak,
  LIRR) with no unrelated SEPTA panel. Invalid IDs show no unrelated trip.
- Mobile 390px layout and deep-link reloads checked; no horizontal overflow.
- SEPTA, NJ TRANSIT and MTA ticket destinations returned HTTP 200. Amtrak blocks
  scripted curl access (403) but its real booking page loaded successfully in the
  browser at https://www.amtrak.com/home. No purchase was attempted.
- An external React DOM lifecycle harness verified supplied endpoint usage,
  checklist toggles/reset, trip changes, invalid IDs, live retrieval/agency labels,
  mocked outage/timeout/empty-feed states, stale background snapshots, and refresh
  recovery. Sample itinerary times remained unchanged through all feed states.
  Simulated response records are test fixtures only, never production fallbacks.

`septa.test.ts` uses the host scaffold's Vitest runner and covers response validation,
HTTP/JSON/network errors, abort, timeout, and empty feeds. External wallet integration
checks additionally exercise all four agencies, safe links, toggles, missing IDs,
empty trips, trip changes, and live versus unavailable indicators.

From this checkout, run:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm start
```

## Wallet clarity follow-up — October 24, 2026

`feat/wallet-clarity` starts from integrated main `73635ac` after the wallet and
shared shell integration merges. No shared router/backend/dependency files change.
The host's existing `/api/transit/septa/trains` endpoint is forwarded unchanged.

- Connected LIRR legs now explicitly explain that New York Penn Station to Stony
  Brook may share one through ticket. This is a coverage reminder, not a fare rule
  or a verified purchase. Unconnected legs do not get this explanation.
- Each checkbox is a per-leg demo planning note. Both checked and unchecked states
  avoid purchase claims. Each input describes its no-purchase/validity disclaimer;
  LIRR inputs also reference the through-ticket note for assistive technology.
- Feed updates use a concise atomic polite status announcement; the whole train
  list is not repeatedly announced. Retrieval uses a semantic time element with
  date, seconds and timezone. Empty/unavailable/expired/loading states differ.
- Expiry and Refresh instructions accompany successful snapshots, including empty
  feeds. Refresh remains focusable while aria-disabled during a pending request,
  retains keyboard focus, and ignores repeated activations until it settles.
- Browser checks: both demo routes at 320px (no horizontal overflow), Space checkbox
  toggling, Tab order with visible outline, Enter refresh with retained focus, and
  real observations through the existing production proxy.
- External React DOM checks: client-side regional/Amtrak switching resets marks,
  through-ticket hints persist, input help IDs resolve, pending refreshes reject
  duplicate clicks, and empty/expired/unavailable states retain honest wording.
- Regression suite: `pnpm install --frozen-lockfile`, `pnpm build`, and `pnpm test`
  passed; 5 suites / 39 tests. New cases cover both shared demo trips' connected
  LIRR hints, no purchase claims, semantic retrieval time, atomic status, and
  expired/empty/unavailable/loading output. Existing timeout and expiry tests pass.

## QA finding #4: duplicate Wallet navigation

Continued PR #8 against latest integrated main `73635ac` (already up to date).
Removed the Wallet-local OneLine / Back to journey search bar and its unused CSS.
The shared shell is the sole page navigation. The empty-state Find a journey link
now uses React Router Link; official external ticket/feed links remain external.
The Wallet root stays a div and the host supplies its main landmark.

Actual follow-up validation:

- `pnpm build` passed; `pnpm test` passed 5 suites / 42 tests. Regression cases
  cover regional, Amtrak and invalid IDs without local nav, branding or main.
- Production browser checked both demo trips at 320px and 390px: no horizontal
  overflow, one main landmark, zero Wallet-local navs, two LIRR through-ticket notes,
  and correct 4/3 planning-item counts.
- Keyboard Tab reaches ticket links with visible focus; Space toggles planning
  notes; the invalid-wallet Find a journey link is keyboard-focusable and Enter
  opens Search.
- External React DOM regression checked client-side recovery preserves the mounted
  shell's state. Trip switching/reset and existing feed lifecycle checks also pass.
- LIRR clarification, honest checklist labels, existing proxy and every feed state
  remain intact. No shared router/backend/layout/style files changed.

## Integrated-main revalidation — Person 3

Merged latest main `93c0408` into PR #8 with a normal merge. The duplicate Wallet
navigation fix and React Router recovery Link were already present and required no
further functional changes. Wallet remains a div under the host's single main.

- Locked install, production build, and all 42 tests (5 suites) pass on the new base.
- Production browser: regional and Amtrak routes, each at 320px and 390px, retain
  4/3 legs and two LIRR hints; zero local navs, one main, and no horizontal overflow.
- Reload preserves the selected Amtrak route and resets demo marks. Space toggles
  a planning note; Tab reaches the next agency link with visible focus. Keyboard
  Enter on invalid-trip recovery opens Search.
- External React DOM checks reconfirm client-side routing preserves mounted shell
  state, trip switching resets marks, and feed-state/refresh behavior stays honest.
- No new proxy, purchase logic, live-to-itinerary mutation, shared-file edits, or
  force push. Coordination uses the existing Person 3 hub report, issue #1.
