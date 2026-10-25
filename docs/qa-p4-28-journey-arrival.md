# P4-28: Journey arrival timestamps (#31)

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-28`). Feature owner: Person 2. Silent mode is in effect (no GitHub comments), so this file and its commit are the report. Earlier evidence (P4-25 to P4-27) is unchanged.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`5ff9dc9bc52a3b54d89d937474d5294197bac74d`** (PR #31 `fix/journey-arrival-timestamps` → `feat/search-integration`, open draft, frozen) |
| Base / control | **`dad01cf86b64ac8f92794345913e067b21edcc74`** (#29 head; PR #31's base branch tip, unchanged) |
| Diff | `src/components/journey/SegmentCard.tsx` and new `segmentArrivalTime.test.tsx` only. `git diff --check` is clean. |
| Environment | macOS 15.7.7, Node v22.23.4, pnpm 11.25.0, Playwright 1.64.1 / Chromium 156 (en-US). Candidate on `:4173` (`index-DWIYR3pV.js`, `JourneyPage-jC11PHjS.js`); control on `:4174` (`index-DxARLZng.js`). October 25, 2026 (UTC). |

## Checks

| Check | Kind | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build` | Build | Exit 0 |
| `pnpm test` | Unit, including PR's 3 SSR arrival tests | **104 / 104** (20 files) |
| Regression / canonical / expansion / national map / P4-25 Search | Browser controls | **121 / 121, 52 / 52, 122 / 122, 69 / 69, 38 / 38** |
| **`qa/p4-28-journey-arrival-check.cjs`** on #31 | Browser (observed interaction) | **65 / 65** |
| Same script on base `dad01cf` (`--baseline`) | Browser control | 34 / 34 non-contract checks pass. **11 contract gaps on the base**, which are exactly what #31 adds (below). |

### What the browser checks observed on #31

The checks used five trips: `regional-connection`, `amtrak-connection`, `east-washington--orlando--amtrak` (overnight), `east-boston--new-york--greyhound` (coach) and `east-portland--miami--amtrak`.

- **T1, T2:** every segment departure and arrival `<time>` has a valid ISO `datetime`. Its visible label equals an **independent** Eastern-time formatter ("h:mm AM · Mon D"). Each card has one departure and one arrival, and arrival is never before departure.
- **T3:** the overnight Washington → Orlando first leg shows "8:00 AM · Oct 24 → 12:50 AM · Oct 25", with arrival `datetime` `2026-10-25T04:50:00.000Z`.
- **T4:** the Greyhound coach label is visible.
- **D1–D9, delay simulation:**
  - The button has `aria-pressed=true`, and the card shows "Simulated delay: +12 min" and "Arrive (simulated)".
  - The delayed card has **3** `<time>` elements: the original arrival keeps the **unchanged** instant and is struck through, and the simulated one is exactly **+12:00 minutes** with a matching label. Overnight example: 12:50 AM · Oct 25 → 1:02 AM · Oct 25.
  - The `aria-label`s are "Original sample arrival: …" and "Simulated arrival (+12 minutes): …". **Chromium's accessibility tree exposes them as the accessible names** (role `time`, not ignored).
  - Only the first leg changes, and **Reset restores every original time exactly**.
- **J0–J2, controls:**
  - Start / Next / Previous / Reset work on a multi-leg trip. On the single-leg coach trip, Next is correctly disabled after Start. Times are unchanged after the controls.
  - The Wallet link opens `/wallet/<id>`, and Back returns to the Journey.
- **M1, mobile:** at 320 and 390 px with the simulation on, there's no page overflow and all three times stay inside the card ([320](qa/p4-28/p4-28-delayed-card-320.png), [390](qa/p4-28/p4-28-delayed-card-390.png)).
- No page or console errors.

### Base control (`dad01cf`): what #31 changes

- Arrival `<time>` had **no `datetime`** attribute. Departure already had one.
- During the simulation, the original and simulated arrivals were plain spans inside one `<time>` with no `datetime`.

The visible text, dates (including the overnight "Oct 25") and the +12 behaviour were already correct on the base. #31 adds the machine-readable instants and the labels without changing what's shown.

### Midnight rollover

No real first leg in the 1,651-trip catalogue (the P4-16 baseline set, same IDs) arrives between 23:48 and 23:59 Eastern, so the +12-minute simulation never crosses midnight in actual data. The rollover case (23:55 Oct 24 → 00:07 Oct 25) is covered **only by the PR's SSR unit test**, which passes; it was not observed in the browser. Overnight arrival dates (423 first legs, e.g. Washington → Orlando) were observed.

## Findings

| # | Severity | Attributed to | Finding |
| --- | --- | --- | --- |
| J-a | Info (base, not this patch) | Base `dad01cf` | On narrow screens the delayed arrival block is right-aligned (`flex flex-col items-end`) while departure is left-aligned. This is visually identical on the base ([base 320](qa/p4-28/p4-28-delayed-card-320-base.png)) and #31 doesn't touch those classes. |
| J-b | Info | #31 | The simulated `datetime` is UTC (`…Z`, from `toISOString`), while the original keeps the source offset (`-04:00`) for the original demos. Both are valid and describe the right instants. |
| J-c | Info (unreachable today) | #31 / shared `addMinutes` | For non-ISO clock-string legs, `addMinutes` returns a display label, which would end up in `datetime`. Every leg in current trip data is ISO (checked), so this can't happen today. |

**Verdict: no QA blockers for #31 at `5ff9dc9`.** Ordinary and overnight arrival semantics, the separate original and simulated instants, the labels, Reset, the Journey controls, coach labels, Wallet navigation and mobile layout are correct, and all controls pass. #31 stays frozen; no application files were changed.
