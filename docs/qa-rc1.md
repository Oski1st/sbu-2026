# RC1 #39 regression QA (Person 4 helper)

These are **automated** runs (Playwright; installed Chrome 156 or bundled Chromium, depending on the suite) against local production builds. No human or device testing. Date 2026-10-25.

| Item | Value |
| --- | --- |
| RC1 | `feat/release-candidate-1` @ `2d0b5ef7fa8bce374adaa72abf6bd522c097772b`, served on 127.0.0.1:4187 |
| Baseline | #36 `37fdccebde92ceda02846e65fcd232c5fc7755bf`, served on 127.0.0.1:4191 |

## Build checks (observed)

| SHA | frozen install | typecheck | build | tests |
| --- | --- | --- | --- | --- |
| RC1 `2d0b5ef` | exit 0 | exit 0 | exit 0 | 22 files, **116/116** |
| #36 `37fdcce` | exit 0 | exit 0 | exit 0 | 22 files, 111/111 |

Person 1's claim in `docs/release-candidate-1.md` (116/116; e2e 119/121) matches what was observed.

## Suites (all scripts run **unmodified**; no adaptation was needed)

| Suite (source branch) | RC1 | #36 | Note |
| --- | --- | --- | --- |
| `qa/e2e-check.cjs` (app) | 119/121 | 119/121 | The 2 FAILs are 320/390px "links named", i.e. known false positives (below) |
| `qa/p4-14-check.cjs` (`feat/qa-expansion`) | 52/52 | 52/52 | |
| `qa/expansion-check.cjs` (`feat/qa-expansion`) | 120/122 | 120/122 | The 2 FAILs are the same unnamed `<a>` at 320/390px inside the closed map details |
| `qa/p4-37-rail-map-wip-check.cjs` (`fix/rail-map-polish`) | 25/25 | 24/25 | #36 fails the station-dot count; fixed by map polish |
| `qa/rail-map-details-check.cjs` | 25/25 | 10/25 | #36 audit panel is unbounded; fixed by polish |
| `qa/rail-map-labels-check.cjs` | exit 0, 9/9 widths "ok" (dotBox metric reads 0) | crashes (exit 2, element missing) | Polish-only markup |
| `qa/rail-map-geometry-check.mjs` | ALL PASS (max deviation 0.1217 ≤ 0.1271) | ALL PASS | |
| `qa/p4-28-journey-arrival-check.cjs` (`feat/qa-search-plan`) | 65/65 | 65/65 | |
| `qa/p4-29-journey-disclosure-check.cjs` | 16/16 | 16/16 | |
| `qa/p4-30-journey-timezone-check.cjs` (cand=RC1, base=#36) | 24/24 | — | Timeline `<time>` values are identical to #36 |
| `qa/p4-25-search-check.cjs` | 38/38 | 38/38 | |

**No regressions vs #36.** Logs: `docs/qa/rc1/rc1-run/`, `docs/qa/rc1/base36-run/`.

### e2e/expansion "unnamed link" false positive — accessibility-tree confirmation
`qa/rc1-e2e-unnamed-links-a11y.cjs` uses the e2e predicate. At 320px and 390px it finds 41 "unnamed" controls. **All 41** are inside the closed `<details>` "Corridors, cities & coverage gaps". **None** appears in the ARIA snapshot while it is closed. After opening, every one is visible with a name (e.g. "Downeaster (official source, opens in a new tab) ↗"). Result: PASS, false positive confirmed (`docs/qa/rc1/rc1-a11y-unnamed.log`).

## #38 fixes inside RC1 (`qa/p5d-qa38-fixes.cjs`)
9/11 PASS. F2–F10 pass, as on #38.
- **F1 FAIL**: the same D1 as #38. A typed 01/01/20270 becomes `date=0270-01-01` with no message.
- **F11 FAIL (expected, gap)**: RC1 still shows "Journey preview · The full Journey page is being built by our team." RC1 cherry-picked #38 up to `49bb150`, so it lacks #38's newer commit `b1d7e59`. Add it to RC1 if the new notice text should ship.

## Operator badge contrast (Search strip, `qa/rc1-logo-contrast.cjs`)
All 6 text badges pass at 320px and 1280px. Light and dark colour schemes give the same results (no dark theme). Text = icon contrast:

| Badge | contrast | size/weight |
| --- | --- | --- |
| SEPTA | 6.81:1 | 12px (320) / 14px (1280), 750 |
| NJ TRANSIT | 5.19:1 | same |
| Amtrak | 8.68:1 | same |
| LIRR | 6.95:1 | same |
| Greyhound | 9.93:1 | same |
| FlixBus | 7.85:1 | same |

## Bundle size (gzip -9, `docs/qa/rc1/bundle-gzip9.txt`)

| Asset | #36 | RC1 | Delta |
| --- | --- | --- | --- |
| Main JS `index-*.js` | 411,135 raw / 135,355 gz | 412,292 / 135,781 | +1,157 raw / **+426 gz** |
| Main CSS `index-*.css` | 65,822 / 14,447 | 67,643 / 14,723 | +1,821 raw / **+276 gz** |
| JourneyPage / WalletPage chunks | 6,575 / 4,463 gz | 6,575 / 4,463 gz | 0 |

## Blockers / notes
- D1 (5-digit year → 0270) ships in RC1.
- RC1 lacks `b1d7e59` (stale "being built" notice).
- Human device and screen-reader coverage was not run.
