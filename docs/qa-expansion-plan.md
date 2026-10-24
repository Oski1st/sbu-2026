# East Coast expansion QA

Owner: Person 4. Feature owner: Person 1 (PR #13, `feat/east-coast`).

All results here are **PR-branch results, not `main` results.** Earlier `main` runs are in [qa-checklist.md](qa-checklist.md). Toolchain for every run: Node 22.23.4, pnpm 11.25.0, Playwright 1.64.1, a clean checkout served by `pnpm start`.

| Run | Exact commit | Contents | Result |
| --- | --- | --- | --- |
| **P4-09 (current)** | **`21d77dd618538284d77ee48db7fc34821a04bd99`** on `feat/east-coast` | PR #13 @ `d3aab9e` (expansion, X2 Search persistence, map label fix), map follow-up @ `17e3682`, PR #15 @ `2db3fed` (X1 / X3, coach guidance) | Regression and expansion fully pass. P4-09 targeted checks **55 / 57**: the 2 failures are X5 (map labels too small on phones). |
| First expansion run | `9be946d3376dc61064ad0645909e1f15f43534ad` | PR #13 head on base `main` `6df372e` | Expansion 121 / 122 (X1). Kept below as history. |

## P4-09 run: `21d77dd`

Assigned in hub issue #2 as **P4-09**. Run on October 24, 2026.

| Check | Command | Result on `21d77dd` |
| --- | --- | --- |
| Install, build | `pnpm install --frozen-lockfile && pnpm build` | Pass |
| Unit tests | `pnpm test` | **62 / 62** (10 files) |
| Regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121** |
| Proxy outage | `node qa/septa-proxy-outage.mjs` | 5 / 5 |
| Deploy smoke | `node qa/smoke.mjs` (`HOST=0.0.0.0`, LAN IP) | 6 / 6, local only |
| Demo rehearsal | `node qa/demo-rehearsal.cjs <url>`, online / `--offline` | 8 / 8 / 8 / 8 |
| Expansion suite | `node qa/expansion-check.cjs <url>` | **122 / 122** (X1 check included) |
| **P4-09 targeted** | `node qa/p4-09-check.cjs <url>` (new) | **55 / 57** (X5) |

The original demo is preserved: `/` still shows exactly `regional-connection` and `amtrak-connection`, with regional times 8:00 / 8:55 / 9:10 / 10:40 / 11:00 / 12:10 as before. Sample, live and ticket wording is unchanged and passes D1–D5 in the expansion suite.

What `qa/p4-09-check.cjs` covers:

| Area | Result |
| --- | --- |
| **X2 Search persistence** | Pass (9 / 9). The URL holds `from`, `to`, `mode`, `operator` and `sort`. Refresh keeps results, filter states, sort and form values. Back undoes sort, then the operator; Forward restores both. A shared URL opens the same results in a fresh browser. Malformed values (`mode=evil`, `operator=NOPE`, `sort=zzz`) fall back to defaults. A 500-character city is bounded and shows the unsupported-city state. Plain `/` still shows the original demo. |
| **X3 duration** | Pass. Portland → Miami shows "33h 30m total" (was "2010 min total"); regional shows "5h 15m"; Boston → Stony Brook shows "8h 35m". |
| **X1 station / time layout** | Pass at 320px and 390px. At 320px the time now stacks under the city instead of colliding ([crop](qa-screenshots/expansion/p4-09-x1-fixed-320.png)). |
| **Coach guidance** | Pass. An LIRR → coach transfer says "Boarding location: check official operator details" with no platform-board wording. A coach → LIRR transfer keeps platform guidance for the rail leg. A simulated coach delay points to operator or terminal information and stays labelled simulated. |
| **Guided flows** | Pass for bus-only (1 leg, 1 step, Next disabled), mixed coach + LIRR (3 steps), reverse (3 steps) and overnight Portland → Miami (5 steps, ending on the leg into Miami). ArrowLeft / ArrowRight move between steps, and Reset returns to the start prompt. |
| **Reduced motion** | Pass. With `prefers-reduced-motion: reduce`, Search, Journey and Wallet have no running animations or transitions, and the guided demo still works. |
| **Map** | Geography recognisable (Natural Earth states, East Coast and Florida). Cities run north-up (Portland → Boston → New York → Philadelphia → Washington, DC → Orlando → Miami), Stony Brook sits east of New York, labels stay inside the map without overlapping, and there's no page overflow at 1280 / 390 / 320px. The role="img" label and caption say "Connections unverified … not verified services or actual rail and road alignments". **No external network requests.** **Fail: labels are too small on phones (X5).** ([desktop](qa-screenshots/expansion/p4-09-map-desktop.png), [320px](qa-screenshots/expansion/p4-09-map-320-labels-too-small.png)) |
| Page or console errors | None |

Test-harness note: the first P4-09 attempt served the app on port 4190, which Node's `fetch` blocks under the WHATWG "bad port" list. That made the regression and smoke scripts fail to connect; it wasn't an app fault. Every result above comes from a re-run on port 4173.

## First expansion run: `9be946d` (history)

### Summary (`9be946d`)

| Check | Command | Result on `9be946d` |
| --- | --- | --- |
| Install, build | `pnpm install --frozen-lockfile && pnpm build` | Pass |
| Unit tests | `pnpm test` | **53 / 53** (7 files) |
| Existing browser suite (regression) | `pnpm test:e2e` | **121 / 121**, the same as `main` `ea6c065` |
| Proxy outage | `pnpm test:proxy` | 5 / 5 |
| Deploy smoke | `node qa/smoke.mjs` (`HOST=0.0.0.0`, LAN IP) | 6 / 6. Expanded deep links also return 200. Local only. |
| Demo rehearsal | `node qa/demo-rehearsal.cjs`, online / `--offline` | 8 / 8 / 8 / 8 |
| **Expansion suite** | `node qa/expansion-check.cjs <url>` (new) | **121 / 122.** The 1 failure is finding X1. |

Coordinator check (hub #2): expanded routes are clearly labelled as concepts, connections are marked unverified, and ticket handoffs go to official operator sites. **Confirmed.** See D1–D5.

## Findings

| # | Severity | Owner | Status | Finding | Reproduce | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| X5 | Low–medium: readability, phones | Search map (`src/components/search/CorridorMap.tsx`, Person 1) | **Open on `21d77dd`** | The geographic map is an SVG scaled to its container, so the 11-unit city labels render at **about 5.2px at 320px and 6.4px at 390px**; the caption is 7px. Nothing overlaps or clips, but the labels can't be read on a phone. Desktop is about 10.6px. Possible fixes: larger label font in the viewBox at narrow widths, fewer labels on mobile, or a taller mobile map. | Open `/` at 320px and look at the map labels. `node qa/p4-09-check.cjs` "city labels readable (≥10px rendered)". | [320px](qa-screenshots/expansion/p4-09-map-320-labels-too-small.png) |
| X1 | Medium: visual, 320px | Journey timeline (`SegmentCard.tsx`, Person 2) | **Resolved** by PR #15, verified on `21d77dd` | At 320px "Washington, DC" spilled 38px into the time column ("Washingto6:35 PM · Oct 24"). The time now stacks below the city. | `/journey/east-portland--miami--amtrak` at 320px | [before](qa-screenshots/expansion/bug-320-washington-dc-overlaps-time.png), [after](qa-screenshots/expansion/p4-09-x1-fixed-320.png) |
| X2 | Low: UX | Search (`SearchPage.tsx`, Person 1) | **Resolved**, verified on `21d77dd` | The search query wasn't in the URL, so a refresh returned to the default demo. Search state is now in the URL, with refresh, sharing and Back / Forward. | See P4-09 X2 checks | n/a |
| X3 | Low: readability | Journey header (Person 2) | **Resolved** by PR #15, verified on `21d77dd` | Total duration showed "2010 min total"; it now shows "33h 30m total". | `/journey/east-portland--miami--amtrak` | n/a |
| X4 | n/a | Person 3 verified | **Closed: not a defect** (Person 3, hub #3, October 24) | SEPTA links use `https://wwww.septa.org/…` (four w's). Person 3 verified these are official SEPTA pages; no replacement is required. | n/a | n/a |

The scenario tables below record the first run on `9be946d`. On `21d77dd`, every one of those scenarios passes again (expansion suite 122 / 122).

## Scenario results (`9be946d`)

"Pass" means an automated assertion in `qa/expansion-check.cjs` passed, unless the row is marked *manual*.

### A. Regression: the existing demo

| # | Scenario | Result on `9be946d` |
| --- | --- | --- |
| A1 | Default search still shows exactly `regional-connection` and `amtrak-connection` | Pass |
| A2 | `pnpm test:e2e` | Pass, 121 / 121 |
| A3 | Demo rehearsal online and `--offline` | Pass, 8 / 8 each |
| A4 | Old deep links load and survive refresh | Pass (covered by A2) |

### B. New journeys

| # | Scenario | Result on `9be946d` |
| --- | --- | --- |
| B1 | Boston → New York offers Amtrak, Greyhound and FlixBus | Pass: 3 sample connections ([desktop](qa-screenshots/expansion/b1-boston-new-york-desktop.png)) |
| B2 | Portland → Miami arrives the next day with an explicit date | Pass: 3 options arriving 5:30 / 5:40 / 6:10 PM · Oct 25. The Journey shows "Oct 25". See X3 for the duration format. |
| B3 | Boston → Stony Brook is mixed coach + LIRR | Pass: the Greyhound and FlixBus options both end on LIRR, and the "Rail + bus" filter keeps them |
| B4 | Reverse trips (New York → Boston, Miami → Portland, Stony Brook → Boston) | Pass: 3 each, all in the requested direction |
| B5 | Journey and Wallet for 6 expanded IDs | Pass: legs are listed with the operator. *Manual:* the bus legs show Greyhound / FlixBus badges ([Wallet 320px](qa-screenshots/expansion/mobile-320-wallet-boston-stony-brook-greyhound.png)). |

### C. Search input

| # | Scenario | Result on `9be946d` |
| --- | --- | --- |
| C1 | `NYC` and `New York City` | Pass |
| C2 | `DC` and `Washington, DC` | Pass |
| C3 | `  boston ` / `new york` (case and whitespace) | Pass |
| C4 | Unknown city `Atlantis` | Pass: "0 sample connections for Atlantis → Boston" and "Choose cities from our East Coast catalogue…". No invented route ([screenshot](qa-screenshots/expansion/c4-unknown-city.png)). |
| C5 | Same origin and destination (`Boston` / `boston`) | Pass: "Choose two different cities". **Show demo routes** restores the original demo. |
| C6 | Mode filters on Boston → New York | Pass: Rail only shows Amtrak; Bus only shows Greyhound and FlixBus; Rail + bus shows a clear empty state ("No matching sample is not evidence that real service is unavailable"). |
| C7 | Operator filter = Greyhound, then cleared | Pass |

### D. Data honesty

| # | Scenario | Result on `9be946d` |
| --- | --- | --- |
| D1 | Sample / concept labels on cards, results, Journey and Wallet | Pass: cards say "SAMPLE ITINERARY" and "… concept". The results disclaimer says "city-level concepts, not verified services". The Journey says "Sample route concept … not verified services" and "LIRR connection concept · changes to confirm". |
| D2 | Unknown fares | Pass: cards say "Check fares", legs say "Fare unavailable". No `$0` or `NaN` in cards or Compare, and sorting by fare keeps every result. |
| D3 | Booking links | Pass for all 6 Wallets: every ticket link is `https`, on the operator's own domain (`greyhound.com`, `flixbus.com`, `amtrak.com`, `mta.info`), `target=_blank`, `rel` includes `noopener`, no tracking parameters. The SEPTA `wwww.septa.org` links are verified official pages (X4 closed). |
| D4 | SEPTA live panel absent on expanded trips | Pass (6 / 6) |
| D5 | No live, real-time or "book now" claims | Pass. The guided demo's "does not … show live arrivals" is a correct negation. |

### E. Reloads, sharing and invalid IDs

| # | Scenario | Result on `9be946d` |
| --- | --- | --- |
| E1 | Refresh on Journey and Wallet for 6 expanded IDs | Pass |
| E2 | Fresh browser (no localStorage) opens each expanded link. **Copy preview link** copies `…/journey/east-boston--new-york--amtrak`. | Pass |
| E3 | Mistyped expanded IDs | Pass: "not found" with a link back |
| — | Refresh on a Search results page | **Returns to the default demo** (X2) |

### F. Mobile and keyboard

| # | Scenario | Result on `9be946d` |
| --- | --- | --- |
| F1 | 320px / 390px: Search (Boston → Stony Brook), Journey and Wallet for 3 expanded trips | No horizontal page overflow, and every control is named and on-screen. **Fail at 320px on the Portland → Miami Journey: city text spills into the time column** (X1). 390px passes. |
| F2 | Keyboard only: type `NYC` → `DC`, Enter, Tab to **Bus only**, Space, Tab to Choose, Enter, Tab to the Wallet link | Pass. Filters expose `aria-pressed`, with a solid focus outline. |
| F3 | Overnight date visible at 320px / 390px | Pass |
| F4 | Page or console errors across the run | None |

## Re-running

```sh
git checkout <sha> && pnpm install --frozen-lockfile && pnpm build && pnpm exec playwright install chromium
PORT=4173 pnpm start   # avoid ports Node fetch blocks, such as 4190
node qa/expansion-check.cjs http://127.0.0.1:4173 qa-results/expansion
node qa/p4-09-check.cjs http://127.0.0.1:4173 qa-results/p4-09   # X1/X2/X3, coach, guided flows, motion, map
```
