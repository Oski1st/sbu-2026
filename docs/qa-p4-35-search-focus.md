# P4-35: Search focus-indicator verification (P5 F1) on #33

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-35`). This independently checks Person 5's F1 finding. It's docs only, with no app or style changes.

## Target and inputs

| Item | Value |
| --- | --- |
| Tested SHA | **`4e415429e583792f90746ee8e4c055730e090fa4`** (#33, open draft, frozen). Base #32 `3f41b76ab3bf2b8b33f4b6a9369acd4b4417af23`. |
| P5 evidence | PR #35 `qa/p5-02-device` at **`48be690dc06370922d169bf9354c732c54e801e2`** (`docs/qa-device/p5-02-search-candidate.md`). P5 tested #29 `dad01cf86b64ac8f92794345913e067b21edcc74`. |
| Same Search code? | **Yes.** `git diff dad01cf 4e41542 -- src/index.css src/components/search` is empty, so P5's observations and these measurements apply to the same CSS. |
| Environment | macOS 15.7.7, Node v22.23.4, Playwright 1.64.1 / **Chromium 156.0.8078.4** headless, 1280×900, DPR 1. Production build served by `node server/index.mjs` on `:4173` (`index-sWwrd8Ot.js`). October 25, 2026 (UTC). |
| Standard | **WCAG 2.2** (W3C Recommendation, `https://www.w3.org/TR/WCAG22/`, fetched for this task): SC **1.4.11** Non-text Contrast (AA), SC **2.4.7** Focus Visible (AA), SC **2.4.13** Focus Appearance (AAA). Also *Understanding 1.4.11*, "Relationship with Focus Visible": "the visual focus indicator for a component must have sufficient contrast against the adjacent background when the component is focused, except where the appearance of the component is determined by the user agent and not modified by the author." |

## Method (`qa/p4-35-search-focus-check.cjs`)

For each control:

1. Reach the control with **real Tab presses**, so `:focus-visible` applies. Native date/time inputs have internal segments, so Tab repeats until the input itself is the active element.
2. Wait 500 ms so the Tailwind `transition` finishes. An earlier run without the wait caught From/To mid-transition and was discarded.
3. Read the computed `outline`, `border-bottom`, `box-shadow`, the element's own background, and the first non-transparent ancestor background (the "adjacent colour").
4. Compute the **WCAG relative-luminance contrast** of each indicator colour against the adjacent colour, independently and not copied from P5.
5. Take 1:1 screenshots in the unfocused and focused states and **diff the pixels**. For each changed pixel, compute the focused vs unfocused contrast (the SC 2.4.13 method) and compare the count against the area of a 2 px perimeter.

Raw data: [`qa/p4-35/p4-35-focus.json`](qa/p4-35/p4-35-focus.json). Screenshots for each control in both states are in [`qa/p4-35/`](qa/p4-35/).

## Control-by-control matrix (all keyboard-reached: `:focus-visible` true)

