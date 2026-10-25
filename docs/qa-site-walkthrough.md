# OneLine site walkthrough: testing it like a rider

Date: 2026-10-25 (America/New_York). Tester: Person 4 helper agent. This was QA only; no application code was changed.

## Targets

| Label | What | Build / asset |
|---|---|---|
| **production** | https://oneline-sbu-2026.onrender.com (Render free tier) | `assets/index-j4_4uBJG.js`, `assets/index-DdmW2BIM.css` (lazy: `JourneyPage-DVRXv-Dh.js`, `WalletPage-2eJp9RGm.js`) |
| **candidate** | PR #36 head `37fdccebde92ceda02846e65fcd232c5fc7755bf`, `pnpm install --frozen-lockfile && pnpm build`, `PORT=4183 node server/index.mjs` | `assets/index-C9-5lHl1.js`, `assets/index-BtW9lAmv.css` |

Script: `qa/site-walkthrough-check.cjs` (Playwright Chromium, sequential). Raw logs and JSON results: `docs/qa/site-walkthrough/{candidate,production}-run.log` and `*-results.json`. Screenshots: `docs/qa/site-walkthrough/<target>-NN-*.png`.

```
BASE_URL=http://127.0.0.1:4183 TARGET=candidate CHECK_EXTERNAL=1 node qa/site-walkthrough-check.cjs
BASE_URL=https://oneline-sbu-2026.onrender.com TARGET=production CHECK_EXTERNAL=1 node qa/site-walkthrough-check.cjs
```

| Target | Checks | PASS | FAIL | INFO (observations) |
|---|---|---|---|---|
| candidate | 246 | 181 | 7 | 58 |
| production | 177 | 111 | 18 | 48 |

How to read the FAIL counts:
- **Candidate (7 FAILs):** default date in the past (W3), dead GitHub link (W2), a malformed-URL 400 that also accounts for the console-error and failed-request FAILs (W11), the KNOWN F1 focus ring, and one probable script timing false positive. The footer logo did not finish smooth-scrolling into view within 350 ms. I did not confirm that as a bug.
- **Production (18 FAILs):** 11 come from production running the older single-route build (W4). The rest are W2, W11 (×3, Cloudflare 520) and KNOWN F1.

Production was asleep at the first attempt and returned Render's 503 "Application loading" page. The script now polls until it gets a 200 before it starts. After it woke, it answered in under 1 s.

## Findings (sorted by severity)

