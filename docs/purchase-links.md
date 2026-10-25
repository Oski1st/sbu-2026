# Purchase links

Every ticket link in OneLine goes through one resolver,
`purchaseLinkForLeg(leg, searchDate, tripStart)` in `src/lib/purchase/index.ts`.
`src/components/purchase/PurchaseLink.tsx` renders the result on the Search RouteCard
details, each Journey segment, each Wallet ticket and the fallback integration Wallet.
Nothing is reserved or bought in OneLine. Each link opens the operator's own site in a
new tab, and the user confirms times and fares there.

## Which date a link uses

1. `?date=YYYY-MM-DD` on the current page, if present.
2. On Search, the date in the Search form (today by default).
3. On Journey and Wallet, the last Search date in this browser tab (sessionStorage).
4. Otherwise, today (the Search form's default). A component rendered outside the router
   uses the leg's own sample date.

The Search date applies to the trip's first departure. A later leg keeps its day offset,
so a leg that departs the next morning gets the next day. When draft #49 (planning
date/time) lands, it carries `?date=` through Search, Journey and Wallet links and shifts
the sample legs. Because the day offset is measured from the trip's first leg, both
approaches give the same date.

## Operators

| Operator | Link kind | Example URL (Search date 2026-11-12) | Verified? | Notes |
|---|---|---|---|---|
| Amtrak | `exact-purchase` + copied details | `https://www.amtrak.com/tickets/departure.html?from_ticketing_stop_time_id=%5B%22PHL%22%5D&to_ticketing_stop_time_id=%5B%22NYP%22%5D&service_date=%5B%222026-11-12%22%5D` | Yes. The team's research found that it pre-fills From/To/Date and still worked when re-opened after 6m42s. The click-through asserts the opened URL with amtrak.com routed to a local stand-in, so Amtrak was never contacted. | Each value is a URL-encoded single-item JSON array, and there are no `cmp=`/`channel=` parameters. Station codes come from the rail-map station data (Boston North Station on the Downeaster, South Station otherwise; Richmond Staples Mill Road). The trip details are still copied on click with the Search date. Note: "If Amtrak shows an error, your trip details are copied…" |
| Amtrak (no station code) | `copy-handoff` | `https://www.amtrak.com/` | Unit-tested only. No catalogue Amtrak leg lacks a code. | Opens the stable homepage and copies From, To, Date and departure time. If the clipboard is denied, a visible read-only field holds the details. |
| FlixBus | `exact-purchase` | `https://shop.flixbus.com/search?departureCity=fd509c08-0a3e-4a44-b933-79f4a9db13da&arrivalCity=c0a47c54-53ea-46dc-984b-b764fc0b2fa9&rideDate=12.11.2026&adult=1` | Yes. `feat/purchase-links-flix` checked real result counts and a re-open after 7.7 min (`docs/purchase-links/flix/`). The click-through asserts the opened URL. | City IDs are keyed by OneLine city id (22 of 24 cities). Trenton and Stony Brook have none, so they fall back to `https://www.flixbus.com/` (`official-ticket-page`), which the click-through also covers. |
| Greyhound | `exact-purchase` | `https://shop.greyhound.com/search?departureCity=eeff627f-2fda-4e75-8468-783d47955b3a&arrivalCity=c0a47c54-53ea-46dc-984b-b764fc0b2fa9&rideDate=12.11.2026&adult=1` | Yes, same evidence as FlixBus. | Shares the Flix city IDs. Falls back to `https://www.greyhound.com/`. |
| SEPTA | `exact-trip-planner` | `https://plan.septa.org/#/?fromPlace=Gray%2030th%20St%20Station%3A%3A39.95667%2C-75.18166&toPlace=Trenton%20Transit%20Center%3A%3A40.21851%2C-74.75393&date=2026-11-12&mode=WALK%2CTRANSIT` | Yes. `feat/purchase-links-commuter` checked it in Chromium on 2026-10-25 (`docs/purchase-links/commuter/`). The click-through asserts the opened URL. | SEPTA has no station-to-station web checkout, so the planner opens with both stations and the date filled in. Pay with SEPTA Key or at the station. An unknown station falls back to `https://www.septa.org/fares/`. |
| NJ TRANSIT | `exact-purchase` | `https://webtickets.njtransit.com/?origin=180&destination=0` | Yes, same commuter evidence plus the click-through. | Both stations are pre-selected. Rail tickets are not tied to a date (valid 30 days from purchase), so no date is passed. Falls back to `https://www.njtransit.com/tickets/train-tickets`. |
| LIRR | `official-ticket-page` | `https://www.mta.info/traintime` | Yes, same commuter evidence plus the click-through. | LIRR tickets are sold in the MTA TrainTime app, and no web link can pre-fill the stations. The note names the stations and the date to choose. |

Every href is checked against the operator's HTTPS domains (`src/lib/purchase/official.ts`)
before it is used. A stored `leg.purchaseUrl` is never followed.

## Labels and accessible names

Visible labels say what the link does: "Book Philadelphia → New York on FlixBus",
"Open SEPTA trip planner: …", "Buy Trenton Transit Center → New York Penn Station on NJ
TRANSIT", "Open Philadelphia, 30th Street → New York Penn Station on Amtrak (Nov 12)",
"Copy details & open Amtrak" and "Open LIRR ticket page".
Each name ends with the segment or leg number and "(opens in a new tab)". When the label
does not name the stations, the screen-reader text adds them. So the two LIRR legs in the
Wallet get different names. Each Journey segment has exactly one ticket link, outside the
collapsible details, so a collapsed segment never holds an inert copy of the link.

## Checks

- Unit tests: `src/lib/purchase/index.test.tsx` (each operator, fallbacks, Search-date
  override, day offset, domains, Amtrak format), plus `flix.test.ts` and `commuter.test.ts`.
- Click-through: `node qa/purchase-links-click.cjs http://127.0.0.1:4204 [screenshot-dir]`
  against `PORT=4204 node server/index.mjs` after `pnpm build`. Every non-local request,
  including amtrak.com, is answered by a local stand-in page, so no operator is contacted.
  It covers each operator, the Search → Journey → Wallet date hand-off, and the clipboard
  fallback: with the clipboard denied, a visible, focused, selected read-only field shows
  the details.
