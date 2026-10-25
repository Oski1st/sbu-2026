# RC1 cross-browser QA (Chromium, Firefox, WebKit)

Target: #39 `feat/release-candidate-1` @ `2d0b5ef7fa8bce374adaa72abf6bd522c097772b`, built with
`pnpm install --frozen-lockfile && pnpm build`, served with `PORT=4188 node server/index.mjs`.
Date: 2026-10-25, macOS 15 (Darwin 24.6), Node 22.23.4, Playwright 1.64.1, all headless.
Tester only. No application code was changed.

| Engine | Playwright build | Version reported |
| --- | --- | --- |
| Chromium | chromium-1248 | 156.0.8078.4 |
| Firefox | firefox-1555 | 157.0 |
| WebKit (Safari engine) | webkit-2370 | 27.2 |

Profiles: **desktop** = 1280x900. **phone**: WebKit = `devices["iPhone 13"]` (390x664, DPR 3, touch, iOS UA);
Chromium = 390x844 `isMobile` + touch; Firefox = 390x844 + touch (Playwright's Firefox does not support `isMobile`).
Map overflow was also checked at 320, 375 and 390 px in each engine.

## Results

### Feature pass (`qa/rc1-cross-browser-features.cjs`)

| Area | Chromium desktop | Chromium phone | Firefox desktop | Firefox phone | WebKit desktop | WebKit phone |
| --- | --- | --- | --- | --- | --- | --- |
| Search: autocomplete (type/arrow/Enter/Escape) | PASS | PASS | PASS | PASS | PASS | PASS |
| Search: pick suggestion with mouse (desktop) / tap (phone) | PASS | PASS | PASS | PASS | PASS | **FAIL (F1)** |
| Search: aliases (Philly, NYC, DC, Long Island) | PASS | PASS | PASS | PASS | PASS | PASS |
| Search: date/time fill + read back | PASS | PASS | PASS | PASS | PASS | PASS |
| Search: date/time rendering | PASS | PASS | **year clipped (F3)** | **year clipped (F3)** | PASS | **year clipped (F3)** |
| Search: submit, URL date/time, refresh, Back/Forward | PASS | PASS | PASS | PASS | PASS | PASS |
| Search: filters + sort in URL, refresh, Back | PASS | PASS | PASS | PASS | PASS | PASS |
| Compare dialog: open, Escape, Close, fits viewport | PASS | PASS | PASS | PASS | PASS | PASS |
| Compare dialog: focus returns to Compare button | PASS | PASS | PASS | PASS | **FAIL (F2)** | **FAIL (F2)** |
| Rail map: renders, 8 routes / 26 stations / 49 states, labels no overlap | PASS | PASS | PASS | PASS | PASS | PASS |
| Rail map: details open/close (click, Enter, Space), bounded scroll panel | PASS | PASS | PASS | PASS | PASS | PASS |
| Rail map: no overflow at 320/375/390 (details closed + open) | n/a | PASS | n/a | PASS | n/a | PASS |
| Journey: timeline times (same in NY and LA time zones) | PASS | PASS | PASS | PASS | PASS | PASS |
| Journey: simulate delay / reset | PASS | PASS | PASS | PASS | PASS | PASS |
| Journey: details expand/collapse, `inert` skips collapsed link, focus stays on toggle | PASS | PASS | PASS | PASS | PASS | PASS |
| Journey: demo controls (Start, Next, ArrowLeft, Reset) | PASS | PASS | PASS | PASS | PASS | PASS |
| Journey: Wallet link | PASS | PASS | PASS | PASS | PASS | PASS |
| Wallet: 4 tickets, real SEPTA panel, checklist, 502 + success mocks | PASS | PASS | PASS | PASS | PASS | PASS |
| Wallet: Back → Journey → Search, Forward x2 | PASS | PASS | PASS | PASS | PASS | PASS |
| Keyboard: skip link, Journey wallet link reachable | PASS | PASS | PASS | PASS | PASS (Alt+Tab) | PASS (Alt+Tab) |
| Keyboard: visible focus on every stop (first 40) | FAIL* | PASS | PASS | PASS | **FAIL (F4)** | **FAIL (F4)** |
| Console errors, failed / 4xx-5xx same-origin requests | PASS | PASS | PASS | PASS | PASS | PASS |
| **Total** | **70/71** | **74/74** | **71/71** | **74/74** | **69/72** | **71/75** |

\* Chromium desktop: the walk read `outline-style: none` on the date/time inputs, but a separate check on the same
inputs read `:focus-visible` with a 2 px outline and the screenshot shows the green ring
(`compare/compare-desktop-date-field-keyboard-focus.png`). Treated as a timing artefact of the walk, not a bug.

### Regression suite (`qa/rc1-cross-browser-e2e.cjs`, a copy of `qa/e2e-check.cjs`)

| Engine | Result | Failures |
| --- | --- | --- |
| Chromium | 119/121 | Known false positive: 320/390 "unnamed" links inside the closed map `<details>` (same as Person 1's RC1 run). |
| Firefox | 118/121 | Same 2 known false positives, plus "reach in-page Wallet link by Tab": the walk starts at a segment toggle below the link and relies on Tab wrapping past the end of the document; headless Firefox moves focus into browser chrome and does not wrap. The feature pass reaches the same link from the top of the page in Firefox (PASS). Harness artefact. |
| WebKit | 115/121 | Same 2 known false positives, plus 4 "unnamed" links on mobile Journey pages: these are the collapsed, `inert` "Get tickets" links. WebKit returns `innerText === ""` for inert content (Chromium/Firefox return the text), so the harness calls them unnamed. They are invisible, take no height and are not focusable (`qa/rc1-webkit-probes.cjs`, probe 2). Harness artefact. |

No page errors, console errors or failed requests in any engine.

## Findings

### F1: High, WebKit touch only. Tapping an autocomplete suggestion does nothing

- **Repro:** WebKit with `devices["iPhone 13"]` → `/` → tap To → type `New` → tap "New York" in the list.
  The field stays `New` and the list stays open. Chromium and Firefox (touch) fill "New York". Mouse click in WebKit works.
- **Cause (proven separately):** `LocationAutocomplete.tsx` (line 172 at RC1) runs `onPointerDown={(event) => event.preventDefault()}`
  on every option. In WebKit touch input, cancelling `pointerdown` also cancels the click that follows. In
  `qa/rc1-webkit-probes.cjs` probe 1, a plain page with no OneLine code shows the same thing:
  WebKit tap on an `li` with pointerdown prevented → no click. With **mousedown** prevented → click fires and the input keeps focus (no blur).
  Chromium and Firefox fire click in all three cases.
- **Likely file:** `src/components/search/LocationAutocomplete.tsx`. Suggested fix for the owner: use `onMouseDown` preventDefault in place of `onPointerDown`, which matches probe case b. Confirm on a real iPhone.
- **Impact:** on iPhone Safari, users cannot pick suggestions by touch. They can still type the full city name or use the prefilled demo pair.
- **Caveat:** Playwright WebKit on macOS emulates iOS. Real iOS Safari also builds pointer events from touches, so the same result is likely, but it has not been checked on a device.
- Evidence: `docs/qa/rc1-cross-browser/results/features-webkit-phone.log`, `results/webkit-probes.log`.

### F2: Low, WebKit (desktop + phone). After a mouse-opened Compare dialog closes, focus does not return to the Compare button

- **Repro:** WebKit → `/` → check two "Compare" boxes → click **Compare routes** → press Escape (or click ✕).
  `document.activeElement` is an unnamed `DIV`, not `.compare-tray-action`. If the dialog was opened from the keyboard (focus the button, press Enter), focus does return. Chromium and Firefox return focus in both cases.
- **Cause:** `RouteComparison.tsx` saves `document.activeElement` when the dialog opens and restores it on close.
  In Safari a mouse click does not focus a `<button>`, so the saved element is not the opener. This is Safari's normal behaviour, but the app relies on the opener having focus.
- **Likely file:** `src/components/search/RouteComparison.tsx` (and/or `SearchPage.tsx`). Possible fix: focus the opener explicitly, like `SegmentCard` does with `event.currentTarget.focus()`.
- Evidence: `results/webkit-probes.log` probe 3.

### F3: Low (cosmetic), Firefox desktop+phone and WebKit phone. Year in the date input is clipped

- **Repro:** Firefox at 1280 or 390 → Search form → Date shows `11/03/202` with the last digit under the calendar icon.
  WebKit at the iPhone 13 profile shows `10/24/202(`. Chromium and WebKit desktop show the full date.
  The value is still correct and reads back as `YYYY-MM-DD`.
- **Cause:** the inputs are about 108–142 px wide (`.date-time-controls label { flex: 1 1 100px }`, 16 px font). Firefox adds spaces around its separators, and on WebKit's iPhone profile the input is only 108 px wide.
- **Likely file:** `src/index.css` (`.date-time-controls`).
- **Caveat:** real iOS Safari draws a date input as a native button, not the macOS segmented field shown here. The WebKit phone rendering is therefore not exact iPhone evidence. The Firefox clipping is real.
- Screenshots: `compare/compare-desktop-date-time-field.png`, `compare/compare-phone-date-time-field.png`, `compare/compare-phone-autocomplete-open.png`.

### F4: Low, WebKit. Date/time inputs show no app focus ring

- When you Tab into a date or time segment in WebKit, `:focus-visible` does not match the `<input>` and `outline-style` is `none`. The only indicator is the native blue highlight on the segment. Chromium and Firefox show the green 2 px ring as well.
- The highlight is visible (`compare/compare-desktop-date-field-keyboard-focus.png`), so this is a consistency issue, not a missing indicator. Optional fix: add `.date-time-controls input:focus-within` / `:focus` styling in `src/index.css`.

### Informational (not app bugs)

- **WebKit Tab skips links and buttons (platform default).** Plain Tab in Playwright WebKit stops only at
  form fields and `<summary>`. It skips the skip link, nav links, buttons and route CTAs. This is the macOS/Safari default
  ("Press Tab to highlight each item" off). With Option(Alt)+Tab, the order matches Chromium:
  skip link → logo → Search/Journey/Wallet → map details → From → Swap → To → date → time → Find my way → …
  Every stop then has a visible ring, apart from F4. Not treated as an app bug.
- **WebKit Tab inside the open modal** alternates between `BODY` and dialog controls. Focus never reaches page content behind the dialog.
- **Native pickers:** only `fill()` and keyboard typing were automated. Typing `0945AM` into a focused time input gave `09:45` in Chromium desktop and Firefox, left the value unchanged in Chromium phone, and gave `12:30` in WebKit.
  Segment typing behaves differently in each engine, so this is information only. The pop-up calendar and clock were not opened.
- **Wallet date format:** WebKit's Intl output reads "Oct 24 at 8:00 AM EDT". Chromium and Firefox read "Oct 24, 8:00 AM EDT". Cosmetic, no action.
- **Map:** identical in all three engines at 1280, 390, 375 and 320 px. Station dots (zero-length round-cap strokes) render in all engines. WebKit draws a slightly larger `<summary>` triangle.
- **Rendering compared side by side:** search, map, map details, autocomplete, compare dialog, journey (plain, delay, details, demo step), wallet and SEPTA states.
  No other layout differences were found.

## Not automated / needs a human

- Real Safari on macOS and iOS: device touch (F1 needs confirming on an iPhone), Safari "Press Tab to highlight each item" / Full Keyboard Access settings, and the iOS date/time wheel pickers.
- Native date/time pop-up pickers in all engines.
- Screen readers (VoiceOver, NVDA, TalkBack). Accessible names were checked only through the DOM.
- Real Firefox on Android; Playwright's Firefox does not emulate mobile.

## Files

- `qa/rc1-cross-browser-features.cjs`: feature pass (engine × profile). Usage in the file header.
- `qa/rc1-cross-browser-e2e.cjs`: copy of `qa/e2e-check.cjs`. Adapted only to (1) choose the engine from argv[4];
  (2) drop `isMobile` for Firefox; (3) in WebKit, use Alt+Tab for the keyboard walk when plain Tab skips links. The original is unchanged.
- `qa/rc1-webkit-probes.cjs`: isolated probes for F1, F2 and the WebKit `innerText` artefact.
- `qa/rc1-cross-browser-sidebyside.cjs`: builds the Chromium | Firefox | WebKit comparison images.
- `qa/rc1-cross-browser-run.sh`: runs everything. The commands were run one by one in this session.
- `docs/qa/rc1-cross-browser/results/`: logs and JSON for every engine × profile, the e2e logs, and the probe log.
- `docs/qa/rc1-cross-browser/compare/`: 31 side-by-side screenshots (`compare-<desktop|phone>-<view>.png`).
  The raw per-engine screenshots were not committed (about 9 MB). Re-run the feature script to regenerate them.
