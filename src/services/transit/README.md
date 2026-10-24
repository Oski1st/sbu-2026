# OneLine wallet handoff (Person 3)

## Integration

This branch intentionally contains no scaffold, shared types, shared data, router,
or dependency changes. Main contained only documentation when implementation began.
The shared modules and scaffold are now available on Person 1's `feat/search` branch;
integrate that foundation before building this wallet in the shared app.
Person 1 must provide named `Trip`, `Leg`, and `Agency` exports from
`src/types/transit.ts`, plus a named `demoTrips: Trip[]` export from
`src/data/demoTrips.ts`, using the agreed schema. No duplicate production definitions
or invented journeys are included here.

The host app needs React, React Router, and a TSX/CSS-capable build system, all
provided by Person 1's scaffold. With React Router:

```tsx
import WalletPage from './pages/WalletPage';
// Inside your existing Routes:
<Route path="/wallet/:tripId" element={<WalletPage />} />
```

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

The tested response lacks `Access-Control-Allow-Origin`, so a normal browser may
block direct access. The default browser experience safely reports unavailable.
For browser live mode, Person 1 can supply an approved **same-origin backend proxy**:
`<WalletPage septaEndpoint="/api/transit/septa/trains" />`. That backend must fetch
the fixed official URL, return its JSON array, and use a short timeout and no stale
cache. Do not implement an arbitrary-URL proxy. No backend is added outside this
branch's authorized scope. Until this proxy is integrated, browser live mode is
not claimed as working. Do not disable CORS or use an unaffiliated public proxy.

Requests time out after six seconds, abort on unmount, and fall back on HTTP errors,
bad JSON, invalid records, access restrictions, or offline conditions. An empty
successful response is explicitly distinguished from a service outage. Failure
never generates substitute train data. A manual refresh retries the request.

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

Because main has no package manifest or shared modules, verification initially used
an isolated external harness with the agreed shared-type contract and explicitly
labeled test fixtures, not production trips. The final integration check uses
Person 1's actual `feat/search` scaffold and shared modules in a scratch checkout.
Route wiring must still be added by Person 1 when the foundation merges.

`septa.test.ts` uses the host scaffold's Vitest runner and covers response validation,
HTTP/JSON/network errors, abort, timeout, and empty feeds. External wallet integration
checks additionally exercise all four agencies, safe links, toggles, missing IDs,
empty trips, trip changes, and live versus unavailable indicators.

After merging the shared foundation, run:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test -- src/services/transit/septa.test.ts
```
