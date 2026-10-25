# P4-33: Journey assembly on the catalogue/helper dependency (#34)

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-33`). Feature owner: Person 2. Earlier evidence (P4-26 to P4-32) is unchanged.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`a4fa839667d2b18b3f277b14b3e662a45eb9dc4e`** (PR #34 `feat/journey-assembly` → `feat/catalogue-helper-candidate`, open draft, frozen) |
| Base / dependency | **#30 `fe89f9ec5fc67bfdc779121143970684d649f143`** (catalogue + helper on #26 `35ed1965be9a2641fa31a2b8e1de60e7223260a3`; P4-26) |
| Sources | #31 `5ff9dc9bc52a3b54d89d937474d5294197bac74d`, #32 `3f41b76ab3bf2b8b33f4b6a9369acd4b4417af23`, #33 `4e415429e583792f90746ee8e4c055730e090fa4` (P4-28 / P4-29 / P4-30) |
| Environment | macOS 15.7.7, Node v22.23.4, pnpm 11.25.0, Playwright 1.64.1 / Chromium 156. #34 on `:4173` (`index-D8AhZ3a-.js`, `JourneyPage-BrLYZNT6.js`); #33 control on `:4174`; #30 control on `:4175` (`index-C3GgoKO8.js`). October 25, 2026 (UTC). |

## Provenance and bytes

| #34 commit (parent) | Source | Patch-id | Author / date |
| --- | --- | --- | --- |
| `0e44616d955cc25756e104296d71f314df3faac8` (`fe89f9e`) | #31 `5ff9dc9` | **identical** | Juan Usme, 2026-10-25 00:02:31 −0400; same as source |
| `889ce0e14bb3c6151c28ad1360e3f192c8a2b4ee` (`0e44616`) | #32 `3f41b76` | **identical** | Juan Usme, 00:06:10; same as source |
| `a4fa839667d2b18b3f277b14b3e662a45eb9dc4e` (`889ce0e`) | #33 `4e41542` | **identical** | Juan Usme, 00:15:03; same as source |

- **Files changed against #30:** exactly 4. `SegmentCard.tsx` and `JourneyPage.tsx` are modified; `segmentArrivalTime.test.tsx` and `segmentDisclosure.test.tsx` are added. **All 4 are byte-identical to #33.**
- **Everything else is byte-identical to #30.** That covers the catalogue, the helper, Search (#29 is intentionally absent) and shared files.
- **The cherry-picks are clean:** the pre-change `SegmentCard.tsx` and `JourneyPage.tsx` are identical on #30 and on the #31 base `dad01cf`, so the patches applied to the same code.

## Checks

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build` | Exit 0 |
| `pnpm test` | **169 / 169** (21 files) |
| `qa/p4-28-journey-arrival-check.cjs` | **65 / 65**. Arrival ISO `datetime`, original vs simulated +12 min (including overnight Washington→Orlando 12:50 AM → 1:02 AM · Oct 25), accessible names, Reset, demo controls, **Greyhound coach** label, **Wallet link** and back, 320 / 390 px. |
| `qa/p4-29-journey-disclosure-check.cjs` | **16 / 16**. Collapsed details inert and out of the Tab order and accessibility tree; expand restores access; Enter / Space; card switching; Reset; external collapse returns focus; **trip change**; 320 px tap. |
| `qa/p4-30-journey-timezone-check.cjs <#34> <#33>` | **24 / 24**. "Sample itinerary times in Eastern Time" at **320 / 375 / 390** / 640 / 1280 px, with no overlap or overflow, stacked below 640 px. All timeline `<time>` values identical to the **#33 control** (regional and overnight, with and without the simulated delay). |
| Search / regression vs **#30** (not #29) | `qa/e2e-check.cjs` **121 / 121 on #34 and 121 / 121 on #30**; canonical IDs `qa/p4-14-check.cjs` **52 / 52** |

**Build comparison against #30** (hashed names normalised):
- Main JS `index` and the Wallet JS/CSS are **identical**, so Search and shared runtime are unchanged.
- Only the `JourneyPage` chunk changes (22,047 → 22,688 bytes), plus the main CSS (60,386 → 60,774 bytes).
- The CSS gains 9 rules and loses none. `sm:gap-4` and `sm:items-end` come from #33's layout. The other seven are `.collapse` and `.container` rules (see A1).

Screenshots: [timeline 320](qa/p4-33/p4-33-timeline-320.png), [375](qa/p4-33/p4-33-timeline-375.png), [390](qa/p4-33/p4-33-timeline-390.png), [delayed card 320](qa/p4-33/p4-33-delayed-card-320.png).

## Findings

| # | Severity | Attributed to | Finding |
| --- | --- | --- | --- |
| A1 | Info (inherited; not an assembly regression) | #32 source `3f41b76` | Tailwind's automatic source scan emits **unused** `.collapse{visibility:collapse}` and `.container` (7 rules) because of the bare words "collapse" (a `SegmentCard.tsx` comment and a test title) and "container" (a test error message). The rules are already present in the #32 and #33 builds and absent from #31 and #30, and no element uses either class. This is the same mechanism as P4-26's `.rounded`. I missed it in P4-29, which didn't diff the CSS. |
| — | — | — | No assembly regression. Search behaviour matches #30, as instructed (the #29 autocomplete is intentionally absent and isn't counted as a regression). |

**Verdict: no QA blockers for #34 at `a4fa839`.** It's a faithful, byte-identical assembly of #31–#33 onto #30. #34 stays frozen; no application files were changed. Timetable and real-device claims are out of scope.
