# QA P4-41: PR #41 Journey/Wallet feedback (plus PR #42 new-tab links)

Tester only. No app code was changed. Chromium (Playwright), 2026-10-25.

## PR #41 `fix/journey-qa-feedback`

- Candidate: `65cea74ef3fd5f1dd5e614c25d59cf52b03f76cb`, served on port 4194
- Base (#33): `4e415429e583792f90746ee8e4c055730e090fa4`, served on port 4195
- Browser script: `qa/p4-41-journey-feedback-check.cjs <url> [shots] [--baseline]`. The browser context uses the `America/Los_Angeles` time zone, which shows that the Eastern labels do not depend on local time.
- Trips tested: `regional-connection` (15-min transfer), `amtrak-connection` (20-min), `east-washington--stony-brook--amtrak` (Amtrak to LIRR, 60-min), `east-boston--stony-brook--greyhound` (coach to LIRR, 60-min), and three single-leg trips: `east-boston--new-york--greyhound`, `east-washington--orlando--amtrak` (arrives after midnight) and `east-new-york--philadelphia--amtrak`.

### Build/test

| | install | typecheck | build | vitest |
|---|---|---|---|---|
| base 4e41542 | ok | ok | ok | 21 files / 107 tests passed |
| #41 65cea74 | ok | ok | ok | 22 files / 134 tests passed |

### Per item

| Item | Result | Evidence |
|---|---|---|
| J2 slack + 10-min buffer | PASS | 60-min transfers show "The connection still works in this sample: 48 min remains ... meeting the 10-minute demo buffer". The transfer is not amber and no recovery card appears (two east trips). Regional shows "Only 3 min remains" and Amtrak shows "Only 8 min remains", both amber with the recovery plan. The copy says the "10-minute demo buffer is not an official minimum transfer time". The base warned on every connection. The unknown and missed states have no real-data trip and are covered only by unit tests (NOT RUN in the browser). |
| J3 mobile left-aligned delayed times | PASS | At 320 and 390, the original and simulated arrival `<time>` elements both have left=63. On base they were right-aligned (left 189/151). At 1280, both right edges are 979. No horizontal overflow. `p4-41-delayed-card-{320,390,1280}[-base].png` |
| W3 Wallet back link | PASS | Journey → "View ticket wallet" → keyboard Enter on "Back to journey" returns to the same `/journey/<id>` (6 trips). The href is correct after a direct load and a reload. The invalid wallet has no link. On base the link is missing. `p4-41-wallet-top-*.png` |
| F8 coach disclaimer | PASS | The "Sample coach corridor" note is visible without expanding the card, and only on bus legs (`[true,false]` on Boston→Stony Brook coach+LIRR). It mentions intermediate stops, rest breaks, and "not a claim of nonstop service". None appears on rail trips. `p4-41-journey-greyhound-delay-{320,390}.png` |
| S4 dated Eastern transfer times | PASS | Transfer "Next: ... at 9:10 AM · Oct 24 Eastern Time." (base: "at 9:10 AM."). The simulated arrival rolls past midnight correctly (Orlando "1:02 AM · Oct 25 Eastern Time"). |
| F1 focus restore | PASS | Keyboard only (Tab to Start, then Enter/Space). At the last step the disabled Next hands focus to Previous. At the first step the disabled Previous hands focus to Next. ArrowRight/ArrowLeft back to the first step leaves focus on Next. Reset keeps focus on Reset. On single-step trips focus stays on Start. A demo Reset fired while focus is on the Wallet link does not steal focus. Toggling Simulate delay keeps focus on the toggle. Tested on regional (7 steps), Washington→Stony Brook (3 steps) and two single-step trips. On base, focus fell to `<body>` at each boundary. |
| F6 atomic live region | PASS | There is exactly one `role=status aria-live=polite aria-atomic=true` feedback region. "Simulated delay: +12" appears once across all live regions on 6 trips. The region reads "Simulation off. Original sample itinerary times are shown." before the delay is simulated and again after both resets (the toggle and the demo Reset). Single-leg trips say "There is no onward connection in this itinerary. This is the simulated arrival at your destination." with no recovery card. On base there was no status region, and the recovery card was the only announcement. |

Reload resets the simulation. An SPA trip switch (pushState/popstate from regional, with the delay and demo active, to Washington→Orlando) shows the new trip with "Simulation off" and no stale "Only 3 min" warning. No console or page errors.

### Regression (origin/feat/qa-search-plan scripts, unmodified)

| Script | base 4e41542 | #41 65cea74 |
|---|---|---|
| p4-28-journey-arrival-check | 65/65 | 65/65 |
| p4-29-journey-disclosure-check | 16/16 | 16/16 |
| p4-30-journey-timezone-check (one run compares candidate and base) | 24/24 | (same run) |
| e2e-check | 121/121 | 121/121 (the 2 known closed-details false fails did not reproduce) |
| p4-41-journey-feedback-check | 33/36 + 85 BASELINE gaps (`--baseline`) | 127/127 |

No scripts needed adapting. The 3 base FAILs of p4-41 (reload and trip switch) are a script limitation: they key on the new "Simulation off" copy, which does not exist on base. They are not base regressions.

### Findings (#41)

1. **Low: hard-coded "+12" in the aria-label.** `src/components/journey/SegmentCard.tsx` still has `aria-label={\`Simulated arrival (+12 minutes): ...\`}` while the visible copy uses `SIMULATED_DELAY_MINUTES`. The output is correct today but would drift if the constant changed.
2. **Info: "Skip to content" appears in full-page screenshots.** The link shows mid-page in full-page screenshots on both base and #41 (`p4-41-journey-greyhound-delay-390*.png`). This looks like a screenshot artifact of a focus/fixed-position skip link, not a #41 change.
3. **Info: Wallet back link placement.** The "Back to journey" link sits above the Wallet header at all widths and looks good at 320 (`p4-41-wallet-top-320.png`).

NOT RUN (#41): browser checks of the J2 "missed" and "unknown" states (no real trip produces them; unit tests cover them); real screen reader output (only live-region DOM/attributes were checked); Safari and Firefox.

## PR #42 `fix/newtab-links`

- Candidate: `b02d470a338d02b7c4dc6e178fc64b2c30b3fa81` (4194). Base RC2: `39de4ba0d104f53b56cdb817b03bbe63c3aa924f` (4195).
- Build: both installed, typechecked and built. Vitest: base 22 files / 116 tests, #42 23 files / 124 tests, all passed.
- Script: `qa/p4-42-newtab-links-check.cjs <cand> <base> [shots]`. It lists every `a[target=_blank]` and reads each accessible name from the CDP AX tree (`Accessibility.getPartialAXTree`). Pages: Search (all RouteCards expanded, map details open), Journey (each segment's details opened in turn because they work as an accordion; links in inert, collapsed details are skipped), Wallet, and the `/wallet` integration fallback. Result: **34/34 PASS**. Data: `docs/qa/p4-42/p4-42-links.json`.

| Page | new-tab links | names include "opens in a new tab" (#42 / base) | visible text vs base | label-in-name | conflicting names |
|---|---|---|---|---|---|
| Search | 49 | 49/49 / 34/49 | identical | ok | 0 |
| Journey regional (4 segments) | 5 | 5/5 / 0/5 | identical | ok | 0 (the two LIRR legs are now "segment 3, New York Penn Station to Huntington" and "segment 4, Huntington to Stony Brook") |
| Journey Boston→Stony Brook coach | 3 | 3/3 / 0/3 | identical | ok | 0 |
| Wallet regional | 6 | 6/6 / 5/6 (only "Built together" changed) | identical | ok | 0 |
| /wallet fallback | 1 | 1/1 / 0/1 | identical | ok | 0 |

- The Floridian note is visible in the open map details at 320, 390 and 1280 (`docs/qa/p4-42/p4-42-map-floridian-*.png`). There is no horizontal overflow with map details open or RouteCards expanded at 320, 390 or 1280.
- e2e-check: base 119/121, #42 119/121. The only fails are the 2 known closed-details false fails ("Mobile 320/390 buttons/links named and unclipped" flags the map's route links inside the closed `<details>`). They are identical on both builds.

### Findings (#42)

1. **Low: duplicate names on Wallet.** The two LIRR legs on the Wallet have identical names, "MTA TrainTime & tickets (opens in a new tab)". They point to the same href, so this is not ambiguous about the destination, but they are not leg-specific like the Journey links. `src/pages/WalletPage.tsx`. This is pre-existing and was not touched by #42.
2. **Info: redundant sr-only span on "Agency site".** On the RouteCard "Agency site" link, `aria-label` overrides the content, so the new `<span class="sr-only"> (opens in a new tab)</span>` is redundant. It is harmless. `src/components/search/RouteCard.tsx`.
3. **Info: "↗" in accessible names.** Several names end with "↗" (map links, "Check SEPTA feed information ↗ (opens in a new tab)"). This is pre-existing.

NOT RUN (#42): the IntegrationPage "Official tickets" per-leg links (the `/wallet` fallback page tested here showed only the footer link); the Journey/Wallet pages with a pre-selected trip through `/journey` or `/wallet` redirects; real screen reader output.
