# Final check — RC2 `feat/release-candidate-2`

Person 5 · QA docs only · automated in installed Chrome 156 plus targeted re-measurement. **Not** a human, screen-reader or phone test.

| Item | Value |
| --- | --- |
| Tested app SHA | **`39de4ba0d104f53b56cdb817b03bbe63c3aa924f`**: RC1 `2d0b5ef`, plus #40 release notes `5d4b670`, plus the Search focus/date fix `bcbd5e4`. No PR opened yet as of this check |
| Served | Isolated worktree, production Node server (`node server/index.mjs`) on 127.0.0.1. **Local, not deployed** |
| Checks at SHA | frozen install OK · typecheck exit 0 · build exit 0 · tests **22 files / 116 passed** · `pnpm test:proxy` **5/5** |
| Browser | Google Chrome 156.0.8078.47 (installed, Playwright), macOS 26.6 |
| Raw output | `results/p5-final-rc2-sweep.json`, `results/p5-final-rc2-map.json`, `results/p5-final-rc2-demo.json` |

## Results

| Area | Result |
| --- | --- |
| Full sweep: 552 city pairs, 1,651 routes / 3,302 Journey+Wallet pages, URL dates and times, typed dates, filters×sorts, swap, 320/375/390 overflow, console | **PASS.** 552/552 pairs; 20/20 URL dates, including `0001-01-01` (S1 fixed); typed 5-digit years are capped by `max` and the URL agrees with the form (S2 fixed); 0 console errors (favicon fixed). The early-read flags on the first Portland→Boston pages were re-checked by hand and render fully (harness timing artifact) |
| Map and accessibility pass (`p5-05-map36-qa.mjs`) | Map 320–1280 PASS; contrast ≥ 6.09:1; no external requests. Details: summary-only tab stop PASS; 41 links reachable with 8.96:1 outlines. The extra tab stop is the labelled scrollable region `role=region` "Corridor, city and coverage-gap details" (`tabindex=0`, 383px tall with 3,433px of content), which is correct practice; the script's fixed count of 41 was outdated. **K5 still open:** 7 new-tab links lack the hidden hint (assigned to Person 2, P2-NEWTAB-K5). Real 200% zoom **BLOCKED** |
| Demo click-through (`docs/demo/p5-06/verify-demo.mjs`) | **8/8 PASS**: autocomplete search, rail map, Compare "35 minutes sooner for $15 more", Journey delay, Wallet live SEPTA, 502 and empty-feed backups; no errors |
| **F1** Search focus (real keyboard Tab) | **FIXED.** From/To show a 2px `#4f7a2f` underline at **5.05:1**; Date/Time a 2px `#4f7a2f` outline at **5.05:1**. The transparent From/To outline is intentional, for forced-colors mode |
| **F2** date year clipped at ~375px | **FIXED.** At 375px Date and Time stack and "11/15/2026" is fully visible (`screenshots/p5-final-rc2-chrome156-date-time-375.png`) |

## Still open on RC2 (already assigned)

| Issue | Measured on RC2 | Owner |
| --- | --- | --- |
| Small-text contrast | Results disclaimer **3.20:1** (9px), hackathon note **2.93:1** (9px), region labels **3.56:1** (8px); needs ≥ 4.5:1 | Person 3 (P5D-DATA33 item 6) |
| Sample rail detours | Raleigh→Fayetteville rail **8h 50m** via Richmond (unchanged) | Person 3 (P5D-DATA33 items 1–3) |
| New-tab links not announced (K5) | 7 links | Person 2 (P2-NEWTAB-K5) |
| Journey feedback items | Not in RC2 (fixed on #41 `65cea74`, under Person 4 browser QA) | Person 2 / Person 4 |
| Stale "being built" notice | Not in RC2 (fixed on #38 `b1d7e59`) | integration owner |

**No new mistakes were found on RC2.** Human verification of the F1/F2 fixes (real zoom, phone date pickers, VoiceOver) is assigned to Person 4.
