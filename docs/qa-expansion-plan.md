# East Coast expansion QA

Owner: Person 4. Feature owner: Person 1 (PR #13, `feat/east-coast`).

**Tested commit: `9be946d`** (`9be946d3376dc61064ad0645909e1f15f43534ad`), the PR #13 head on base `main` `6df372e`. These are **PR results, not `main` results.** Re-run on the merged `main` SHA before relying on them for the demo. Earlier `main` runs are in [qa-checklist.md](qa-checklist.md) and are unchanged.

Run on October 24, 2026 with Node 22.23.4, pnpm 11.25.0 and Playwright 1.64.1, against a clean checkout of `9be946d` served by `pnpm start`.

## Summary

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
| X1 | Medium: visual, 320px | Journey timeline (`src/components/journey/SegmentCard.tsx`, Person 2's file, edited in PR #13) | Open on `9be946d` | At 320px the city column is a `min-w-0` grid cell only 66–77px wide. "Washington, DC" can't wrap ("Washington," is one word), so it spills 38px into the time column and renders as "Washingto6:35 PM · Oct 24". "Portland" overflows by 4px. At 390px and wider, and for shorter names like "Stony Brook", it's fine. This is new with the expansion: the longer city names and the "· Oct 24" date suffix on times. | Open `/journey/east-portland--miami--amtrak` at 320px width and scroll to the Boston → Washington, DC segment. | [crop](qa-screenshots/expansion/bug-320-washington-dc-overlaps-time.png) |
| X2 | Low: UX | Search (`src/pages/SearchPage.tsx`, Person 1) | Open | The search query isn't in the URL. After searching Boston → New York, a page refresh returns to the default Philadelphia → Stony Brook demo. Journey and Wallet deep links for expanded trips do survive refresh and sharing. | Search Boston → New York, then press reload. | n/a |
| X3 | Low: readability | Journey header (Person 2) | Open; the format predates this PR | Total duration is shown in minutes: "2010 min total" for Portland → Miami, while the segment cards show "21h 55m". | Open `/journey/east-portland--miami--amtrak`. | [390px](qa-screenshots/expansion/mobile-390-journey-portland-miami.png) |
| X4 | n/a | Person 3 verified | **Closed: not a defect** (Person 3, hub #3, October 24) | SEPTA links use `https://wwww.septa.org/…` (four w's). I raised this as a possible typo because it resolves through a different host than `www.septa.org`. Person 3 verified that the four-w URLs are official SEPTA pages ("Ways to Pay – Southeastern Pennsylvania Transportation Authority"), so no replacement is required. | n/a | n/a |

## Scenario results

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
PORT=4173 pnpm start
node qa/expansion-check.cjs http://127.0.0.1:4173 qa-results/expansion
```
