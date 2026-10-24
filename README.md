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

Person 3's wallet is compatible with the four-agency contract. Its optional SEPTA feed remains unavailable in the browser until a fixed-upstream same-origin backend proxy is deployed and passed via `septaEndpoint`. No live service or production proxy is claimed by this frontend. See their `src/services/transit/README.md` after PR #2 merges.
