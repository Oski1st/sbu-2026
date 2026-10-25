# P5-05 — Installed-Chrome device and accessibility pass on map candidate #36

Person 5 · QA docs only · no app edits under this task. (Not the same as `p5-05-functional-sweep-33.md`, which is the earlier sweep of #33.)

| Item | Value |
| --- | --- |
| Tested app SHA | **`37fdccebde92ceda02846e65fcd232c5fc7755bf`** (PR #36 `feat/conus-passenger-rail-map`, open draft), base #33 `4e415429e583792f90746ee8e4c055730e090fa4` |
| Checkout | Isolated git worktree at the exact SHA, served by local `vite` on 127.0.0.1. **Local candidate, not deployed.** |
| Checks at SHA | `pnpm install --frozen-lockfile` OK · `pnpm typecheck` exit 0 · `pnpm build` exit 0 (main JS 411.14 kB / 135.62 kB gzip) · `pnpm test` **22 files / 111 passed** |
| Browser and OS | Google Chrome **156.0.8078.47** (installed app, driven by Playwright 1.64.1), macOS 26.6 (25G83), Apple Silicon. Node 22.23.4, pnpm 11.25.0 |
| Method | Automated with real keyboard events plus computed-style and contrast measurement, plus Person 5's visual review of the screenshots. **Not** a human, screen-reader or phone test. Narrow widths are resized desktop viewports. |
| Script and raw output | `scripts/p5-05-map36-qa.mjs` · `results/p5-05-map36-chrome156-results.json` |

## Results

| # | Check | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| M1 | Map at 320 / 375 / 390 / 768 / 1280px | No sideways scrolling; nothing clipped | `scrollWidth` equals the viewport at every width. SVG 292×153 at 320px up to 606×318 at 1280px. 8 routes and 26 stations drawn at every width; no clipped text | PASS ×5 | `screenshots/p5-05-map36-chrome156-map-{320,375,390,768,1280}.png` |
| M2 | Map text readable | Contrast ≥ 4.5:1; legible size | Lowest ratio **6.09:1** (eyebrow, heading copy, legend, note, summary); smallest font 11px; at ≤760px the legend stacks into one column | PASS ×5 | same |
| M3 | Offline map | No external runtime requests | No request left 127.0.0.1 on load (geometry is bundled) | PASS | results JSON |
| M4 | Console | No errors | None | PASS | — |
| V1 | Map geography (visual review) | North-up, contiguous US only, recognisable states, lines on the East Coast corridors | North-up and not mirrored; contiguous 48 states; no Alaska/Hawaii insets; corridors from Maine to Miami with station dots | PASS | 1280 and 320 screenshots |
| Z1 | **Real** 200% browser zoom | No sideways scrolling; text and legend readable | Browser zoom can't be driven from page automation. An emulated equivalent (640×400 at 2×) shows no overflow, **but that is not counted** | **BLOCKED** | `…-map-zoom200-emulated.png` (information only) |
| K1 | Keyboard, details **closed** | The summary is the only tab stop in the map section | Only stop: `SUMMARY` "Corridors, cities & coverage gaps" | PASS | — |
| K2 | Summary focus visible | Outline ≥ 3:1 | 3px `#244d3e` outline, **8.96:1** | PASS | — |
| K3 | Keyboard, details **open** | Enter opens it; every source link reachable | Enter opens it; **41/41** links reached in order by Tab | PASS | `…-map-details-open-1280.png` |
| K4 | Focus visible on links | Each link ≥ 3:1 | All 41 show a 3px outline, minimum **8.96:1** | PASS | — |
| K5 | New-tab links announced | Links with `target=_blank` tell screen-reader users they open a new tab, as the corridor and station links already do | **7 links lack the hidden "opens in a new tab" text:** "MTA station details · alignment not mapped ↗", three "Official source ↗" gap links, and the three source links (FRA/BTS alignments, Amtrak station dataset, Natural Earth boundaries) (`CorridorMap.tsx:62,66,68`) | **FAIL (new, low)** | results JSON |
| K6 | Link safety | https, `rel=noreferrer` | Yes, all 41 | PASS | — |
| K7 | Close again | Enter on the summary closes it | Closes | PASS | — |
| W1 | Wording: partial coverage | Stated | "Partial coverage; confirm service and boarding details with the operator." Description: "partial rail coverage" | PASS | — |
| W2 | Wording: not a timetable | Stated | "not a timetable or a guarantee of a direct connection"; "These lines do not change the sample itineraries." | PASS | — |
| W3 | No Alaska/Hawaii | None in the map or anywhere on the page | 0 mentions; no inset elements | PASS | — |
| W4 | Coverage list | All 24 sample cities, gaps disclosed | 24 cities listed; Stony Brook "alignment not mapped" (LIRR missing) disclosed | PASS | — |
| B1 | Search: keyboard autocomplete | `new` → ↓ ↓ → Enter gives New York | New York | PASS | — |
| B2 | Search: typed date → submit → Back | Typed date saved to the URL; Back restores the previous one | `12252026` → `date=2026-12-25`, 1 route → Back → 2026-11-15 | PASS | — |
| B3 | Journey → Wallet → Back → Back | Pages load; preferences survive | `/journey/east-new-york--stony-brook--amtrak` (demo status "Current step: LIRR connection concept…") → `/wallet/…` → Back → Back → Search with the date intact | PASS | — |
| B4 | Page errors during basics | None | None | PASS | — |
| F1 | Search field focus indicator | — | Still `#97b47e` (2.3:1); unchanged from #33 | FAIL (**known F1**, Person 3) | — |
| F2 | Date field at 375px | — | Side by side, 129px, year clipped; unchanged from #33 | FAIL (**known F2**, Person 3) | `…-date-time-375.png` |

## Totals (exact `37fdcce`)

**27 PASS · 3 FAIL (1 new: K5; 2 known: F1, F2) · 1 BLOCKED (Z1, real 200% zoom).**

## Observations (not counted)

- The **Floridian** line ends in western Pennsylvania (x≈490 in the 800-wide frame), but its description names Chicago. That's fine for "selected corridors serving our sample cities", but a note that the line is truncated outside the sample region would avoid confusion.
- At this head the previously reported stale unit test (P4-37 on WIP `ce1acf4`) is gone: 111/111 tests pass.

## Blockers and hand-offs

- **Z1, real 200% zoom:** needs a person pressing Cmd+Plus in Chrome. See checklist H2 in `p5-04-human-session.md`, which the P5D-HUMAN33 session with Person 4 covers on #33. Re-run H2 on #36 if the map lands.
- **K5:** a map-file fix, so it belongs to Person 2 (map owner).
- **F1/F2:** with Person 3 (P3-CHECKPOINT / P5D-DATA33).
