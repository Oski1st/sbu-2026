# P5-02 — Device and accessibility QA of the PR #29 search candidate

Person 5 · docs only · no application code changed.

## Target and environment

| Item | Value |
| --- | --- |
| Application target (tested) | `dad01cf86b64ac8f92794345913e067b21edcc74` (PR #29 head, `feat/search-integration`) |
| PR #29 base | `feat/map-routing-candidate` at `35ed1965be9a2641fa31a2b8e1de60e7223260a3` |
| QA document commit | Recorded in the draft QA PR description. It is separate from the application target above. |
| Where it ran | Local `pnpm dev` (Vite 7.3.7) on the tester's Mac at `http://127.0.0.1:5174`. This is a **local candidate, not a deployment**. |
| Host | macOS 26.6 (25G83), Apple Silicon |
| Toolchain | Node v22.23.4 · pnpm 11.25.0 (Corepack, pinned by `packageManager`) |
| Checks at target | `pnpm install --frozen-lockfile` OK · `pnpm typecheck` exit 0 · `pnpm build` exit 0 · `pnpm test` 19 files / 101 tests passed |

Port note: port 5173 was already taken by an unrelated local checkout, so Vite picked 5174. Only the 5174 server, started from the checkout at the target SHA, was tested.

P5-01 production-baseline evidence (`https://oneline-sbu-2026.onrender.com`) is separate and is not covered here. Nothing here says anything about what production is running.

## Browsers and devices

| ID | Device / OS | Browser (version) | How used |
| --- | --- | --- | --- |
| D1 | Mac, macOS 26.6 | Chromium 152.0.7977.167, the browser built into the Claude desktop app (Claude/3.6556.2) | Driven by automation with real key events, plus DOM and computed-style inspection. Narrow widths are **resized desktop viewports**, not phones. |
| D2 | Mac, macOS 26.6 | Google Chrome 156.0.8078.47 | Manual tester pass, see the results below |
| D3 | Mac, macOS 26.6 | Safari 26.6.2 | Manual tester pass, see the results below |
| P1 | Real phone | See the results below | Same Wi-Fi network, local network only, no tunnel |
| SR | VoiceOver (macOS) | Safari 26.6.2 | Manual tester pass. Automation never counts as a screen-reader test. |

Firefox is not installed on the test machine. Safari is the second desktop browser.

## Results (D1, automated Chromium with resized viewports)

Legend: PASS · FAIL · BLOCKED · NOT TESTED.

| # | Check | Steps | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Autocomplete suggestions | In From, select the text and type `new` | A listbox with matching sample cities | `aria-expanded=true`; options New Haven CT and New York NY; polite status "2 supported sample cities available." | PASS | — |
| 2 | Keyboard selection | With the list open: ↓, ↓, Enter | The highlight moves through the options (`aria-activedescendant`, `aria-selected`) and Enter picks one | ↓ highlights New Haven, then New York; Enter sets "New York", closes the list, focus stays in the input | PASS | — |
| 3 | Escape | Type `phi`, then press Escape | The list closes and focus stays put | `aria-expanded=false`, focus still on From | PASS | — |
| 4 | No match | Type `Zzyzx` | A clear no-match message | Visible message: "No supported sample cities match “Zzyzx”. Try a city from the OneLine sample catalogue." The polite status is announced too. Minor: `aria-expanded` stays `true` over an empty listbox. | PASS (note) | — |
| 5 | Manual entry | Type `new york` without picking a suggestion, Tab away, submit | The typed city is accepted | Accepted case-insensitively. URL `?from=new+york`. Live region: "1 sample connection for new york → Stony Brook" | PASS | — |
| 6 | Tab / Shift+Tab order and traps | From the top of Search, press Tab 22 times, then Shift+Tab 4 times | Logical order, nothing unreachable, no traps | Skip link → home → Search/Journey/Wallet → From → Swap → To → Date → Time → Find my way → region cards → "See all 24 cities" summary. Shift+Tab reverses cleanly. No trap found. | PASS | — |
| 7 | Visible focus indicator | Tab to each form control and read its computed focus style | Every control shows a focus indicator with at least 3:1 contrast (WCAG 2.4.7 / 1.4.11) | Links and buttons show a 3px `rgb(125,162,75)` outline. **From/To** show only a 1px bottom border `#97b47e` (`src/index.css:479-482`). **Date/Time** show a 2px `#97b47e` outline (`src/index.css:551-554`). `#97b47e` on the white form card measures **2.3:1**, below 3:1. | **FAIL** | — |
| 8 | Date/time at 320 px (resized) | Load `/?date=2026-11-15&time=17%3A30` at 320×700 | Both values fully visible | The fields stack. "11/15/2026" and "05:30 PM" are fully visible. | PASS | `screenshots/p5-02-search-form-320-resized-chromium.jpg` |
| 9 | Date/time at 360 px (resized) | Same URL at 360×740 | Fully visible | The fields stack and both are fully visible | PASS | `screenshots/p5-02-search-form-360-resized-chromium.jpg` |
| 10 | Date/time at 375 px (resized) | Same URL at 375×812 | Fully visible | The fields sit side by side, each 129px wide, and the **year is clipped**: "11/15/202…" runs under the calendar icon. Cause: the stacking breakpoint is `@media (max-width: 360px)` (`src/index.css:565`), so widths of 361px and up go side by side before there is room. | **FAIL** | `screenshots/p5-02-search-form-375-resized-chromium-date-clipped.jpg`, `screenshots/p5-02-date-time-375-resized-chromium-zoom.png` |
| 11 | Date/time at 390 px (resized) | Same URL at 390×844 | Fully visible | Side by side at 136px. The full "11/15/2026" is visible but tight against the icon. | PASS (marginal) | `screenshots/p5-02-search-form-390-resized-chromium.jpg` |
| 12 | Search submission | Set Date to 2026-11-15 and press Enter on "Find my way" | The URL records the preference; results are announced | URL `?from=new+york&date=2026-11-15`; new history entry; live region updates | PASS | — |
| 13 | Date-only back/forward | After #12, go Back, then Forward | Back restores the previous date; Forward restores 2026-11-15 | Back → `?from=new+york`, date field 2026-10-24 (the default). Forward → date field 2026-11-15. | PASS | — |
| 14 | Refresh/share reconstruction | Load `/?from=new+york&date=2026-11-15&time=17%3A30` fresh | All values restored from the URL | From "new york", To "Stony Brook", Date 2026-11-15, Time 17:30; results rendered | PASS | — |
| 15 | Journey → Wallet → back | From `/?date=2026-11-15&time=17%3A30`, choose a route → View ticket wallet → Back → Back | Each step loads; Back returns to Journey, then to Search with its preferences | `/journey/regional-connection` → `/wallet/regional-connection` (4 legs) → Back to Journey → Back to Search with Date 2026-11-15 and Time 17:30 intact. Focus moves to `#main-content` on each route change; exactly one `main` per page. The demo step resets to "Ready to start" after Back (state is not kept). | PASS | — |
| 16 | Journey manual demo controls | On `/journey/regional-connection`: Start demo → Enter on Next → → → ← → Reset | Steps move forward and back; status is announced; Reset returns to the start | Next and Previous enable once there are steps. → and ← move steps while the controls have focus. Status announces e.g. "Current step: Northeast Corridor from Trenton Transit Center to New York Penn Station." Reset returns to "Choose Start demo journey…". On the one-leg New York → Stony Brook trip, Next and Previous correctly stay disabled. | PASS | — |
| 17 | Horizontal overflow at 320 px (resized) | Measure `scrollWidth` against the viewport on Search, Journey and Wallet | No sideways scrolling | Search, Journey and Wallet all measure 320 = 320 | PASS | — |
| 18 | 200% zoom (approximation) | Resize to a 640 CSS-px viewport, the equivalent of 1280px at 200% | No overflow; controls usable | No overflow (640 = 640). Date/time fields 147px wide, side by side and readable. **This approximates zoom; it is not real browser zoom.** | PASS (approx.) | — |
| 19 | Reduced motion | Code inspection | Motion is disabled when the user asks for reduced motion | `src/index.css:1959-1969` removes all animations and transitions under `prefers-reduced-motion: reduce`. Journey's entrance animation applies only under `no-preference`. Search smooth-scroll checks `matchMedia`. **A runtime check with the OS setting turned on is a separate row below.** | PASS (code only) | — |
| 20 | Sample-data wording | Read Search, Journey and Wallet | The date preference is not presented as a real timetable | Search: "Saved in this share link. Sample itinerary times do not change." and "Sample plans · Date/time are planning preferences, not live schedules." Journey: "Sample route concept… illustrative, not verified services." Wallet: "demo mockup… Times are simulated itinerary data." Note: with a 2026-11-15 preference, Journey and Wallet still show sample times on **Oct 24** ("8:00 AM · Oct 24"). That matches the disclaimer but could surprise a user; consider a "sample date" label next to the timeline dates. | PASS (note) | — |

Other observations, not counted as failures:
- The default date preference is a fixed demo constant, `2026-10-24` (`src/data/searchState.ts:7`), which matches the sample trips. On the test date (2026-10-25) it is a past date.
- The one-leg LIRR concept route uses the ID `east-new-york--stony-brook--amtrak`, but its content is LIRR only. This is cosmetic, in the URL slug.
- Typing digits into the native date field did not register through automation, so the date was set with a form-fill tool. This is a limitation of the test method, not an app defect. A manual check of date typing on each real browser is below.

## Manual results (real browsers, phone and screen reader)

| # | Device / browser | Check | Result | Notes / repro |
| --- | --- | --- | --- | --- |
| M1 | D2 Google Chrome 156 | Autocomplete, keyboard, focus, 375 px date, real 200% zoom | NOT TESTED | Installed and the candidate was opened, but the scripted manual pass was not run in this session. |
| M2 | D3 Safari 26.6.2 | Autocomplete, keyboard (Option+Tab for links), date/time entry, 200% zoom | NOT TESTED | Installed and the candidate was opened, but the scripted manual pass was not run in this session. |
| M3 | P1 real phone | Search form, date/time visible, submit, Journey → Wallet → back | BLOCKED | No real phone was available for this session. The server was never exposed beyond 127.0.0.1, and no tunnel was used. |
| M4 | SR VoiceOver + Safari | Combobox announcements, results live region, Journey demo status, Wallet | BLOCKED | No screen-reader session was available. ARIA attributes were inspected in D1 (combobox, listbox, `aria-activedescendant`, polite status regions), but that is **not** a screen-reader test. |
| M5 | macOS Reduce Motion on | Search → Journey → Wallet; no animated entrances | BLOCKED | The OS setting was not changed in this session. Code inspection only (check 19). |

## Failures — reproduction

**F1 — Search form focus indicator below 3:1 contrast (check 7)**
1. Open the candidate at desktop width.
2. Press Tab until From has focus. Continue to To, Date and Time.
3. Expected: a clearly visible focus indicator with at least 3:1 contrast.
4. Actual: From/To show only a 1px `#97b47e` bottom border; Date/Time show a 2px `#97b47e` outline. That colour is 2.3:1 on the white form card. Other controls use a 3px darker outline and pass.

**F2 — Date year clipped at 375 px (check 10)**
1. Open `/?date=2026-11-15&time=17%3A30` in a 375px-wide viewport (resized desktop Chromium).
2. Scroll to Planning preference.
3. Expected: "11/15/2026" fully visible.
4. Actual: the fields are side by side and the year is cut off under the calendar icon. The layout stacks only at 360px and below.
5. Real-phone confirmation: see M3.

## Totals

D1 automated (20 checks): **18 PASS · 2 FAIL · 0 BLOCKED**. Five of the passes carry notes or caveats: #4, #11, #18 (approximation), #19 (code only) and #20.
Manual (5 rows): 0 PASS · 0 FAIL · 3 BLOCKED · 2 NOT TESTED.

**Overall: 18 PASS · 2 FAIL · 3 BLOCKED · 2 NOT TESTED.**

All narrow-width results are from resized desktop Chromium. None are real-phone observations.

## Blockers

- **Real phone (M3):** none available in this session.
- **Screen reader (M4):** no VoiceOver, TalkBack or NVDA session.
- **OS Reduce Motion (M5):** not exercised at runtime.
- **Google Chrome / Safari manual passes (M1, M2):** both browsers are installed but the passes were not run. The other-desktop-browser requirement is therefore unmet in this revision.
