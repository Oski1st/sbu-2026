# P4-30: Journey timeline timezone wording and layout (#33)

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-30`). Feature owner: Person 2. This was a narrow wording/layout review, so broad unchanged browser suites weren't repeated. P4-25 to P4-29 evidence is unchanged.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`4e415429e583792f90746ee8e4c055730e090fa4`** (PR #33 `fix/journey-timezone-clarity` → `fix/journey-details-focus`, open draft, frozen) |
| Base / control | **`3f41b76ab3bf2b8b33f4b6a9369acd4b4417af23`** (#32 head, unchanged) |
| Diff | `src/pages/JourneyPage.tsx` only. The timeline header becomes `flex-col` below `sm` (640 px), and the note changes from "Times shown from itinerary" to "**Sample itinerary times in Eastern Time**". `git diff --check` is clean. |
| Environment | macOS 15.7.7, Node v22.23.4, pnpm 11.25.0, Playwright 1.64.1 / Chromium 156. Candidate on `:4173` (`index-sWwrd8Ot.js`, `JourneyPage-BFkDHtCi.js`); control on `:4174` (`index-BxNCndU0.js`). October 25, 2026 (UTC). |

## Checks

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build` | Exit 0 |
| `pnpm test` (full) | **107 / 107** (21 files) |
| `qa/p4-30-journey-timezone-check.cjs <candidate> <base> <shots>` | **24 / 24** |

What the check covered, on `/journey/east-washington--orlando--amtrak`:

- **Widths 320, 375, 390, 640 and 1280 px:**
  - The note text is exactly "Sample itinerary times in Eastern Time" at 12 px, slate-500.
  - It doesn't overlap the heading block, stays inside the viewport, and causes no page overflow. No page errors.
  - **Stacked below the heading under 640 px**, and side by side at 640 px and wider.
- **Timeline values unchanged:** every `<time>` `datetime`, its visible text and its `aria-label` are **identical to the #32 base** for `regional-connection` and the overnight `east-washington--orlando--amtrak`, with and without the simulated delay. Examples: `2026-10-25T04:50:00.000Z` "12:50 AM · Oct 25", and "Original sample arrival: 12:50 AM · Oct 25".

Screenshots at each width, for candidate and base, are in [`qa/p4-30/`](qa/p4-30/). At 320 px the base wraps "Journey timeline" onto two lines next to a two-line note ([base 320](qa/p4-30/p4-30-base-320.png)). #33 shows the heading on one line with the note underneath ([candidate 320](qa/p4-30/p4-30-cand-320.png)).

## Findings

None. The wording accurately describes the existing America/New_York formatter (`formatTime` / `displaySegmentTime`). No time values, calculations or sample data change.

**Verdict: no QA blockers for #33 at `4e41542`.** #33 stays frozen; no application files were changed.
