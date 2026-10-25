# OneLine · SBUHacks 2026

One search, one journey timeline and one ticket-planning checklist across SEPTA,
NJ TRANSIT, LIRR, Amtrak, Greyhound and FlixBus. The original demonstration is
Philadelphia → Stony Brook; the East Coast catalogue adds clearly labelled
city-level rail/coach concepts.

## Run locally

Use Node.js **22.12+** and **pnpm 11.25.0**. Run `corepack enable` if Corepack is
available in your Node installation.

```sh
pnpm install --frozen-lockfile
pnpm dev                     # http://127.0.0.1:5173
```

For the production server:

```sh
pnpm build
pnpm start                   # http://127.0.0.1:3000
```

React + TypeScript + Vite, Tailwind CSS v4 and React Router are already configured.
The UI uses daisyUI 5 (a Tailwind plugin, dev dependency) with a single custom light
`oneline` theme declared at the top of `src/index.css`, plus a few shadcn/ui-style
components copied into `src/components/ui/` (Sonner toast, Radix Tooltip) with a `cn()`
helper in `src/lib/utils.ts` (clsx + tailwind-merge). These install with the normal
`pnpm install --frozen-lockfile`; no extra setup, fonts or CDNs are needed.
The Node host serves the built app, SPA deep links and the SEPTA proxy together.
All UI/map assets are local, so a previously installed and built app works offline
with the SEPTA panel showing its honest unavailable state.

## Checks

```sh
pnpm typecheck
pnpm build
pnpm test
pnpm test:proxy
```

With a production server running, browser and smoke checks use its actual URL:

```sh
pnpm exec playwright install chromium   # once, while online
pnpm test:e2e http://127.0.0.1:3000
pnpm test:smoke http://127.0.0.1:3000
node qa/demo-rehearsal.cjs http://127.0.0.1:3000
node qa/demo-rehearsal.cjs http://127.0.0.1:3000 --offline
```

Playwright is pinned as a devDependency. There is no configured lint script;
TypeScript, build, unit tests and the relevant browser/proxy checks are the current
validation commands. QA reports record the exact tested SHA and distinguish local,
feature-branch and hosted results. See [QA checklist](docs/qa-checklist.md).

## Shared data and page contracts

`src/types/transit.ts` exports the named types `Agency`, `Leg`, `Trip`, `Fare` and
`TransportMode`; `src/types/index.ts` re-exports them. Required fields are:

- `Agency`: `SEPTA | NJ_TRANSIT | LIRR | AMTRAK | GREYHOUND | FLIXBUS`.
- `Leg`: `id`, `agency`, `line`, `from`, `to`, `departure`, `arrival`, `purchaseUrl`.
- `Trip`: `id`, `origin`, `destination`, `durationMinutes`, `legs`.

ISO departure/arrival timestamps include a timezone offset. Fare metadata, mode,
sample labels and concept-planning disclosures are optional extensions to the
shared contract. `src/data/demoTrips.ts` exports `demoTrips: Trip[]`, preserving the
`regional-connection` and `amtrak-connection` IDs. Their sample run times and fares
were corrected against official sources on 2026-10-25; see
[docs/sample-data-accuracy.md](docs/sample-data-accuracy.md).

The integrated pages are:

| URL | Behavior |
| --- | --- |
| `/` or `/search` | Search, filters, route comparison and route selection |
| `/journey/:tripId` | Person 2's timeline, manual guided demo and labelled delay simulation |
| `/wallet/:tripId` | Person 3's per-leg planning checklist and official ticket links |
| `/journey` or `/wallet` | Use the selected trip, or show a choose-a-route state |

Canonical path IDs take precedence over legacy `?trip=` parameters. Legacy
`/journey?trip=<id>` and `/wallet?trip=<id>` links redirect to canonical paths.
An unknown ID shows an explicit empty/not-found state; it never substitutes an
unrelated trip. Route IDs survive a refresh. Selecting a route also retains its ID
locally so header navigation can reopen it; checklist marks are in-memory only.
`useSelectedTrip` in `src/components/layout/TripContext.tsx` exposes the shared
selection. Search criteria/filter links persist in the URL.

The layout owns global navigation and the focusable `#main-content` container.
Search and Journey supply their own `main`; the host supplies Wallet's `main`
wrapper because Wallet returns a div. Preserve exactly one main landmark per
page. The initial Tab reaches the skip link; focus moves after route changes.
Page-level lazy loading keeps the navigation shell available.

