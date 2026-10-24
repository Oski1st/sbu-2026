# OneLine QA checklist

Owner: Person 4. Last full run: **October 24, 2026**, against the production server (`pnpm build && pnpm start`) on integrated `main` at **`5efcd3b`** ("Merge reviewed OneLine ticket wallet"), which includes Search, Compare, Journey, Wallet and the SEPTA proxy.

## Summary

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass (Node 22.23.4, pnpm 11.25.0) |
| `pnpm build` (tsc + Vite) | Pass |
| `pnpm test` | Pass: 5 files, 33 tests |
| Browser checks (`qa/e2e-check.cjs`) | 102 / 105 pass; the 3 failures are open findings 2 and 3 below |
| SEPTA proxy outage checks (`qa/septa-proxy-outage.mjs`) | 5 / 5 pass |
| Deploy smoke test (`qa/smoke.mjs`, clean checkout, `HOST=0.0.0.0 PORT=8080 NODE_ENV=production`, reached over the LAN IP) | 6 / 6 pass |

## How to re-run

```sh
git switch main && git pull
pnpm install --frozen-lockfile && pnpm build && pnpm test

PORT=4173 pnpm start                                        # terminal 1
node qa/e2e-check.cjs http://127.0.0.1:4173 /tmp/shots      # terminal 2: browser flow, writes screenshots
node qa/septa-proxy-outage.mjs                              # proxy failure modes, no network needed
node qa/smoke.mjs http://127.0.0.1:4173                     # the same checks used after a deploy
```

`qa/e2e-check.cjs` needs Playwright, which is **not** a project dependency. Install it outside the repo (`npm i playwright` in a scratch folder, then `NODE_PATH=<folder>/node_modules`) or use `npx -p playwright`. Adding Playwright to `package.json` is Person 1's call.

## Results

### Server and deep links

- [x] `/`, `/search`, `/journey/regional-connection`, `/wallet/amtrak-connection` and `/journey/bogus` return 200 with the SPA HTML.
- [x] A missing `/assets/*.js` returns 404, not HTML.
- [x] Unknown `/api/*` returns 404. The proxy rejects `POST` (405) and query strings.
- [x] Malformed percent-encoding (`/journey/%E0%A4%A`) returns 400 and does not crash the server.

### Search → Compare → Journey → Wallet

Each trip was run from a fresh browser: tick both **Compare route** boxes, open **Compare routes**, then click **Choose route** in the dialog for that trip.

