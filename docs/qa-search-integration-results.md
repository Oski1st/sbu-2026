# Search integration QA (P4-25)

Owner: Person 4 (team lead and QA). Feature owner: Person 2, PR #29 `feat/search-integration` → `feat/map-routing-candidate`. Self-assigned in hub issue #2 as **P4-25**.

This is a browser QA result for a future-feature PR, not a `main` or production result.

## Target

| Item | Value |
| --- | --- |
| Tested SHA | **`3fa52d18aeade0488063f5a1c7d164c14054247a`** (PR #29, open draft) |
| Base | Combined #26 `35ed1965be9a2641fa31a2b8e1de60e7223260a3`, unchanged. #29 is one commit on top of it. |
| Diff | 9 files: `LocationAutocomplete.tsx` + test, `SearchForm.tsx`, `locationCatalogue.ts`, `searchIntegration.test.tsx`, `searchState.ts` + test, `SearchPage.tsx`, `index.css`. No national catalogue, location helper or geolocation code. |
| Environment | macOS, Node 22.23.4, pnpm 11.25.0, Playwright 1.64.1 with Chromium 156, served by `PORT=4173 node server/index.mjs` (production build `index-BSolG00z.js` / `index-CQnN6Ou8.css`). October 24, 2026 (US Eastern). |

## Results

| Check | Command | Result |
| --- | --- | --- |
| Locked install, typecheck, build | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm build` | Pass |
| Unit tests | `pnpm test` | **98 / 98** (18 files) |
| Regression browser suite (control) | `node qa/e2e-check.cjs <url>` | **121 / 121** |
| Canonical route IDs (control) | `node qa/p4-14-check.cjs <url>` | **52 / 52** |
| Expansion suite (control: aliases, unsupported city, deep links, filters) | `node qa/expansion-check.cjs <url>` | **122 / 122** |
| National map (control) | `node qa/p4-15-map-check.cjs <url> <shots> src/data/usOverviewMap.json` | **69 / 69** |
| **New Search checks** | `node qa/p4-25-search-check.cjs <url> <shots>` | **38 / 38** |

The new checks (`qa/p4-25-search-check.cjs`) cover:

- **A, combobox semantics:** both inputs have `role=combobox`, `aria-autocomplete=list`, `aria-controls=<id>-listbox`, start collapsed, are labelled ("From" / "To") and are required. The defaults are Philadelphia → Stony Brook.
- **B, keyboard:**
  - Typing opens and filters the list.
  - ArrowDown sets `aria-activedescendant` to the option, which gets `aria-selected=true`. Enter selects it and closes the list without submitting. ArrowUp from no selection wraps to the last option. Escape closes the list and keeps the typed text.
  - The alias "New York City" is accepted, Boston → New York City shows 3 sample connections, and `from` / `to` go into the URL.
- **C, no match and manual text:** "Atlantis" gives the "No supported sample cities" status and a visible note. After Escape the "not yet a supported sample city" hint shows and the typed text stays. Submitting gives an honest "0 sample connections" result, with no crash.
- **D, pointer:** clicking an option selects it, and focus stays in the input.
- **E, preferences:**
  - `date=2026-11-03&time=17:45` is written to the URL. The sample route cards are **byte-identical** to the default date/time, so no timetable is invented.
  - Refresh and a fresh-browser share link both restore the preferences.
  - Malformed values (`2026-02-30`, `25:00`, `abc`, `7:5`) fall back to 2026-10-24 08:00. Leap day `2028-02-29 23:59` is accepted.
- **F, history:** Back and Forward restore 06:15 and 21:30 when only the time differs.
- **G, shortcuts:** a corridor shortcut keeps the time preference, and the swap button exchanges origin and destination.
- **H, other controls:** filters and Compare still render.
- **I, small screens (320 and 390 px, touch):** the open listbox stays in the viewport with no page overflow. Options are 60 px tall. Tapping selects the tapped city and closes the list. Date and time inputs are 44 px tall and inside the viewport.
- **J, focus, privacy and errors:** a visible focus indicator. **No `getCurrentPosition` / `watchPosition` call** in the whole session. No page or console errors.

Screenshots: [1280](qa-screenshots/search/p4-25-search-1280.png), [390](qa-screenshots/search/p4-25-search-390.png), [320](qa-screenshots/search/p4-25-search-320.png).

## Findings

| # | Severity | Owner | Finding | Evidence | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| S1 | Low: readability at 320 px | Person 2 (`index.css` Search controls) | At 320 px the date and time inputs are 99 px wide (16 px text), and the values are visibly clipped: "10/24/2…" and the time's AM/PM. At 390 px both fit ("10/24/2026", "08:00 AM"). | [320 px screenshot](qa-screenshots/search/p4-25-search-320.png) | Stack date and time vertically below about 360 px, or let each take the full row |
| S2 | Low: suggestion order | Person 2 (`locationCatalogue.ts`) | Suggestions use substring matching in catalogue order, with no prefix ranking. "ba" → Albany, Baltimore; "ch" → **Richmond**, Charlotte, Charleston; "or" → Orlando is **6th** of 7. A user typing the start of a city name sees mid-word matches first. | Probe on `3fa52d1` | Rank exact, then prefix (name or alias), then word-start, then substring |

Harness note: the first run of I3 assumed "ba" would list Baltimore or Boston first and failed (the tap correctly selected Albany). The check now compares against the tapped option's own text. That surfaced S2; it isn't an app defect in I3.

## Verdict

**No QA blockers for #29 at `3fa52d1`.** The combobox, preference persistence, history, shortcuts, small-screen layout and privacy all behave as described, and all four regression suites pass unchanged. S1 and S2 are low-severity polish items.

Not tested:
- Real devices and screen readers (Person 5's P5-01 scope).
- Browsers other than Chromium.
- National catalogue or location integration (not in this candidate).
- Production.