## Sample data, live observations and ticket purchasing

**All provided itineraries, departure times, durations and fares are sample data.**
They are not verified timetables, fare quotes, connection guarantees or available
inventory. Expanded city-level concepts do not verify operator coverage, direct
service, terminal changes or rail/road alignments. Unknown fares stay unknown.
The original LIRR continuation legs can share the preceding sample fare; a
zero-dollar continuation is not a separate free ticket. Sample values that were
checked against an official source, and those still unverified, are listed in
[docs/sample-data-accuracy.md](docs/sample-data-accuracy.md).

Only the explicitly labelled **agency-wide SEPTA Regional Rail snapshot** is live.
It is not matched to a sample journey and never replaces itinerary times. It
expires after 60 seconds and supports unavailable, empty, stale and refresh
states. No live NJ TRANSIT, LIRR, Amtrak, Greyhound or FlixBus arrivals are connected.

Official links open agency booking/information sites. OneLine does not sell,
issue, activate or validate tickets. Checklist marks do not prove purchase,
payment or boarding eligibility. Confirm all real travel details with operators.

Network references: [NJ TRANSIT](https://www.njtransit.com/getting-new-york-train),
[Amtrak Philadelphia](https://www.amtrak.com/stations/phl),
[LIRR Stony Brook](https://www.mta.info/stations/stony-brook).
Map boundaries use public-domain [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)
geography bundled with the app; concept lines are not actual service alignments.

## SEPTA same-origin proxy and deployment

The host passes `/api/transit/septa/trains` to Wallet. That endpoint fetches only
`https://api.septa.org/api/TrainView/index.php`; it needs no API key. It rejects
query parameters and redirects, forwards no browser cookies/authorization, caps
responses at 1 MiB, times out after 4.5 seconds and sends `Cache-Control: no-store`.
Upstream failures return 502, timeouts 504; no sample trains replace a failed feed.
The same implementation runs in Vite development/preview and the Node host.

The public demo is <https://oneline-sbu-2026.onrender.com>. Deployment evidence and
exact revisions are tracked in [deployment notes](docs/deployment.md) and the
team hub; a feature PR is not automatically the deployed version.

Use a **Node-capable** host, build with
`corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build`,
start with `pnpm start`, and set `HOST=0.0.0.0` with the host-provided `PORT`.
`render.yaml` specifies a free Node service. A static-only upload cannot provide
the proxy and must preserve the labelled unavailable state. Do not start paid
services or commit API keys, credentials or local environment files.

See the [two-minute demo script](docs/demo-script.md),
[QA checklist](docs/qa-checklist.md), [deployment guide](docs/deployment.md),
[server notes](server/README.md) and
[Wallet adapter handoff](src/services/transit/README.md).

## UI credits / licenses

All UI dependencies are MIT-licensed and bundled locally (no runtime third-party requests):

| Package | Use | License |
| --- | --- | --- |
| [daisyUI](https://daisyui.com) 5 | Tailwind plugin; custom `oneline` theme, `btn`/`badge` | MIT |
| [shadcn/ui](https://ui.shadcn.com) | Source pattern for `src/components/ui/{sonner,tooltip}.tsx` (copied, adapted) | MIT |
| [sonner](https://sonner.emilkowal.ski) | Journey "Simulated delay" toast | MIT |
| [@radix-ui/react-tooltip](https://www.radix-ui.com) | Tooltips on icon-only Search controls | MIT |
| [clsx](https://github.com/lukeed/clsx), [tailwind-merge](https://github.com/dcastil/tailwind-merge) | `cn()` class helper | MIT |

No paid, GPL or AGPL UI kits are used. See [docs/ui-refresh.md](docs/ui-refresh.md).

## Team workflow

Use separate feature branches and PRs; do not force-push or overwrite teammates'
work. Coordinate shared changes in the private
[team hub](https://github.com/Oski1st/oneline-team-hub).

- Person 1: shared foundation, contracts, routing and integration.
- Person 2: Journey plus explicitly delegated Search/date-time/location UI and map work.
- Person 3: Wallet/transit services plus delegated catalogue and routing-performance work.
- Person 4: docs/QA/demo and deployment verification.

Keep the current release QA SHA stable while future feature PRs are in progress.
Do not describe unmerged nationwide data, autocomplete or geolocation work as
already deployed. Design tokens, responsive layout and reduced-motion styles live
in `src/index.css`; page-specific Wallet CSS stays scoped under `.oneline-wallet`.
