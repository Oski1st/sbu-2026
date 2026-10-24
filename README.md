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
