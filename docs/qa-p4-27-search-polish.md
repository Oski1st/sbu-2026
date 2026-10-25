# P4-27: #29 Search polish recheck (S1 / S2)

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-27`). Feature owner: Person 2. The owner asked for **no GitHub comments**, so this file and the commit are the report. The P4-25 and P4-26 evidence is unchanged.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`dad01cf86b64ac8f92794345913e067b21edcc74`** (PR #29 `feat/search-integration`, open draft, frozen) |
| Parent (P4-25 target) | `3fa52d18aeade0488063f5a1c7d164c14054247a` |
| Base | #26 `35ed1965be9a2641fa31a2b8e1de60e7223260a3` |
| Diff from parent | `src/components/search/locationCatalogue.ts`, new `locationCatalogue.test.ts`, `src/index.css` (new `@media (max-width: 360px)` rule) |
| Environment | macOS 15.7.7, Node v22.23.4, pnpm 11.25.0, Playwright 1.64.1 / Chromium 156 (en-US). Served by `PORT=4173 node server/index.mjs` with build `index-DxARLZng.js` / `index-DAIYWIDs.css`. October 25, 2026 (UTC). |

## Results

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build` | Exit 0 |
| `pnpm test` | **101 / 101** (19 files) |
| Regression `qa/e2e-check.cjs` | **121 / 121** |
| Canonical IDs `qa/p4-14-check.cjs` | **52 / 52** |
| Expansion `qa/expansion-check.cjs` | **122 / 122** |
| National map `qa/p4-15-map-check.cjs` | **69 / 69** |
| P4-25 Search behaviour `qa/p4-25-search-check.cjs` | **38 / 38**: combobox ARIA/keyboard/pointer/touch, URL date/time preferences, refresh/share, back/forward, unchanged sample times, no geolocation |
| **P4-27 polish** `qa/p4-27-search-polish-check.cjs <url> <checkout> <shots>` | **14 / 16** (see S1 below) |

### S2 ranking: resolved

- **"ch":** Charlotte, Charleston, Richmond. P4-25 had Richmond first.
- **"or":** Orlando is first, where P4-25 had it 6th.
- **"ba":** Baltimore, then Albany.
- **Aliases:** exact `nyc` gives New York, and alias prefix `long` gives Stony Brook.
- **Limit after ranking:** `a` lists the prefix match Albany first within the 8 results.
- **Tie order:** `new` keeps catalogue order (New Haven, New York).
- **No match:** `zz` gives an empty list.
- **Independent model:** all **24 queries** match my own implementation of the stated rule exactly. That model is built from `eastCoast.ts` and the alias table: exact, then name/alias prefix, then word-start, then substring, with catalogue order for ties and the limit applied after ranking.

### S1 date/time clipping: fixed at ≤ 360 px, still present from 361 to about 389 px

| Viewport | Layout | Input width | Values |
| --- | --- | ---: | --- |
| 320 px | stacked | 166 px | **Full** "10/24/2026", "08:00 AM" ([screenshot](qa/p4-27/p4-27-datetime-320.png)) |
| 360 px | stacked | 166 px | Full (same layout as 320) |
| 361 px | side by side | 122 px | **Clipped** "10/24/202…", "08:00 AM" cut ([screenshot](qa/p4-27/p4-27-datetime-361.png)) |
| 375 px | side by side | 129 px | **Clipped** "10/24/202…" ([screenshot](qa/p4-27/p4-27-datetime-375.png)) |
| 390 px | side by side | 136 px | Full ([screenshot](qa/p4-27/p4-27-datetime-390.png)) |

Width sweep with side-by-side input widths: 365 → 124, 370 → 126, 375 → 129, 380 → 131, 385 → 134, 390 → 136, 400 → 141 px. 136 px is the narrowest width seen fully unclipped (at 390 px), and it's used as the criterion; the 361 and 375 px screenshots confirm the clipping visually. No page overflow at any width.

## Findings

| # | Severity | Owner | Finding | Suggested fix |
| --- | --- | --- | --- | --- |
| S1b | Low (common phone width) | Person 2 (Search CSS; Search work is currently on hold) | The new `@media (max-width: 360px)` breakpoint fixes 320–360 px, but **361–~389 px still clips** the date/time values. That range includes the very common 375 px phone width (P4-25 only checked 320 and 390). | Raise the breakpoint to about `400px`, or switch to stacking based on available field width |
| — | Resolved | — | S2 ranking fully resolved; S1 resolved at ≤ 360 px | — |

No regressions: all control suites and the P4-25 Search checks pass unchanged. #29 stays frozen, and no application files were changed.