| Control | Source rule (#33) | Indicator when focused (computed) | Contrast vs adjacent `#ffffff` | Thickness / area | Pixel diff: max change contrast; pixels ≥ 3:1 vs 2 px-perimeter area | 1.4.11 (AA) | 2.4.7 (AA) | 2.4.13 (AAA) |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| **From** `#origin` | `src/index.css:479–482` `.location-field input:focus { border-bottom-color:#97b47e; outline:none }`. The Tailwind `focus:ring-2 focus:ring-slate-950/15` in `LocationAutocomplete.tsx:149` still applies a ring. | 1 px bottom border `rgb(151,180,126)` + 2 px box-shadow ring of slate-950 at **15 % alpha** (blends to about `#d9dadc`) | **2.30:1** border; ring about **1.40:1** | 1 px border; 2 px faint ring | 2.30; **0** of 1,083 | **FAIL (confirmed)** | Pass (an indicator is visible) | Fail (advisory) |
| **To** `#destination` | same | same as From | **2.30:1**; ring about 1.40:1 | same | 2.30; **0** of 1,075 | **FAIL (confirmed)** | Pass | Fail (advisory) |
| **Date** | `src/index.css:551–554` `.date-time-controls input:focus-visible { outline:2px solid #97b47e; outline-offset:2px }` | 2 px outline `rgb(151,180,126)`, offset 2 px, on `#ffffff` | **2.30:1** (2.23:1 vs the input's own `#fbfcf8`) | 2 px around the whole box | 2.58 (anti-aliasing); **0** of 750 | **FAIL (confirmed)** | Pass | Fail (advisory) |
| **Time** | same | same as Date | **2.30:1** | 2 px around the whole box | 2.59; **0** of 750 | **FAIL (confirmed)** | Pass | Fail (advisory) |
| Swap (reference) | global `:focus-visible { outline:3px solid #7da24b; outline-offset:5px }` (`src/index.css:59–61`) | 3 px outline `rgb(125,162,75)`, offset 5 px | **2.94:1** | 3 px | 2.94; **0** of 240 | **FAIL by 0.06 (new; see F1b)** | Pass | Fail (advisory) |
| Find my way (reference) | same global rule | 3 px outline `rgb(125,162,75)` on `#ffffff` (button `#173f35`, not adjacent because of the offset) | **2.94:1** | 3 px | 2.94; **0** of 823 | **FAIL by 0.06 (F1b)** | Pass | Fail (advisory) |

Independent check of the key numbers (sRGB relative luminance):
- `#97b47e`: L = 0.4073, so contrast with white = 1.05 / 0.4573 = **2.30**.
- `#7da24b`: L = 0.3071, so contrast with white = 1.05 / 0.3571 = **2.94**.

Both are **below 3:1**.

## Findings

| # | Status | Finding | Notes |
| --- | --- | --- | --- |
| **F1** (P5) | **CONFIRMED.** Same 2.30:1 value, calculated independently. | From/To/Date/Time focus indicators use `#97b47e`, 2.30:1 against the adjacent white card. That's below the 3:1 that SC 1.4.11 requires for focus indicators (per *Understanding 1.4.11*). From/To are also only **1 px** thick. | Correction to P5's description: From/To *also* get a faint 2 px Tailwind ring (slate-950 at 15 %, about 1.40:1), which doesn't help. The `outline:none` + border rule in `index.css` overrides the Tailwind `focus:border-slate-950`, because unlayered CSS beats the utilities layer. |
| **F1b** (new) | **CONFIRMED by measurement**, with a stated criterion caveat | The **site-wide** keyboard focus ring (3 px `#7da24b`) is **2.94:1** on white, just under 3:1. P5 listed links and buttons as passing; by the formula they fall short by 0.06. | Affects every control using the global `:focus-visible` (buttons and links app-wide), not just Search. The threshold is absolute, so 2.94 doesn't meet "at least 3:1". |
| 2.4.7 | Pass | Every control shows a visible indicator when focused by keyboard | — |
| 2.4.13 (AAA) | Fail, **advisory only** | No control has any pixel whose focused vs unfocused change reaches 3:1 | AAA isn't a release blocker unless the owner sets that target |
| **S1b / P5 F2** | **CONFIRMED** (existing evidence) | Date/time values clip at **361 to about 389 px** (375 px: inputs 129 px wide, "10/24/202…") | P4-27 evidence `207ab6446cfcd98bc872240c8a8026cbd9d18709` (`docs/qa-p4-27-search-polish.md`). P5's 375 px observation (129 px) matches exactly. #33 has the same CSS, so it wasn't re-measured. |

## Fix and recheck criteria for P3 (no patch applied here)

Paths, all **shared or Search styles**:
- `src/index.css`: lines 59–61 (global `:focus-visible`), 479–482 (`.location-field input:focus`), 551–554 (`.date-time-controls input:focus-visible`) and 565 (`@media (max-width: 360px)`).
- `src/components/search/LocationAutocomplete.tsx`: line 149, the Tailwind focus classes.

1. **From / To:** replace `outline:none` + the 1 px border with a `:focus-visible` indicator **at least 2 px** thick whose colour is **≥ 3:1 against `#ffffff`** (the input is transparent on the white card). Remove or align the conflicting Tailwind `focus:` classes so there's a single source of truth.
2. **Date / Time:** keep the 2 px outline but use a colour **≥ 3:1 against both `#ffffff` and `#fbfcf8`**.
3. **Global `:focus-visible` (F1b):** choose a colour ≥ 3:1 against every background it sits on. Measured examples, not prescriptions: `#64873f` (4.13:1 on `#fff`, 4.01:1 on `#fbfcf8`), `#4f7a2f` (5.05 / 4.90), and the existing `--green` `#234f3e` (9.29 / 9.02). Check any dark surfaces where the ring may touch, e.g. `#173f35`, where `#4f7a2f` is only 2.31:1. Use the offset, or a two-tone ring there.
4. **S1b:** date/time values must be fully visible at **every width from 320 to 400 px**, not just at the 320 and 390 px endpoints.
5. **Retest (P4):**
   - Rerun `qa/p4-35-search-focus-check.cjs` on the new SHA. Expect contrast ≥ 3:1 for every row, From/To indicator ≥ 2 px, and `:focus-visible` true.
   - Rerun `qa/p4-27-search-polish-check.cjs`, extending its S1 check to every width from 320 to 400 px.
   - Rerun `qa/p4-25-search-check.cjs` to confirm the combobox behaviour is unchanged.

## Gaps for P5 (not covered by Chromium automation)

- **Safari / Firefox:** native date/time controls draw their own focus and segment highlights. Recheck the indicator there; Safari doesn't focus buttons on click.
- **Windows High Contrast / forced-colors:** check that the indicators survive `forced-colors: active`. Not testable here.
- **Real phones:** iOS/Android date pickers and focus are not covered (P5-02 M3 BLOCKED).
- **Screen readers** (VoiceOver / TalkBack / NVDA): combobox and date/time announcements are not covered (P5-02 M4 BLOCKED).
- **Real 200 % browser zoom:** P5's check 18 was an approximation.

## Verdict

**F1 is confirmed** as an SC 1.4.11 (AA) failure on #33's Search fields. **F1b** (new) is a narrow 2.94:1 shortfall in the site-wide focus ring. **S1b / F2 is confirmed** from existing evidence. SC 2.4.7 passes. #33 stays frozen, and no application files were changed.
