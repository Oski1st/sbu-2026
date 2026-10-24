# OneLine QA checklist

Owner: Person 4. Last full run: **October 24, 2026**, against the production server (`pnpm build && pnpm start`).

## Combined state under test

An isolated local checkout of `main` (`3d94bff`) merged with PR #1 (`feat/journey`, `ec2a11a`) and PR #2 (`feat/wallet`, `26e88a0`). These merges were local only; nothing was merged or pushed to those branches.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm build` (tsc + Vite) | Pass |
| `pnpm test` | Pass: 3 files, 19 tests |
| Browser checks (`qa/e2e-check.cjs`) | 50 / 55 pass; the 5 failures come from findings 1–3 below |
| SEPTA proxy outage checks (`qa/septa-proxy-outage.mjs`) | 5 / 5 pass |
| Deploy smoke test (`qa/smoke.mjs`, `HOST=0.0.0.0 PORT=8080`, clean clone of `main`) | 6 / 6 pass |

## How to re-run

```sh
# Combined state: never push this scratch branch
git switch -c scratch/qa origin/main
git merge origin/feat/journey origin/feat/wallet
pnpm install --frozen-lockfile && pnpm build && pnpm test

PORT=4173 pnpm start                                        # terminal 1
node qa/e2e-check.cjs http://127.0.0.1:4173 /tmp/shots      # terminal 2, browser flow
node qa/septa-proxy-outage.mjs                              # proxy failure modes, no network needed
node qa/smoke.mjs http://127.0.0.1:4173                     # same checks used after a deploy
```

`qa/e2e-check.cjs` needs Playwright, which is **not** a project dependency. Use a global install (`NODE_PATH=$(npm root -g)`) or `npx -p playwright`. Adding Playwright to `package.json` is Person 1's call.

## Results

### Server and deep links

- [x] `/`, `/search`, `/journey/regional-connection`, `/wallet/amtrak-connection` and `/journey/bogus` return 200 with the SPA HTML.
- [x] A missing `/assets/*.js` returns 404, not HTML.
- [x] Unknown `/api/*` returns 404.
- [x] Malformed percent-encoding (`/journey/%E0%A4%A`) returns 400 and does not crash the server.

### Search → Journey → Wallet

