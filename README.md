# OneLine · SBUHacks 2026

A unified journey planner across SEPTA, NJ TRANSIT, Amtrak and LIRR.

## Start

Requires Node.js 22.12+ and pnpm 11.25 (`corepack enable` on installations that include Corepack).

```sh
pnpm install
pnpm dev
pnpm build
pnpm test
```

Vite serves the app locally. Production hosting must serve `index.html` for unknown paths so BrowserRouter deep links work.

## Shared contract and team ownership

`src/types/transit.ts` exports `Agency`, `Fare`, `Leg`, and `Trip`; `src/types/index.ts` re-exports them. Agency includes `AMTRAK`. `src/data/demoTrips.ts` exports `demoTrips: Trip[]`. ISO timestamps include their timezone offset. Optional fare metadata and display labels preserve the required contract.

- Person 1: App.tsx, SearchPage.tsx, search/layout components, types/data, styling and configuration.
- Person 2: JourneyPage.tsx and components/journey/.
- Person 3: WalletPage.tsx, components/wallet/ and services/transit/.

Use short feature branches and pull requests into main. Coordinate before editing shared files. Never commit credentials.

## Data honesty

The Philadelphia → Stony Brook itineraries use real agency and station names, but **all departure times, durations and dollar amounts are illustrative sample data**. They are not valid timetables or fare quotes. LIRR changes at Huntington are separate legs; a zero-dollar continuation leg means the previous sample LIRR fare covers it. No live arrival API is connected. Agency links lead to official planning/ticket information; OneLine does not issue tickets.

Network references:

- https://www.njtransit.com/getting-new-york-train
- https://www.amtrak.com/stations/phl
- https://www.mta.info/stations/stony-brook

## Page integration for teammates

`App.tsx` automatically loads `src/pages/JourneyPage.tsx` and `src/pages/WalletPage.tsx` after those files are merged. Export a default React component (or a named `JourneyPage` / `WalletPage`) with no required props. Until then, Person 1's `components/layout/IntegrationPage.tsx` supplies an explicitly labeled preview; no teammate-owned files are created.

Selecting a route navigates to `/journey/<id>` and sets React Router location state `{tripId, trip}`. The chosen ID is also saved locally. Import `useSelectedTrip` from `src/components/layout/TripContext.tsx` for `{selectedTrip, selectTrip}`, or read the `tripId` route parameter and look up the ID in `demoTrips`. Route parameters survive reloads. Legacy `?trip=` links redirect to the canonical path and take precedence over stored selection. Invalid IDs show the choose-a-route state. Link to `/wallet/<id>` to preserve selection. Direct `/journey/:tripId` links are also supported.

Keep these page contracts and the `AMTRAK` enum value when merging. No API keys or live API configuration are needed for this demo.

## Design tokens

`src/index.css` defines forest, lime, paper and sans tokens through Tailwind v4's `@theme`, with shared CSS for navigation, route cards, forms and responsive layouts. The network illustration is a local SVG and requires no third-party image service. Typography uses the system Avenir/Segoe UI stack. Keyboard focus, form labels, live results feedback, skip navigation and reduced-motion preferences are supported.

## Integration status (October 24, 2026)

Person 2's PR #1 expects `/journey/:tripId`; Person 3's PR #2 expects `/wallet/:tripId`. Both routes are wired. Header navigation preserves the selected trip. Missing selections show a choose-a-route preview, and legacy query links redirect to the canonical path.

Before merging PR #1, Person 2 needs to add `AMTRAK` to `agencyStyles` and adapt time parsing/display to ISO 8601 timestamps (or reuse `formatTime` from `src/data/tripUtils.ts`). An isolated combined build reproduced the missing-AMTRAK TypeScript error. Their files are unchanged on this branch.

Person 3's wallet is compatible with the four-agency contract. Its optional SEPTA feed uses the fixed-upstream same-origin backend proxy below. The host router supplies `septaEndpoint`; records are agency-wide observations and do not replace the sample itinerary. See their `src/services/transit/README.md` after PR #2 merges.

## SEPTA same-origin proxy

`GET /api/transit/septa/trains` fetches only `https://api.septa.org/api/TrainView/index.php`. No API key is required. The endpoint accepts no query parameters, does not forward browser cookies or authorization, refuses redirects, caps responses at 1 MiB, and aborts after 4.5 seconds (before the wallet’s six-second timeout). Responses are not cached. Upstream failures/invalid data return 502; timeouts return 504. An empty valid feed stays an empty array. No sample trains are substituted.

The same implementation runs in all supported modes:

```sh
pnpm dev                  # Vite + proxy at http://127.0.0.1:5173
pnpm build
pnpm preview              # Vite preview + proxy
pnpm start                # Production Node host at http://127.0.0.1:3000
```

Deploy on a Node-capable host with build command `pnpm install --frozen-lockfile && pnpm build`, start command `pnpm start`, and environment `HOST=0.0.0.0` plus the host-provided `PORT`. The production server serves `dist/`, the API, and SPA deep links from one origin. It uses only Node built-ins; no new runtime package is required. A static-only upload of `dist/` does **not** provide the API; the wallet must retain its unavailable state there. No hosted deployment has been created by this change.

`App.tsx` passes `septaEndpoint="/api/transit/septa/trains"` to `/wallet/:tripId`. This connects automatically when Person 3’s Wallet PR #2 merges; their files are unchanged. Before that merge, the main-branch Wallet remains the labeled integration preview.

Validated the real endpoint through both Vite and the production host: HTTP 200 with an array of 22 observations at test time on October 24, 2026. The isolated combined checkout with PR #2 built successfully and passed 19 tests. Its browser Wallet displayed “Live feed fetched” with retrieval time, agency-wide observations, and the explicit statement that demo times remain simulated. This count is a test observation, not a fixed expected feed size.

Official source: https://api.septa.org/

## Compare and share routes

Search now includes “Compare both options” and per-route comparison checkboxes. The comparison dialog explains sample fare, total travel time, train changes, time on trains, time between trains and the shortest transfer interval. These intervals are derived from the itinerary, not live connection guarantees. Choosing either column opens its canonical Journey URL. The native modal supports Escape, focus containment and focus restoration.

Each route also offers a copyable Journey link, with a manual-copy fallback if clipboard access is unavailable. On localhost it is explicitly labeled a preview link with a deployment reminder; links only become remotely shareable once the app is hosted. No agency booking or tracking service receives these links automatically.

QA: check comparison at 320px and desktop widths, choosing from each column, closing with Escape, clearing selections, filtering out Amtrak, and copying/reopening a Journey link. Invalid timestamps and missing fares must display unavailable metrics instead of invented values.