| Check | regional-connection | amtrak-connection |
| --- | --- | --- |
| Route card on Search | Pass | Pass |
| Compare tray shows "2 of 2 routes selected" | Pass | Pass |
| Compare dialog says times and fares are sample data | Pass | Pass |
| Dialog **Choose route** opens `/journey/:id` and closes the dialog | Pass | Pass |
| Journey shows Philadelphia → Stony Brook | Pass | Pass |
| Journey survives a refresh | Pass | Pass |
| In-page **View ticket wallet →** opens `/wallet/:id` | Pass | Pass |
| Single `<main>` landmark | **Fail** ([finding 2](#findings)) | **Fail** |
| Wallet leg count | Pass (4) | Pass (3) |
| Wallet agencies | Pass (SEPTA, NJ TRANSIT, LIRR) | Pass (Amtrak, LIRR) |
| SEPTA panel appears only for trips with a SEPTA leg | Pass (shown) | Pass (hidden) |
| Wallet survives a refresh | Pass | Pass |

Compare dialog ([desktop](qa-screenshots/compare-dialog-desktop.png), [320px](qa-screenshots/mobile-320-compare.png)):

- [x] With one route ticked, the tray says "Select one more route to compare" and **Compare routes** is disabled.
- [x] Opening the dialog moves focus inside it. Escape closes it and returns focus to **Compare routes**.
- [x] Refreshing with the dialog open reloads Search cleanly: no dialog, no tray, no errors. The comparison is not persisted, which is expected.

### Invalid and missing IDs (each also refreshed)

- [x] `/journey/bogus` and `/journey/regional-connection%20x` show "Journey not found" with **Back to search** ([screenshot](qa-screenshots/invalid-journey.png)).
- [x] `/wallet/bogus` shows "Journey not found" with **Find a journey** ([screenshot](qa-screenshots/invalid-wallet.png)).
- [x] `/journey` and `/wallet` with no saved selection show the choose-a-route state.
- [x] `/nowhere` shows "A little off the line." with **Return to search**.

### Mobile layouts and visible button text

At **390px and 320px** on Search, Journey and Wallet for both trips, plus the Compare dialog:

- [x] No horizontal overflow on any page.
- [x] Every visible button and link has a name (visible text or `aria-label`) and isn't clipped or pushed off-screen.
- [x] The Compare dialog fits the viewport (19px margins at 320px). The table scrolls inside the dialog, and **Choose route** wraps to two lines but stays fully readable.

Examples: [Search 390px](qa-screenshots/mobile-390-search.png), [Journey 320px](qa-screenshots/mobile-320-journey-regional-connection.png), [Wallet 320px](qa-screenshots/mobile-320-wallet-amtrak-connection.png).

### Keyboard

- [ ] **Fail:** the first Tab on a fresh load does not reach "Skip to content" ([finding 3](#findings)).
- [x] Space toggles a **Compare route** checkbox; Enter opens the dialog.
- [x] Tab reaches "Choose this route", which shows a solid focus outline.
- [x] Enter on the route link navigates, and focus lands on `#main-content` once the lazily loaded Journey renders.
- [x] Enter on a Journey segment's details button toggles `aria-expanded`.
- [x] Tab reaches the in-page **View ticket wallet** link, and Enter opens the Wallet.
- [x] Space on a Wallet checklist checkbox updates the progress bar.

### SEPTA states in the regional Wallet

The proxy response was simulated with Playwright request interception for every row except the first, so each state is deterministic. The browser saw no page or console errors apart from the expected failed request in the simulated failure rows.

| State | How it was produced | What the Wallet shows | Sample itinerary times |
| --- | --- | --- | --- |
| **Success (real)** | Real SEPTA upstream through `pnpm start` | "Live feed fetched", retrieval time, "Agency-wide Regional Rail observations, not matched to your journey. Demo departure and arrival times remain simulated." Up to 5 trains ([screenshot](qa-screenshots/septa-live-panel.png)) | Unchanged |
| Success (simulated) | One fake train, `QA Test Line · Train 9999` | Same labels; lists the fake train ([screenshot](qa-screenshots/septa-success.png)) | Unchanged |
| **Unavailable** | 502, 504, network abort, malformed rows | "Live data unavailable … your demo itinerary has not been updated." No trains ([screenshot](qa-screenshots/septa-502-upstream-failure.png)) | Unchanged |
| **Empty** | 200 `[]` | "The feed returned no active trains. This does not confirm that service has stopped." ([screenshot](qa-screenshots/septa-empty-feed.png)) | Unchanged |
| **Stale** | Fake browser clock moved 61 s past a successful fetch | Badge changes to "Snapshot expired · refresh to check" and the train list is hidden. **Refresh** fetches a new snapshot and shows trains again ([screenshot](qa-screenshots/septa-stale.png)) | Unchanged |

"Unchanged" means the Wallet showed the same eight itinerary times in every state: 8:00 AM, 8:55 AM, 9:10 AM, 10:40 AM, 11:00 AM, 12:10 PM, 12:25 PM and 1:15 PM.

Proxy-level failure modes (`qa/septa-proxy-outage.mjs`): upstream 500, network failure and non-array JSON return 502 `septa_unavailable`; a stalled upstream returns 504 `septa_timeout`; a valid empty feed returns 200 `[]`. All are `Cache-Control: no-store`.

- [x] No page errors or unexpected console errors during the full run.

## Data honesty: live vs. sample

- **Live observation:** only the SEPTA TrainView snapshot in the Wallet panel. It is agency-wide Regional Rail data, not matched to the itinerary, and expires after 60 seconds. Observed during the October 24 runs: **21 to 23 records** on the real feed. That count is an observation, not an expected value.
- **Sample data:** every itinerary time, duration and fare in Search, Compare, Journey and Wallet comes from `src/data/demoTrips.ts`. No SEPTA state (success, unavailable, empty or stale) changed them. The Journey "Simulate a delay" panel is labelled a demo scenario, not a live alert.

## Findings

| # | Owner | Severity | Status | Finding | Reproduce | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Person 2 (Journey) | Medium: demo flow | **Fixed** in `main` | The Journey page had no in-page link to the Wallet. It now has **View ticket wallet →**. | n/a | n/a |
| 2 | Person 2 (Journey) | Medium: a11y / visual | Open | `JourneyPage` renders `<main>` inside the layout's `<main id="main-content">` (`src/pages/JourneyPage.tsx:35`), and draws a second "← Search routes / OneLine" bar under the site header. | Open `/journey/regional-connection` and run `document.querySelectorAll('main main').length`; it returns `1`. | [screenshot](qa-screenshots/bug-journey-nested-main-duplicate-header.png) |
| 3 | Person 1 (`App.tsx`) | Low: a11y | Open | `NavigationEffects` also runs on first load and focuses `#main-content`, so the first Tab skips "Skip to content" and the header nav. | Load `/` fresh and press Tab once; focus lands past the skip link. | [screenshot](qa-screenshots/bug-first-tab-skips-skip-link.png) |
| 4 | Person 3 (Wallet) | Low: visual | Open | The Wallet draws its own "OneLine ↗ / Back to journey search" nav under the site header (`src/pages/WalletPage.tsx:49`). Its `<a href="/">` links reload the whole page instead of using client-side navigation; the selection survives through localStorage. | Open `/wallet/regional-connection` and click "Back to journey search"; DevTools shows a document reload. | [screenshot](qa-screenshots/septa-stale.png) |
| 5 | Person 1 (`AppLayout`) | Low: copy | Open | The footer says "Sample itineraries · No live arrival data" (`src/components/layout/AppLayout.tsx:62`) while the Wallet shows a live SEPTA snapshot. Suggested wording: "Sample itineraries · Live data limited to labelled SEPTA snapshots". | Open `/wallet/regional-connection` and compare the footer with the SEPTA panel. | [screenshot](qa-screenshots/septa-live-panel.png) |

None of the open findings blocks the demo. Findings 2 and 4 are visible on stage as a doubled navigation bar under the site header.
