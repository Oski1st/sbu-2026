# P4-29: Journey details disclosure focus and accessibility (#32)

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-29`). Feature owner: Person 2. Silent mode is in effect (no GitHub comments), so this file and its commit are the report. Earlier evidence (P4-25 to P4-28) is unchanged.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`3f41b76ab3bf2b8b33f4b6a9369acd4b4417af23`** (PR #32 `fix/journey-details-focus` → `fix/journey-arrival-timestamps`, open draft, frozen) |
| Base / control | **`5ff9dc9bc52a3b54d89d937474d5294197bac74d`** (#31 head, unchanged) |
| Diff | `src/components/journey/SegmentCard.tsx` and new `segmentDisclosure.test.tsx` only. `git diff --check` is clean. |
| Environment | macOS 15.7.7, Node v22.23.4, pnpm 11.25.0, React 19.2 (lockfile), Playwright 1.64.1 / Chromium 156. Candidate on `:4173` (`index-BxNCndU0.js`, `JourneyPage-BSkDmIi_.js`); control on `:4174` (`index-DWIYR3pV.js`). October 25, 2026 (UTC). |

## Results

| Check | Kind | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build` | Build | Exit 0 |
| `pnpm test` | Unit, including the PR's 3 SSR disclosure tests | **107 / 107** (21 files) |
| Regression / canonical / expansion / national map / P4-25 Search / **P4-28 arrival timestamps** | Browser controls | **121 / 121, 52 / 52, 122 / 122, 69 / 69, 38 / 38, 65 / 65** (no regression in timestamps, overnight/simulation, coach or canonical behaviour) |
| **`qa/p4-29-journey-disclosure-check.cjs`** on #32 | Browser, observed keyboard/pointer/focus | **16 / 16** |
| Same script on base `5ff9dc9` (`--baseline`) | Browser control | 9 / 9 non-contract checks pass. **7 baseline defects**, all fixed by #32 (below). |

### Observed on #32 (trip `regional-connection`, 4 segments; then trip change to `amtrak-connection`)

- **K1–K3, collapsed:** all 4 detail containers have `inert` and `aria-hidden="true"`. A full Tab walk (15 stops) **never lands in collapsed details**. Chromium's accessibility tree exposes **no** collapsed "Get tickets from …" link.
- **K4–K7, expanded:**
  - A pointer click expands card 1 and focus is on its toggle ("Hide trip details").
  - Only card 1's container is non-inert; the others stay inert.
  - The next Tab reaches "Get tickets from SEPTA", and exactly **one** ticket link is in the accessibility tree.
- **K8–K9, keyboard toggles:** Enter collapses and Space re-expands, with focus staying on the toggle each time.
- **K10, switching cards:** with focus in card 1's ticket link, clicking card 2's toggle collapses card 1 and leaves focus on toggle 2. It isn't pulled back to card 1.
- **K11, Reset by pointer:** with focus in an open card's link, clicking Reset collapses everything and focus stays on Reset (no steal).
- **K12, external collapse with focus inside the details:** Reset was triggered by script so focus didn't move first. Focus returned from the ticket link to **that card's toggle**.
- **K13, trip change** (router navigation while focus was in an open card's link): every new card is collapsed and inert, and focus is not inside any hidden details.
- **K14, 320 px touch:** a tap expands a card, and the ticket link is visible inside the viewport with no page overflow.
- **K15:** no page or console errors.

### Baseline defects on `5ff9dc9` (fixed by #32, not regressions)

| # | Defect on base | Evidence |
| --- | --- | --- |
| B1 | Collapsed detail containers had no `inert` / `aria-hidden` | K1, K5 |
| B2 | **Collapsed ticket links were Tab stops**: 4 extra stops (19 vs 15) for invisible "Get tickets from SEPTA / NJ TRANSIT / LIRR / LIRR" | K2 |
| B3 | All 4 collapsed links were exposed to the accessibility tree | K3, K7 |
| B4 | On external collapse, focus **stayed on the now-hidden link** | K12 |
| B5 | After a trip change the new cards weren't inert (same as B1) | K13 |

## Limits

- **Browser:** Chromium only. Native `inert` needs Safari 15.5+ and Firefox 112+, which weren't tested here.
- **Pointer focus:** Chromium already focuses buttons on click, so the PR's explicit `event.currentTarget.focus()` (relevant to Safari, which doesn't) isn't independently observable here.
- **Screen readers:** no real screen reader was run (that's P5-01 scope). Accessibility results come from Chromium's computed accessibility tree.
- **External collapse:** the "external collapse with focus inside" case (K12) was reproduced by triggering Reset from script. With real input, activating Reset already moves focus, which K11 covers.

## Verdict

**No QA blockers for #32 at `3f41b76`.** Collapsed details are removed from Tab order and the accessibility tree. Expanding restores access, the toggles keep focus, focus returns appropriately on external collapse without stealing it, cards stay independent, and all regressions pass. #32 stays frozen; no application files were changed.
