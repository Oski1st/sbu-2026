# OneLine QA checklist (draft, in progress)

Owner: Person 4. Status: **partial run on October 24, 2026.** Mobile and keyboard checks have not run yet.

## Combined state under test

An isolated checkout of `main` (`3d94bff`) merged with PR #1 (`feat/journey`, `ec2a11a`) and PR #2 (`feat/wallet`, `26e88a0`). These merges are local only; nothing was merged on GitHub.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass |
| `pnpm build` (tsc + Vite) | Pass |
| `pnpm test` | Pass: 3 files, 19 tests |

## Re-running the browser checks

```sh
pnpm build
PORT=4173 pnpm start                     # terminal 1
node qa/e2e-check.cjs http://127.0.0.1:4173 <screenshot-dir>   # terminal 2
```

`qa/e2e-check.cjs` uses Playwright. Playwright is **not** a project dependency, so install it globally or run the script with `NODE_PATH` pointing to an existing install. Adding it to `package.json` needs Person 1's sign-off.

## Results so far (production server, desktop 1440px)

### HTTP / server

- [x] Deep links `/`, `/search`, `/journey/:id`, `/wallet/:id` and `/journey/bogus` return 200 with `index.html`.
- [x] A missing `/assets/*.js` returns 404 instead of the SPA HTML.
- [x] Unknown `/api/*` returns 404.
- [x] SEPTA proxy `GET /api/transit/septa/trains` returned **live** 200 with `Cache-Control: no-store` and 21 records at test time. That count is an observation, not an expected value.
- [x] SEPTA proxy rejects a query string with 400 and POST with 405.
- [ ] Malformed percent-encoding (`/journey/%E0%A4%A`) should return 400. Not yet re-run.
- [ ] SEPTA **unavailable** state in the browser (upstream blocked or timeout). Not yet run. The unit tests cover 502 and 504.

### Search → Journey → Wallet

| Check | regional-connection | amtrak-connection |
| --- | --- | --- |
| Route card present on Search | Pass | Pass |
| "Choose this route" opens `/journey/:id` | Pass | Pass |
| Journey survives refresh | Pass | Pass |
| In-page Journey → Wallet link | **Fail** (header nav only) | **Fail** |
| No nested `<main>` landmark | **Fail** | **Fail** |
| Wallet leg count | Pass (4) | Pass (3) |
| Wallet agencies | Pass (SEPTA, NJ TRANSIT, LIRR) | Pass (Amtrak, LIRR) |
| SEPTA panel appears only when the trip has a SEPTA leg | Pass (shown) | Pass (hidden) |
| Live SEPTA data labelled as not replacing sample times | Pass | n/a |
| Wallet survives refresh | Pass | Pass |

### Invalid IDs

- [x] `/journey/bogus` shows the "Journey not found" state.
- [x] `/wallet/bogus` shows the "Journey not found" state.
- [ ] `/wallet` with no selection. Not yet run.

### Still to run

- [ ] Mobile 390px and 320px: horizontal overflow and screenshots on Search, Journey and Wallet for both trips.
- [ ] Keyboard: skip link, Tab to "Choose this route", visible focus ring, focus moves to main after navigation, Journey segment expands with Enter, Wallet checklist toggles with Space.
- [ ] No console or page errors across the whole run.

## Data honesty: live vs. sample

- **Live:** only the SEPTA TrainView snapshot in the Wallet panel. It covers agency-wide Regional Rail observations and is not matched to the itinerary.
- **Sample:** every itinerary time, duration and fare in `src/data/demoTrips.ts`. Live data never overwrites these.

## Findings to report

| # | Owner | Finding | Reproduce |
| --- | --- | --- | --- |
| 1 | Person 2 (PR #1) | The Journey page has no in-page link to the Wallet. The demo has to use the header nav. | Build combined state → Search → "Choose this route" → look for a Wallet CTA inside the Journey content; none exists. |
| 2 | Person 2 (PR #1) | `JourneyPage` renders `<main>` inside the layout's `<main id="main-content">`, which nests two main landmarks. It also renders a second "OneLine" header bar under the site header. | Open `/journey/regional-connection` and run `document.querySelectorAll('main main').length`; it returns 1. |
| 3 | Person 3 (PR #2), minor | Wallet links (`<a href="/">`) cause a full page reload instead of client-side navigation. Selection survives through localStorage, so impact is low. | On `/wallet/regional-connection`, click "Back to journey search"; the network tab shows a document reload. |

Screenshots will be attached to the reports once the full run completes.
