# P5 functional sweep — candidate #33

Person 5 · QA docs only · automated run in installed Google Chrome 156.0.8078.47. **Not** a human, screen-reader or phone test.

| Item | Value |
| --- | --- |
| Tested app SHA | `4e415429e583792f90746ee8e4c055730e090fa4` (PR #33; base #32 `3f41b76…`), local `vite` at 127.0.0.1:5178. **Not deployed.** |
| Build checks at SHA | frozen install OK · typecheck exit 0 · build exit 0 · tests 21 files / 107 passed |
| Script | `docs/qa-device/scripts/p5-functional-sweep.mjs` · raw output `docs/qa-device/results/p5-05-sweep-33.json` |
| Production (`oneline-sbu-2026.onrender.com`) | Visited 2026-10-25. It stayed on Render's "Application loading" page (free-tier wake-up), so it was **not tested** and its identity is unknown. |

## Results

| Area | What was exercised | Result |
| --- | --- | --- |
| A. Every city pair | All 552 ordered pairs of the 24-city catalogue through `/?from=&to=` | PASS: 552/552 return 1–3 sample routes; form fields echo the inputs; no NaN/undefined/Invalid Date text |
| B. Journey and Wallet pages | All 1,651 unique route IDs from A → `/journey/<id>` and `/wallet/<id>` (3,302 pages) | PASS. Eight pages first read as near-empty; they were re-checked by hand and render fully (the script read the lazy-loaded page too early; harness artifact) |
| C. Aliases | `NYC`→`philly`, `DC`→`long island`, `Washington, D.C.`, `  new   york `→`MIAMI` | PASS: all resolve to 3 routes |
| C. Unknown or same city | `Chicago`, `Atlantis`→`El Dorado`, `Boston`→`Boston`, 300-char string, emoji | PASS: clear messages ("not yet a supported sample city", "Choose two different cities") |
| C. Injection | `<img src=x onerror=alert(1)>` as From | PASS: shown as text; no script ran |
| D. Dates through the URL | 20 values: leap days 2028-02-29 / 2000-02-29, invalid 2026-02-29 / 2100-02-29 / 2026-04-31 / month 13 / month 00, DST 2026-03-08 and 2026-11-01, 1999, 2099, 9999, malformed | 19 PASS. **FAIL S1:** `0001-01-01` is rejected (see below) |
| E. Times through the URL | 00:00, 23:59, 12:00, 12:30, invalid 24:00 / 23:60 / 9:05 / -01:00 / ab:cd / 07:30:00 | PASS: valid values kept, invalid ones fall back to 08:00 |
| F. Dates typed into the date picker | 01/01/2027, 02/29/2028, 12/31/2099, 07/04/1776, 03/08/2026, then submit | PASS: typed value goes to the URL and results stay correct |
| F. Edge entry | 5-digit year; cleared date | **FAIL S2**. A cleared date is correctly blocked by `required` (S3 withdrawn). |
| G. Filters and sort | mode {all, rail, bus, rail+bus} × sort {recommended, fastest, fare} on Boston→Miami; Amtrak toggle | PASS: counts consistent; Fastest/Fare order correct where values exist; Rail+bus is legitimately empty for Boston→Miami and returns 2 for Washington, DC→Stony Brook |
| H. Swap | Boston↔Miami | PASS |
| I. Layout | Long-name pairs (Fort Lauderdale→Portland, Washington, DC→Stony Brook) at 320/375/390px, Search and Journey | PASS: no horizontal overflow |
| Z. Console | Whole sweep | One 404, for `/favicon.ico` (no icon is declared). Cosmetic. |

## Findings

**S1 (low): dates in years 0001–0099 are rejected.** `searchState.ts` validates the date with `Date.UTC(year, …)`, and JavaScript maps years 0–99 to 1900–1999. So `?date=0001-01-01` silently becomes 2026-10-24. Repro: open `/?date=0050-06-01` and the field shows 10/24/2026.

**S2 (medium): a 5-digit year is accepted by the date picker, then silently dropped.** Chrome's date control lets you type `01/01/20270`. On submit the URL stores `date=20270-01-01`, but the field and the state show the default 10/24/2026. The URL and the form now disagree, and the user gets no message. Repro: Boston→Miami, type 01/01/20270 in Date, click Find my way.

**S3 (withdrawn, not a bug).** Clearing Date and submitting looked like a stale URL. Re-checking showed the field is `required` and the browser correctly blocks the submit with "Please fill out this field." The script didn't detect the native bubble.

**Fix for S1 and S2:** draft PR #38, branch `fix/p5-search-date-bounds` at `1859a667e74577fc607cb96c599d8188cc2ac049`, from exact #33. It adds `min`/`max` on the date input and uses `setUTCFullYear` in `readSearchState`. Typecheck and build pass; 108/108 tests pass, one of them new. In a browser, `?date=0050-06-01` now loads as entered, and a 5-digit year is blocked with "Value must be 12/31/9999 or earlier." This needs independent QA before it counts as verified.

**D1 (product gap, medium): generated routes show no prices or distances.** Every one of the 1,651 generated routes says "Check fares with the operator"; only the original Philadelphia→Stony Brook demo carries sample fares. "Lowest sample fare" has nothing to sort for 551 of 552 pairs. No distance is shown anywhere.

**D2 (disclosed limitation, not new):** itinerary times always start at 8:00 AM on Oct 24, whatever date and time the user picks. The copy says so; dated timetables are Person 3's active work.

**M1 (known, not new):** the opening map has no rail lines and still has the Alaska/Hawaii insets. Person 2's draft #36 replaces it, and Person 4 is auditing it (P4-37).

Known findings F1 (focus contrast) and F2 (375px date clip) still reproduce. They are assigned to Person 3 and are not repeated here.
