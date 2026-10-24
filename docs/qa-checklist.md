# OneLine QA checklist

Owner: Person 4. Each run is against the production server (`pnpm build && pnpm start`) on an exact `main` commit. Findings are marked resolved only after a QA run verifies the fix.

## Run history

| Run | `main` commit | Contents | Build / tests | Browser checks | Proxy outage | Deploy smoke |
| --- | --- | --- | --- | --- | --- | --- |
| **Current** (Oct 24) | **`ea6c065`** "Merge reviewed guided Journey demo and navigation cleanup" | PRs #8 (Wallet) and #9 (Journey) merged: duplicate navigation removed, SEPTA panel reworded, guided Journey demo | Pass; **45 / 45** tests | **121 / 121** | 5 / 5 | 6 / 6 (clean checkout, `render.yaml` build command, `HOST=0.0.0.0 PORT=8080`, LAN IP) |
| **Person 1 fixes** (Oct 24) | **`93c0408`** "Merge keyboard focus, data labels and reproducible QA" | Person 1's initial-focus and footer fixes; Playwright 1.64.1 devDependency; `render.yaml` | Pass; 33 / 33 tests | **117 / 121** (see below) | 5 / 5 | 6 / 6 (clean checkout, `render.yaml` build command, `HOST=0.0.0.0 PORT=8080`, LAN IP) |
| **Interim** (Oct 24) | **`73635ac`** "Merge shared shell integration fixes" (PR #7) | Adds the one-`<main>` shell contract | Pass; 33 / 33 tests | 114 / 119 (see below) | 5 / 5 | 6 / 6 (`HOST=0.0.0.0 PORT=8080`, LAN IP) |
| Baseline (Oct 24) | `5efcd3b` "Merge reviewed OneLine ticket wallet" | Search, Compare, Journey, Wallet, SEPTA proxy | Pass; 33 / 33 tests | 102 / 105 | 5 / 5 | 6 / 6 (clean checkout, `HOST=0.0.0.0 PORT=8080`, LAN IP) |

The browser suite grew between runs, which is why the totals differ. The interim run adds one-`<main>` checks on every page, duplicate page-navigation checks and a footer-wording check. The footer check was added after the interim run, so it first runs on the final commit.

## Current run: `ea6c065`

Toolchain: Node 22.23.4, pnpm 11.25.0, Playwright 1.64.1. The app code tested is identical to `ea6c065`; the QA branch adds only docs and scripts. Commands: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`, `pnpm start`, `pnpm test:e2e`, `pnpm test:proxy`, `node qa/demo-rehearsal.cjs` (online and `--offline`). The deploy smoke test (`pnpm test:smoke`) ran against a clean checkout of `ea6c065` built with the `render.yaml` build command.

- **All 121 browser checks pass.** That includes both trip flows (Search → Compare → Journey → Wallet), one `<main>` per page, **no duplicate page navigation**, the first Tab reaching "Skip to content", focus after route changes, 320px / 390px layouts with named and unclipped buttons, invalid IDs with refresh, and the footer wording.
- **SEPTA states** (new PR #8 wording): the real feed returned **23 records** at test time. Simulated success, unavailable (502 / 504 / network / malformed), empty and stale (expires at 60 s; **Refresh feed** restores it) all pass. Sample itinerary times are unchanged in every state.
- **Demo rehearsal:** 8 / 8 steps online (panel live) and 8 / 8 with SEPTA blocked (panel unavailable).
- No page or console errors. `pnpm test:e2e` exits with code 0.
- **Finding 4 is resolved**, verified on `ea6c065`. Every QA finding is now resolved.

## Pre-merge preview: open PRs #8 and #9 (not a `main` result)

To catch problems before merge, PR #8 (Wallet, head `404c72f`) and PR #9 (Journey, head `2867ec2`) were merged locally onto `93c0408` in a scratch checkout. Nothing was pushed. **Finding 4 stays open until this is re-run on the merged `main` commit.**

- `pnpm install --frozen-lockfile`, `pnpm build`: pass. `pnpm test`: 6 files, **45 / 45**
- `pnpm test:e2e`: **121 / 121**. Both duplicate-navigation checks pass on both trips, as do landmarks, keyboard, 320px / 390px and the SEPTA states.
- `pnpm test:proxy`: 5 / 5. Demo rehearsal, online and offline: 8 / 8 each
- PR #8 rewords the SEPTA panel ("SEPTA observations retrieved / unavailable", "Refresh feed", a new loading message). The first run read the panel before it settled and failed 9 SEPTA checks. These were **script false failures, not app bugs**: each state still behaved correctly. `qa/e2e-check.cjs` now accepts the old and new wording, and the re-run against `93c0408` alone is unchanged at 117 / 121.

## Person 1 fixes run: `93c0408`

Toolchain: Node 22.23.4, pnpm 11.25.0, Playwright 1.64.1 (locked devDependency) with its Chromium. Commands: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test`, `pnpm exec playwright install chromium`, `pnpm test:e2e`, `pnpm test:proxy`, `pnpm test:smoke`. The deploy smoke test used a clean checkout of `93c0408` built with the `render.yaml` build command (`--prod=false`, `NODE_ENV=production`). This is a local run; no hosted URL exists yet.

| Area | Result |
| --- | --- |
| First Tab on a fresh load | **Pass:** reaches "Skip to content". Finding 3 is resolved. |
| Focus after route change | Pass: still moves to `#main-content` |
| Footer wording, both trips | **Pass:** "Sample itineraries · Live data limited to labelled SEPTA snapshots". Finding 5 is resolved. |
| Landmarks, Search → Compare → Journey → Wallet, invalid IDs, 320px / 390px, button text, SEPTA states | Pass, as in the interim run. The real SEPTA feed returned **24 records** at test time. Sample itinerary times are unchanged in every SEPTA state. |
| Duplicate page navigation | **Fail, 4 checks:** Journey and Wallet on both trips (finding 4, Persons 2 and 3) |
| Page or console errors | None |

`pnpm test:e2e` exits with code 1 because of the 4 finding-4 checks; that's expected until finding 4 is fixed.

## Interim run: `73635ac`

Toolchain: Node 22.23.4, pnpm 11.25.0, Chromium 145 through Playwright 1.58. The app code tested was identical to `73635ac`; the QA branch adds only docs and scripts.

| Area | Result |
| --- | --- |
| Landmarks | **Pass.** Search, Journey and Wallet for both trips, plus every invalid-ID page, have exactly one `<main>` and none nested. Finding 2 is resolved. |
| Search → Compare → Journey → Wallet, both trips | Pass, including refreshes, the in-page **View ticket wallet** link, leg counts and the SEPTA panel only on the SEPTA trip |
| Invalid IDs, each also refreshed | Pass |
| 320px / 390px layouts, button text | Pass: no overflow, and every button and link is named and unclipped |
| Keyboard | 7 of 8 pass. **Fail:** the first Tab skips "Skip to content" (finding 3; Person 1 fix pending) |
| SEPTA states (real success, simulated success / unavailable / empty / stale) | Pass. The sample itinerary times are unchanged in every state. The real feed returned **24 records** at test time. |
| Duplicate page navigation | **Fail, 4 checks:** Journey ("← Search routes") and Wallet ("Wallet navigation") on both trips (finding 4) |
| Page or console errors | None |

The rest of this document is the **baseline run on `5efcd3b`**, kept as the reference for what each check covers. Except for the differences listed above, the interim run matched it.

## Baseline summary: `5efcd3b`

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass (Node 22.23.4, pnpm 11.25.0) |
| `pnpm build` (tsc + Vite) | Pass |
| `pnpm test` | Pass: 5 files, 33 tests |
| Browser checks (`qa/e2e-check.cjs`) | 102 / 105 pass; the 3 failures were findings 2 and 3 |
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

Playwright is a locked devDependency. Run `pnpm exec playwright install chromium` once after installing dependencies.

## Baseline results: `5efcd3b`

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

Status reflects the latest verified run. "Fix pending" means a fix is in progress but not yet verified on `main`.

| # | Owner | Severity | Status | Finding | Reproduce | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Person 2 (Journey) | Medium: demo flow | **Resolved**, verified on `5efcd3b` | The Journey page had no in-page link to the Wallet. It now has **View ticket wallet →**. | n/a | n/a |
| 2 | Person 2 / Person 1 (shell) | Medium: a11y | **Resolved** by PR #7, verified on `73635ac` | `JourneyPage` rendered `<main>` inside the layout's `<main id="main-content">`. The shell now uses a `<div id="main-content">`, and each page has exactly one `<main>`. | Run `document.querySelectorAll('main').length` on any page; it returns `1`. | [baseline screenshot](qa-screenshots/bug-journey-nested-main-duplicate-header.png) |
| 3 | Person 1 (`App.tsx`) | Low: a11y | **Resolved**, verified on `93c0408` | `NavigationEffects` also runs on first load and focuses `#main-content`, so the first Tab skips "Skip to content" and the header nav. Was present through `73635ac`. | Load `/` fresh and press Tab once; focus lands past the skip link. | [screenshot](qa-screenshots/bug-first-tab-skips-skip-link.png) |
| 4 | Person 2 (Journey), Person 3 (Wallet) | Low: visual | **Resolved** by PRs #9 and #8, verified on `ea6c065` | Duplicate page navigation under the site header. Journey draws "← Search routes / OneLine" (`src/pages/JourneyPage.tsx:48`). Wallet draws "OneLine ↗ / Back to journey search" (`src/pages/WalletPage.tsx:49`), and those `<a href="/">` links reload the whole page instead of using client-side navigation. Separate from finding 2; PR #7 did not change it. | Open `/journey/regional-connection` or `/wallet/regional-connection`: a second nav bar sits under the header. Click the Wallet's "Back to journey search"; DevTools shows a document reload. | [Journey 320px](qa-screenshots/duplicate-nav-journey-320.png), [Wallet 320px](qa-screenshots/duplicate-nav-wallet-320.png) |
| 5 | Person 1 (`AppLayout`) | Low: copy | **Resolved**, verified on `93c0408` | The footer says "Sample itineraries · No live arrival data" while the Wallet shows a live SEPTA snapshot. Was present through `73635ac`. Suggested wording: "Sample itineraries · Live data limited to labelled SEPTA snapshots". | Open `/wallet/regional-connection` and compare the footer with the SEPTA panel. | [screenshot](qa-screenshots/septa-live-panel.png) |

No findings are open as of `ea6c065`.


## Person 1 integration candidate, October 24 (reported by Person 1)

Validated main `73635ac` plus QA scripts at `f9abf68` and Person 1's initial-focus/footer fixes. This is a local candidate run, not a claim that a hosted deployment exists.

- Frozen install, production build and all 33 unit tests passed (Node 24.22.1, pnpm 11.25.0, Playwright 1.64.1).
- Browser checks: **117/121 passed**. First Tab reaches Skip to content; route changes focus main; both footer checks pass. The four failures are duplicate Journey/Wallet page navigation on both trips (finding 4), assigned to Persons 2 and 3. The runner exits nonzero when checks fail.
- Proxy outage checks: **5/5 passed**. Production server smoke: **6/6 passed** on `HOST=0.0.0.0 PORT=4173` via loopback. This smoke run is local, not hosted.
- Findings 3 and 5 pass in this candidate; finding 4 remains open. Preserve the earlier baseline results above.

Playwright is now a locked development dependency. After `pnpm install --frozen-lockfile`, run `pnpm exec playwright install chromium` once to install the browser. Run `pnpm test:e2e http://127.0.0.1:4173` or `node qa/e2e-check.cjs http://127.0.0.1:4173`. Screenshots default to ignored `qa-results/screenshots/`.