| ID | Sev | Status | Target(s) | Page | Steps | Expected | Actual | Screenshot |
|---|---|---|---|---|---|---|---|---|
| W1 | Medium | NEW | both | Wallet → SEPTA service snapshot | Open `/wallet/regional-connection` (at night, 02:22 ET), wait for the feed | Trains with no estimate show "Delay not reported" | 3 of 4 trains show **"Reported delay: 999 min"**. SEPTA's `late: 999` is a "no estimate / not departed" sentinel (confirmed in raw `/api/transit/septa/trains` JSON). A rider reads it as a 16-hour delay. | `candidate-13-wallet-philly-scenic.png`, `production-13-wallet-philly-scenic.png` |
| W2 | Medium | NEW | both | Footer, every page | Click "Built together ↗" | Public project page | `https://github.com/Oski1st/sbu-2026` returns **404** to logged-out visitors (private repo). It is the only dead external link out of 47. | (any page footer) |
| W3 | Medium | NEW | candidate (production shows a fixed "Demo departure Sat, Oct 24, 2026") | Search → Journey | Load `/`: Date is pre-filled **10/24/2026**, but today is 10/25. Pick Nov 2, 2:30 PM, then Boston→New York, then Choose this route | A future default date, or a clear note that the itinerary is fixed | The default date is already in the past. There is no `min`, and `?date=2020-01-01` is accepted. After the rider picks Nov 2 14:30, the Journey shows **"8:00 AM · Oct 24"** for departure. The small print does say "Sample itinerary times do not change", but a rider still sees a past date and an ignored time. | `candidate-01-home-desktop.png`, `candidate-09-journey-boston-ny.png` |
| W4 | Medium | NEW (deploy gap) | production | Search, deep links | On production, try Boston→New York, NYC→DC, Raleigh→Charlotte, Orlando→Miami, **Philly**→Stony Brook. Change Sort, then use Back. Open `/journey/east-boston--new-york--amtrak` | The same behaviour as main/candidate | Every one of these says "We're starting with one great connection… Philadelphia → Stony Brook". "Philly" is not recognised. Searches and sort are not written to the URL, so Back leaves the page and shared search links lose the search. Concept deep links show "Journey not found". Production is serving an older build. | `production-03-boston-new-york.png`, `production-04-*.png` |
| W5 | Low | NEW | both | Journey → Manual demo | Start demo journey, then press Next step until it disables (or press Start on a 1-leg trip) | Focus stays on a usable control | `document.activeElement` becomes `<body>` when the focused Next/Previous button disables itself. Keyboard and screen-reader users lose their place. (Chrome's next Tab does reach Reset.) | `candidate-30-focus-lost-after-last-next.png` |
| W6 | Low | NEW | candidate | Search results (concept routes) | Search Boston→New York | Note aligned inside the card padding | "Concept route · Actual services, terminals and transfers unverified." sits flush against the card's left border | `candidate-03-boston-new-york.png` |
| W7 | Low | NEW | candidate | Search autocomplete | Type "Wash" or "DC" | "Washington / DC" | The option reads **"Washington, DC" + "DC"** (state shown twice) | `candidate-02-autocomplete-bos.png` (pattern) |
| W8 | Low | NEW | candidate | Search autocomplete | Type "New" or "Wash" (suggestions are open) | Warning appears only after the field is left unmatched | The amber "This is not yet a supported sample city…" warning shows mid-typing under the open list (visible as red text under To at 320 px) | `candidate-21-w320-autocomplete.png` |
| W9 | Low | NEW | candidate | Search | Type "Bostn" or "Philadelpia" | A "Did you mean Boston?" suggestion | No suggestions and 0 results. The empty state is clear and "Show demo routes" recovers. This is an enhancement, not breakage. | `candidate-04-misspelling-bostn.png` |
| W10 | Low | NEW | candidate | Search filters | Boston→NY, click "Rail + bus", then submit New York→Washington from the form | Either filters reset (as corridor shortcuts do) or the filter is called out | The filter carries over and gives **0 results** ("Try another mode or operator"). Corridor shortcuts reset filters but the form does not, which is inconsistent. | `candidate-05-filters-boston-ny.png` |
| W11 | Low | NEW | both | Deep link | Open `/journey/%E0%A4%A` (bad percent-encoding) | The app's "A little off the line" page | Candidate: raw JSON `{"error":"invalid_path"}` with HTTP 400. Production: Cloudflare/Render **520** error page. | — |
| W12 | Low | NEW | both | All | Look at the browser tab | OneLine icon | No favicon: `/favicon.ico` returns 404 and the tab shows the generic icon | — |
| W13 | Low | NEW | both | Search sidebar, phone widths | View at 320/375/390 | "Your whole trip. Finally together." | The `<br>` is hidden by CSS with no space, so it renders **"trip.Finally together."**. The "REAL OPERATORS. SAMPLE CONNECTIONS." label is 7 px on phones. | `candidate-20-w320-home.png`, `production-20-w320-home.png` |
| W14 | Low | NEW | both | Wallet header | Open any wallet | Duration format consistent with Search and Journey ("5h 15m") | "4 travel legs · Demo itinerary · **315 minutes**" | `candidate-13-wallet-philly-scenic.png` |
| W15 | Low | NEW | both | Wallet SEPTA button, SEPTA purchase URL | Hover "SEPTA payment options" | `https://www.septa.org/...` | Host is **`wwww.septa.org`** (four w's). It currently returns 200 (SEPTA wildcard), but it looks like a phishing URL and could break. | — |
| W16 | Low | NEW | candidate | Journey (1-leg concept trips) | Boston→NY Amtrak concept, then Simulate delay | Some guidance, or the lab is hidden | The card promises "See how OneLine helps when a connection is at risk", but there is no connection. Only the arrival time changes (11:55 → 12:07) and no recovery advice appears. | `candidate-12-journey-boston-ny-delay.png` |
| W17 | Low | NEW | both | Search closing banner | Inspect or click "Let's go somewhere ↗" | Accessible name contains the visible text | `aria-label="Back to search"` replaces the visible "Let's go somewhere" (WCAG 2.5.3 label-in-name). It works: scrolls to main content and appends `#main-content`. | `candidate-01-home-desktop.png` |
| F1 | (High per earlier QA) | KNOWN | both | Search form | Tab into the fields | Visible focus ring ≥3:1 | Confirmed: no outline or box-shadow on production From/To. Candidate date/time segments and a checkbox also have no outline. | — |
| F1b | — | KNOWN | both | Global | — | — | Not re-measured; still applies | — |
| S1b | — | KNOWN | both | Search date/time, 361–389 px | — | — | Not reproduced by the clipping heuristic (input values are not detected); not re-verified visually | — |
| map e2e | — | KNOWN | candidate | Map `<details>` | — | — | Closed `<details>` links have empty `innerText` in DOM dumps. Not a user-facing issue; opening the details shows all names. | — |

## What worked (both targets unless noted)

- **Cold landing:** HTTP 200, title "OneLine · A better way there", hero and h1 visible, no broken images, **zero console errors, zero third-party runtime requests** (all fonts, map and data are bundled).
- **Default trip Philadelphia → Stony Brook:** 2 sample routes before and after "Find my way". Focus moves to the results region.
- **Candidate search:**
  - Autocomplete works by mouse ("Bos" → Boston) and by keyboard (ArrowDown + Enter on "New Y"). Escape closes the list, and the list closes after a pick.
  - Aliases NYC→DC, Philly→Stony Brook, lowercase input and surrounding whitespace all work.
  - Boston→NY, NYC→Washington, Raleigh→Charlotte and Orlando→Miami each return 3 routes. Stony Brook→Philadelphia returns 3.
  - Unsupported Chicago and same-city Boston→Boston give clear empty states. "Show demo routes" recovers.
  - An empty origin is blocked by native validation. Swap works.
- **Date and time (candidate):** saved in the URL (`?date=2026-11-02&time=14%3A30`) and kept on reload. Malformed values fall back safely.
- **Sort and filters:**
  - Fastest and Lowest sample fare order correctly. Sort is in the URL on candidate.
  - "Include Amtrak" off leaves only the SEPTA/NJT/LIRR route.
  - Candidate: Rail-only, Bus-only and operator filters behave correctly with `aria-pressed`, and filters persist on reload.
- **Compare:** the shortcut opens the dialog with a correct summary ("65 minutes sooner for $15 more"). It closes with Escape, the close button and a backdrop click. The checkbox tray works (enabled at 2), and Clear works. The dialog fits at 320/375/390.
- **Corridor shortcuts (candidate):** all 4 run the search, reset filters and scroll results into view. "See all 24 cities" expands.
- **Route cards:** View/Hide route details toggles. Share/Copy link puts `/journey/<id>` on the clipboard with a clear message.
- **Journey:**
  - Correct title, h1 and duration, and the page smooth-scrolls to the top after navigation (settles at 0 within about 1 s).
  - Timeline times are coherent: 8:00 → 8:55, transfer 15 min, 9:10 → 10:40, and so on to 1:15 PM.
  - All "View trip details" toggles expand and collapse.
  - Demo controls: Start, Next ×6 (Step 7 of 7), Previous, ArrowRight shortcut and Reset all work. Buttons are disabled correctly before Start.
  - Simulate delay shows the recovery plan on multi-leg trips, and Reset simulation works.
  - The Wallet link goes to the matching `/wallet/<id>`.
- **Wallet:**
  - One ticket per leg (4 for scenic, 1 for concept routes, Greyhound and FlixBus included).
  - All operator links open in a new tab with `noopener noreferrer`.
  - The live SEPTA snapshot loaded ("observations retrieved"), and Refresh feed showed "Refreshing…" then a new snapshot.
  - The checklist counter works. Browser Back and Forward between Journey and Wallet work.
- **Header nav:** remembers the chosen trip (`/journey/amtrak-connection`, `/wallet/amtrak-connection`). The Journey and Wallet tabs and the logo all work. `/journey` and `/wallet` with no selection show helpful "start with a connection" pages.
- **Deep links in a fresh browser context, plus a reload of each:** `/`, `/journey/regional-connection`, `/journey/amtrak-connection`, `/wallet/regional-connection`, `/journey/does-not-exist` ("Journey not found" + Back to search), `/wallet/does-not-exist`, `/some/random/path` ("A little off the line."). On candidate also `/journey/east-boston--new-york--amtrak` and `/wallet/east-boston--new-york--greyhound`. All return 200 and the same h1 after reload.
- **Server edge cases:** `/assets/missing.js`, `/api/unknown` and `/.env` all return 404 (no SPA fallback, no file leak).
- **Back/Forward through two searches (candidate):** restores Boston→NY and then Raleigh→Charlotte.
- **Responsive at 320/375/390/1280** on home, results, journey and wallet: no horizontal scroll anywhere. The autocomplete list and compare dialog stay on-screen.
- **Keyboard-only:**
  - The first Tab is "Skip to content", and it moves focus to `#main-content`. The tab order is logical.
  - Candidate: a whole trip with no mouse (type "Bost", ↓, Enter, Tab Tab, type "Wash", ↓, Enter, Enter) gives 3 Boston→Washington routes. Enter on "Choose this route" opens the Journey.
- **Links:** 46 unique external links on candidate (Amtrak routes and stations, MTA, SEPTA, NJT, ArcGIS, Natural Earth, Greyhound, FlixBus). All use `target=_blank` + `rel=noreferrer`/`noopener`. Every one returned 200 except the GitHub link (W2). Every link has an accessible name.
- **Content:** no lorem/TODO/undefined/NaN text, and no typos found by the scan. Every "live", "real-time" and "guaranteed" phrase is a negation or disclaimer ("not live schedules", "never a live alert", "not … a guaranteed transfer"). Fares are labelled "Sample"/"Illustrative" or "Check fares with the operator".

## Not tested

- Real phones and tablets (only Chromium device emulation at 320/375/390), touch gestures and the on-screen keyboard covering fields.
- Safari/WebKit and Firefox, including how native date/time pickers render (the KNOWN S1b area).
- Screen readers (VoiceOver/NVDA/TalkBack). Only ARIA attributes and focus were inspected.
- Daytime SEPTA feed contents and the feed-unavailable path on the live host (the outage path is covered by `qa/septa-proxy-outage.mjs`). The 60-second snapshot expiry was not waited out.
- Whether links behave correctly after the external click (only HTTP status was checked). The clipboard was tested with a granted permission only.
- Performance and load (deliberately not tested; the free instance was walked through sequentially).