| Check | regional-connection | amtrak-connection |
| --- | --- | --- |
| Route card on Search | Pass | Pass |
| "Choose this route" opens `/journey/:id` | Pass | Pass |
| Journey shows Philadelphia → Stony Brook | Pass | Pass |
| Journey survives a refresh | Pass | Pass |
| In-page Journey → Wallet link | **Fail** ([finding 1](#findings)) | **Fail** |
| Single `<main>` landmark | **Fail** ([finding 2](#findings)) | **Fail** |
| Header nav → `/wallet/:id` | Pass | Pass |
| Wallet leg count | Pass (4) | Pass (3) |
| Wallet agencies | Pass (SEPTA, NJ TRANSIT, LIRR) | Pass (Amtrak, LIRR) |
| SEPTA panel appears only for trips with a SEPTA leg | Pass (shown) | Pass (hidden) |
| Wallet survives a refresh | Pass | Pass |

### Invalid and missing IDs

- [x] `/journey/bogus` shows "Journey not found" with a link back to search ([screenshot](qa-screenshots/invalid-journey.png)).
- [x] `/wallet/bogus` shows "Journey not found" ([screenshot](qa-screenshots/invalid-wallet.png)).
- [x] `/wallet` with no saved selection shows the choose-a-route state.

### Mobile layouts

- [x] At both 390px and 320px, none of these pages overflows horizontally: Search, Journey and Wallet for both trips. Example screenshots: [Journey 320px](qa-screenshots/mobile-320-journey-regional-connection.png), [Wallet 320px](qa-screenshots/mobile-320-wallet-amtrak-connection.png).

### Keyboard

- [ ] **Fail:** the first Tab on a fresh load does not reach "Skip to content" ([finding 3](#findings)).
- [x] Tab reaches "Choose this route", which shows a solid focus outline.
- [x] Enter on the route link navigates, and focus lands on `#main-content` after the lazily loaded Journey renders.
- [x] Enter on a Journey segment's "View trip details" toggles `aria-expanded`.
- [x] Space on a Wallet checklist checkbox updates the progress bar.

### SEPTA proxy: live vs. unavailable

| State | How it was produced | Result |
| --- | --- | --- |
| **Live** | Real upstream through `pnpm start` | 200, `Cache-Control: no-store`, **21 records at test time**. The UI shows "Live feed fetched", the retrieval time, and "Agency-wide … not matched to your journey. Demo departure and arrival times remain simulated." ([screenshot](qa-screenshots/septa-live-panel.png)) |
| Upstream HTTP 500 | `qa/septa-proxy-outage.mjs` | 502 `septa_unavailable`, no-store |
| Network failure | same | 502 `septa_unavailable` |
| Non-array JSON | same | 502 `septa_unavailable` |
| Stalled upstream | same, 300 ms timeout | 504 `septa_timeout` |
| Valid empty feed | same | 200 `[]`, not replaced with sample trains |
| Browser sees 502 / 504 / network error | Playwright request interception | "Live data unavailable … your demo itinerary has not been updated." No trains listed ([screenshot](qa-screenshots/septa-unavailable-panel.png)) |
| Browser sees `[]` | same | "The feed returned no active trains. This does not confirm that service has stopped." |

- [x] No page errors or console errors during the full run.

## Data honesty: live vs. sample

- **Live:** only the SEPTA TrainView snapshot in the Wallet panel. It shows agency-wide Regional Rail observations that are not matched to the itinerary. The record count changes from minute to minute; 21 is an observation, not an expected value.
- **Sample:** every itinerary time, duration and fare comes from `src/data/demoTrips.ts`. A live response never changes these. The Journey "Simulate a delay" panel is labelled "a demo scenario, never a live alert."

## Findings

| # | Owner | Severity | Finding | Reproduce | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Person 2 (PR #1) | Medium: demo flow | The Journey page has no in-page link to the Wallet, so the only route to it is the header nav. | Search → "Choose this route" → scroll to the end of the Journey; no Wallet button. | [screenshot](qa-screenshots/bug-journey-end-no-wallet-cta.png) |
| 2 | Person 2 (PR #1) | Medium: a11y / visual | `JourneyPage` renders `<main>` inside the layout's `<main id="main-content">`, and draws a second "← Search routes / OneLine" bar under the site header. | Open `/journey/regional-connection` and run `document.querySelectorAll('main main').length`; it returns `1`. | [screenshot](qa-screenshots/bug-journey-nested-main-duplicate-header.png) |
| 3 | Person 1 (`App.tsx`) | Low: a11y | `NavigationEffects` also runs on first load and focuses `#main-content`, so the first Tab skips "Skip to content" and the header nav. | Load `/` fresh and press Tab once; focus lands on the "From" field. | [screenshot](qa-screenshots/bug-first-tab-skips-skip-link.png) |
| 4 | Person 3 (PR #2) | Low: visual | The Wallet draws its own "OneLine ↗ / Back to journey search" nav under the site header. Its `<a href="/">` links reload the whole page instead of using client-side navigation; the selection survives through localStorage. | Open `/wallet/regional-connection` and click "Back to journey search"; DevTools shows a document reload. | [screenshot](qa-screenshots/mobile-320-wallet-amtrak-connection.png) |
| 5 | Person 1 (`AppLayout`) | Low: copy | The footer says "No live arrival data" while the Wallet shows a live SEPTA snapshot. Suggested wording: "Sample itineraries · Live data limited to labelled SEPTA snapshots". | Open any Wallet page for a trip with a SEPTA leg and compare the footer. | n/a |
