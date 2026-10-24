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

Selecting a route navigates to `/journey?trip=<id>` and sets React Router location state `{tripId, trip}`. The chosen ID is also saved locally. Import `useSelectedTrip` from `src/components/layout/TripContext.tsx` for `{selectedTrip, selectTrip}`, or read `?trip=` and look up the ID in `demoTrips`. Query parameters survive reloads and take precedence over stored selection. Invalid IDs show the choose-a-route state. Link to `/wallet?trip=<id>` to preserve selection. Direct `/journey/:tripId` links are also supported.

Keep these page contracts and the `AMTRAK` enum value when merging. No API keys or live API configuration are needed for this demo.

## Design tokens

`src/index.css` defines forest, lime, paper and sans tokens through Tailwind v4's `@theme`, with shared CSS for navigation, route cards, forms and responsive layouts. The network illustration is a local SVG and requires no third-party image service. Typography uses the system Avenir/Segoe UI stack. Keyboard focus, form labels, live results feedback, skip navigation and reduced-motion preferences are supported.
