# East Coast expansion QA

Owner: Person 4. Feature owner: Person 1 (PR #13, `feat/east-coast`).

All results here are **PR-branch results, not `main` results.** Earlier `main` runs are in [qa-checklist.md](qa-checklist.md). Toolchain for every run: Node 22.23.4, pnpm 11.25.0, Playwright 1.64.1, a clean checkout served by `pnpm start`.

| Run | Exact commit | Contents | Result |
| --- | --- | --- | --- |
| **P4-14 (current, final integration)** | **`49742e76a289f2cf5d396cc66ead01d0ab56c62f`** on `feat/demo-readiness` (PR #21) | `main` `db454c0` + combined `21d77dd` + map fix `af5fa8f` + Person 1's canonical route-ID fix, tests, README and `typecheck` script | **All pass.** Map 69 / 69; canonical-ID checks 52 / 52; full regression passes. |
| P4-13 | `af5fa8f27904694aaf5de8b4edcfdd68b3d1856d` on `fix/mobile-map-labels` (PR #19) | `961f568` + X6 follow-up (legend moved below the map, Miami mobile label raised) | **All pass.** Regression and expansion pass; targeted map checks **69 / 69**. X5 and X6 resolved. |
| P4-11 | `961f568dd039d67e04c45b7c3ea4d4e7268eed6c` on `fix/mobile-map-labels` (PR #19) | `21d77dd` + PR #19's CorridorMap / `index.css` mobile label fix | Regression and expansion fully pass. P4-11 targeted map checks **65 / 69**: X5 label sizes are fixed; the 4 failures are new finding X6. |
| P4-09 | `21d77dd618538284d77ee48db7fc34821a04bd99` on `feat/east-coast` | PR #13 @ `d3aab9e` (expansion, X2 Search persistence, map label fix), map follow-up @ `17e3682`, PR #15 @ `2db3fed` (X1 / X3, coach guidance) | Regression and expansion fully pass. P4-09 targeted checks **55 / 57**: the 2 failures are X5 (map labels too small on phones). |
| First expansion run | `9be946d3376dc61064ad0645909e1f15f43534ad` | PR #13 head on base `main` `6df372e` | Expansion 121 / 122 (X1). Kept below as history. |

## P4-14 run: `49742e7` (final integration)

Assigned in hub issue #2 as **P4-14**. Run on October 24, 2026 from a clean checkout of `49742e76a289f2cf5d396cc66ead01d0ab56c62f`. Ancestry verified: it contains `db454c0`, `21d77dd` and `af5fa8f`. App change since `af5fa8f`: `TripContext.tsx` now resolves `tripId ?? ?trip=`, so the path wins (plus a new `TripContext.test.tsx`). Also changed: `package.json` (`typecheck` script), README and docs.

| Check | Command | Result on `49742e7` |
| --- | --- | --- |
| Install, build, typecheck | `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck` | Pass |
| Unit tests | `pnpm test` | **68 / 68** (11 files) |
| Regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121** |
| Proxy outage / deploy smoke | `node qa/septa-proxy-outage.mjs` / `node qa/smoke.mjs` (LAN IP) | 5 / 5 / 6 / 6 |
| Demo rehearsal | online / `--offline` | 8 / 8 / 8 / 8 |
| Expansion suite | `node qa/expansion-check.cjs <url>` | **122 / 122** |
| Map (X5 / X6) | `node qa/p4-09-check.cjs <url>` (legend-wrapper lookup from P4-13) | **69 / 69** |
| **Canonical route IDs** | `node qa/p4-14-check.cjs <url>` (new) | **52 / 52** |

**X5 / X6 verdict:** still resolved on the integrated tree (320px labels 13.1px, legend 11px outside the masked box, 10 / 10 markers named, no Miami collision).

**Canonical route-ID cases (browser, on load and after refresh):**

- **Conflicting path and query:** `/journey/regional-connection?trip=amtrak-connection` and `/wallet/…` show **regional** content (Wallet 4 legs with the SEPTA panel; Journey 4 segments). Header Journey / Wallet links stay `/…/regional-connection`, and **View ticket wallet** opens the regional Wallet. The same holds for `amtrak-connection?trip=regional-connection` and for an expansion ID (`east-boston--new-york--greyhound?trip=regional-connection`). ([Journey](qa-screenshots/expansion/p4-14-journey-canonical-wins.png))
- **Legacy entry still works:** `/journey?trip=…` and `/wallet?trip=…` land on `/…/<id>` with that trip's content and header links.
- **Invalid canonical ID never substitutes:** `/journey/bogus?trip=amtrak-connection`, `/wallet/bogus?trip=…` and `/…/east-boston--atlantis--greyhound?trip=…` show "not found". No Amtrak legs appear, and no header or in-page link points to `amtrak-connection`. ([Wallet](qa-screenshots/expansion/p4-14-wallet-invalid-no-substitution.png))
- **Stored selection:** choosing Amtrak on Search, then opening `/journey/regional-connection`, shows regional. `/wallet` with no ID then follows the stored Amtrak selection.
- **Control:** on `af5fa8f` (before the fix) the same script fails **20 of 52**. Header links follow the query, and the Wallet substitutes the query trip for invalid IDs. So the checks detect the defect the fix addresses.

Script corrections made during this run (no assertions removed): the Amtrak content check matched "Amtrak" case-sensitively while the Journey badge reads "AMTRAK"; Journey content is now identified by segment count plus a case-insensitive operator match. The stored-selection case now chooses the route on Search, because direct Journey URLs don't store a selection by design.

## P4-13 run: `af5fa8f`

Assigned in hub issue #2 as **P4-13**. Run on October 24, 2026 from a clean checkout of `af5fa8f27904694aaf5de8b4edcfdd68b3d1856d`. The diff from `961f568` touches only `CorridorMap.tsx` and `index.css`: the legend now sits in a `.corridor-map-wrap` wrapper **below** the masked `.corridor-map` box, and the Miami mobile label moved up (y 393 → 365).

| Check | Command | Result on `af5fa8f` |
| --- | --- | --- |
| Install, build | `pnpm install --frozen-lockfile && pnpm build` | Pass |
| Unit tests | `pnpm test` | **62 / 62** (10 files) |
| Regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121** |
| Proxy outage / deploy smoke | `node qa/septa-proxy-outage.mjs` / `node qa/smoke.mjs` (LAN IP) | 5 / 5 / 6 / 6 |
| Demo rehearsal | online / `--offline` | 8 / 8 / 8 / 8 |
| Expansion suite | `node qa/expansion-check.cjs <url>` | **122 / 122** |
| **Targeted (map)** | `node qa/p4-09-check.cjs <url>` | **69 / 69** |

**X5 and X6 verdict: both resolved on `af5fa8f`.**

- **Phones (320 / 390px):** visible mobile labels at 13.1 / 16.2px. The legend is 11px, names all 10 markers, and sits **outside** the masked map box (at 320px the map ends at 732px and the legend runs 738–797px). The "Connections are illustrative and unverified." line is fully legible. No label collides with the legend; Miami is clear.
- **Desktop (1280px):** unchanged. Labels at 10.6px (P4-09 floor 10px), the caption "Natural Earth geography · Connections unverified" is visible, and the legend is hidden.
- **Unchanged:** marker positions (north-up; Stony Brook marker east of New York's), no overflow, no external network requests. Original demo flows pass in the regression and expansion suites.
- Evidence: [320px](qa-screenshots/expansion/p4-13-map-legend-320.png), [390px](qa-screenshots/expansion/p4-13-map-legend-390.png).

**Cosmetic note (not a failure; for Person 2's judgement):** on phones the desktop label leader lines are still drawn while their labels are hidden, so short lines near Philadelphia, Raleigh and Charleston point to empty space. Those cities are named in the legend. Hiding the leader lines with the desktop labels would tidy it.

**Harness change for P4-13** (needed because the legend moved; validated on all three targets):

1. The legend is found inside the map box **or** its wrapper (`m.parentElement`). Before this, the harness couldn't see a legend placed below the map and reported it missing (59 / 63 on the first run here); that was a harness limitation, not an app defect.
2. The mask-fade check now tests the legend against the **map's own mask** even when the mask is on a sibling element, and only counts text that lies inside the masked box. Before this, a sibling mask would have let the check pass without testing anything.

Control results on the updated harness: `21d77dd` **61 / 63** (X5 label sizes still fail), `961f568` **65 / 69** (X6 collision and fade still fail), `af5fa8f` **69 / 69**. The earlier failures stay recorded below.

## P4-11 run: `961f568`

Assigned in hub issue #2 as **P4-11**. Run on October 24, 2026 from a clean checkout of `961f568dd039d67e04c45b7c3ea4d4e7268eed6c`. The diff from `21d77dd` touches only `src/components/search/CorridorMap.tsx` and `src/index.css`.

| Check | Command | Result on `961f568` |
| --- | --- | --- |
| Install, build | `pnpm install --frozen-lockfile && pnpm build` | Pass |
| Unit tests | `pnpm test` | **62 / 62** (10 files) |
| Regression browser suite | `node qa/e2e-check.cjs <url>` | **121 / 121** |
| Proxy outage / deploy smoke | `node qa/septa-proxy-outage.mjs` / `node qa/smoke.mjs` (LAN IP) | 5 / 5 / 6 / 6 |
| Demo rehearsal | online / `--offline` | 8 / 8 / 8 / 8 |
| Expansion suite | `node qa/expansion-check.cjs <url>` | **122 / 122** |
| **Targeted (map)** | `node qa/p4-09-check.cjs <url>` (adjusted, see below) | **65 / 69.** All 4 failures are X6. |

**X5 verdict: label size fixed, but the release is still not clean because of X6.**

- **Fixed (X5):** on phones the desktop labels are hidden, and 6 mobile labels (Boston, New York, Washington, DC, Orlando, Miami, Stony Brook) render at **13.1px at 320px and 16.2px at 390px**, at or above P4-11's 11px. A visible legend at 11px names all 10 markers (10 / 10), and the visible text says connections are "illustrative and unverified".
- **Unchanged:** marker positions (the coordinates in the diff are untouched). Markers run north-up, Stony Brook's marker is east of New York's, and there are no external network requests or page overflow at 1280 / 390 / 320px.
- **New failure (X6):** see Findings. The legend sits inside the map's fixed-height, bottom-masked box, so it collides with the Miami label and its "unverified" line fades out ([320px](qa-screenshots/expansion/p4-11-x6-legend-overlaps-miami-and-fades-320.png), [390px](qa-screenshots/expansion/p4-11-x6-legend-overlaps-miami-and-fades-390.png), [whole map 320px](qa-screenshots/expansion/p4-11-map-320.png)).

**Harness adjustments for P4-11** (documented as Person 1 asked; each was validated against the old `21d77dd`, which still fails X5 on the adjusted harness at 61 / 63):

1. Only **rendered** labels count. The map now keeps hidden duplicate labels per breakpoint, and the old code let a hidden duplicate overwrite a visible label by name.
2. Geography is checked on **marker circles**, not labels, because mobile labels are offset for space (the mobile "Stony Brook" label sits left of "New York" while its marker is east).
3. Label floor: **11px at phone widths** (P4-11); desktop keeps P4-09's **10px** floor (renders 10.6px, unchanged by #19).
4. Overlap tolerance: glyph boxes may touch by **up to 4px**. "New York" and "Stony Brook" are stacked with 3px of box padding touching and read clearly as two lines.
5. Every marker must be named in visible text (its own label or the legend). The "unverified" wording may come from whichever of the caption or legend is visible.
6. New checks: the legend must not collide with labels, and must not sit inside a `mask-image` fade. Computed styles drop the default `to bottom` direction, so a direction-less gradient is treated as vertical.

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
| X6 | Medium: readability and disclosure, phones | Search map (`CorridorMap.tsx` / `index.css`, PR #19, Person 2) | **Resolved** by `af5fa8f`, verified in P4-13 (legend below the masked box; no Miami collision). Was open on `961f568`. | The new `.map-city-legend` is absolutely positioned at the bottom **inside** `.corridor-map`, which on phones is a fixed 276px tall and has `mask-image: linear-gradient(to bottom, transparent, black 13%, black 91%, transparent)`. Result at both 320px and 390px: (1) the Miami label is drawn on top of the legend's first line ("Boston, New York"); (2) the legend's last line, which carries the "illustrative and unverified" disclosure, sits 24px into the bottom fade and is barely visible. Possible fixes: put the legend outside the masked map box (below it), or reserve space and move Miami's mobile label. | Open `/` at 320px or 390px and look at the bottom of the map. `qa/p4-09-check.cjs`: "legend doesn't collide with city labels" and "legend … isn't in a mask fade". | [320px](qa-screenshots/expansion/p4-11-x6-legend-overlaps-miami-and-fades-320.png), [390px](qa-screenshots/expansion/p4-11-x6-legend-overlaps-miami-and-fades-390.png) |
| X5 | Low–medium: readability, phones | Search map (`CorridorMap.tsx`) | **Resolved**: label sizes fixed in `961f568` (13.1px / 16.2px) and still passing on `af5fa8f`. | Map city labels rendered at about 5.2px at 320px and 6.4px at 390px on `21d77dd`. | `/` at 320px | [before](qa-screenshots/expansion/p4-09-map-320-labels-too-small.png), [after](qa-screenshots/expansion/p4-11-map-320.png) |
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
