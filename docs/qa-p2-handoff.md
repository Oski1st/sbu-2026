# QA: Person 2 handoff (PR #48 and #49)

Base for both PRs: RC3-UI `feat/release-candidate-3-ui` @ `7fa350da8deec7ce7d658c3c3e25e2f88a6d2b76`.
Date: 2026-10-25. Local only: PR builds served on port 4205 and the base on port 4206
(`PORT=… node server/index.mjs`). Browser: Playwright Chromium 1.64.1, `timezoneId` America/New_York
unless noted. Screenshots are in `docs/qa/p2-handoff/`.

## #49 `fix/search-time-normalization` @ c2cf626

### Static checks (exported tree of c2cf626)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `tsc -b` | PASS |
| `pnpm build` | PASS |
| `pnpm test` | PASS: 29 files, **191 tests** (base: 29 files, 189 tests) |
| `git diff --check 7fa350d c2cf626` | PASS (clean) |

### Browser checks on c2cf626

| Check | Result | Evidence |
| --- | --- | --- |
| `/?date=2026-11-03&time=04:30%20PM` sets the time field to `16:30` | PASS | PR `{date: 2026-11-03, time: 16:30}`; base falls back to `08:00` |
| Route-card times shift | PASS | 4:30 PM → 9:45 PM and 5:00 PM → 9:10 PM (base: 8:00 AM, 8:30 AM). The 30-minute stagger between alternatives is kept |
| Durations and fares unchanged | PASS | 5h 15m / 4h 10m and $46 / $61, identical to base |
| Midnight crossing (form set to 2026-11-05, 23:30) | PASS | 11:30 PM → 4:45 AM · Nov 6; Journey runs from 11:30 PM · Nov 5 to 4:45 AM · Nov 6 |
| Journey and Wallet use the same shifted times (in-page links) | PASS | Journey and Wallet both run Nov 5 11:30 PM EST → Nov 6 4:45 AM EST |
| Back, refresh and Wallet "Back to journey" keep the preference | PASS | URL keeps `?date=2026-11-05&time=23%3A30`; Back to results restores the form (2026-11-05, 23:30) |
| Invalid time (`abc`, `25:99`, `13:00 PM`) | PASS | Time falls back to `08:00`; no crash |
| `12:05 am` | PASS | Normalized to `00:05`; first card 12:05 AM |
| DST gap (`2027-03-14`, `02:30`) | PASS (documented) | First card shows 3:30 AM, the next valid Eastern time |
| No parameters (defaults unchanged) | PASS | Card times, durations, fares and links match the base exactly |
| Viewer in America/Los_Angeles | PASS | Cards still show 4:30 PM / 5:00 PM Eastern Time |
| Horizontal overflow at 1440/390/320 (Search, Journey, Wallet) | PASS | 0 px everywhere |
| Console and page errors | PASS | none |
| **Header Journey/Wallet links keep the preference** | **FAIL** | From `/journey/regional-connection?date=2026-11-05&time=23%3A30`, the header Wallet link opens `/wallet/regional-connection` and shows Oct 24, 8:00 AM EDT while Journey shows Nov 5, 11:30 PM |
| **Wording when no preference is applied** | **FAIL** | With no parameters, the route-card details say "Demo timeline shifted to your planning preference · Oct 24, 2026, 8:00 AM" and the compare dialog says "Times are a sample timeline shifted to your planning preference" while the form shows 2026-10-25. Nothing was shifted |
| **Wallet planning-preview label** | **FAIL** | Journey says "Sample timeline shifted to your planning preference (Eastern Time) · not a live schedule"; Wallet shows the shifted times with no such label |
| W3 wording replaced consistently | PASS | "your search date and time are not applied" is gone. Journey shows "Fixed sample itinerary times (Eastern Time)" without a preference and the shifted label with one |

### Fixes: `fix/search-time-normalization-v2` @ abe499b5ae149a43f78d25a991d09a3259938edd (from c2cf626)

- `AppLayout` header Journey/Wallet links append the URL planning preference through the new
  `planningSearchFrom()` in `searchState.ts`. The value is normalized, and nothing is added when the
  URL has no `date` or `time` parameter.
- `RouteCard` details and the `RouteComparison` note mention a shift only when a preference is applied.
  With no parameters they keep the base wording ("All times shown in Eastern Time · Sample departure Oct 24, 2026";
  "All times and fares below are sample data.").
- The Wallet header shows the same planning-preview label as Journey when a preference is applied.
- Two stale code comments were updated. Two tests were added: `planningSearchFrom` normalization, and the Wallet label with and without a preference.

v2 results: `tsc -b` PASS, build PASS, `pnpm test` PASS with **29 files, 193 tests**, `git diff --check` clean.
On v2 every check in the table passes, including the three that failed before. The header Wallet link now opens
`/wallet/regional-connection?date=2026-11-05&time=23%3A30` with the Nov 5–6 times. The compare note with no parameters is
"All times and fares below are sample data." The copied share link is
`/journey/regional-connection?date=2026-11-05&time=23%3A30`.
`node qa/e2e-check.cjs http://127.0.0.1:4205`: **120/122**. The 2 failures are the known closed-details false fails at 390/320
(Amtrak links in the closed map details are reported as unnamed). `node qa/smoke.mjs http://127.0.0.1:4205`: PASS. No console errors.

Observations (not caused by #49, not changed):
- After a share link is copied, the confirmation stays over "Choose this route" until the user closes it. This is unchanged from the base.
- In delay simulation, Journey still says "Simulation off. Original sample itinerary times are shown."
  Here "original" means without the simulated delay. A test asserts this text.
- With a 23:30 preference, the second card leaves at 12:00 AM, which is Nov 6. The card shows no date marker; Journey shows "· Nov 6".

Recommendation: put **v2 (abe499b)** into the next RC, not c2cf626.

Screenshots: `pr49-c2cf626-card-{1440,390,320}.png`, `base-7fa350d-card-{1440,390,320}.png`,
`pr49-v2-search-2330-1440.png`, `pr49-v2-journey-2330-1440.png`, `pr49-v2-search-1630-320.png`,
`pr49-v2-wallet-1630-390.png`.

## #48 `fix/map-coverage-copy` @ 5438bcc

Static checks on the exported tree of 5438bcc: frozen install PASS, `tsc -b` PASS, build PASS, `pnpm test` PASS
(**29 files, 189 tests**), `git diff --check 7fa350d 5438bcc` PASS (clean).

### Browser checks on 5438bcc (PR on 4205, base on 4206)

| Check | Result | Evidence |
| --- | --- | --- |
| Coverage panel reads clearly | PASS | "Not shown on this map" with a one-line intro. At 1440 it is a 2-column card grid; at 390 and 320 it is 1 column |
| Each operator's limitation stays explicit | PASS | SEPTA and NJ TRANSIT: "Commuter-rail alignment is not mapped."; LIRR: "Stony Brook is in the sample trips; its alignment is not mapped."; Greyhound / FlixBus: "Coach services use roads, so they are outside this rail layer." |
| Official page links | PASS | SEPTA, NJ TRANSIT and LIRR each have "Details ↗" pointing to the same official URL as the base |
| Boarding notes separated | PASS | A separate `prm-boarding-note` paragraph starts with "Boarding notes:" |
| Nothing clipped or overflowing | PASS | No panel child is outside the panel, no link overflows its card, and page horizontal overflow is 0 px at 1440/390/320 (PR and base) |
| Open and close the map details | PASS | Closed on load; open after 1 click; closed again after a 2nd click, with the panel hidden (PR and base, all 3 widths) |
| New-tab link names | PASS | 41 new-tab links in the details, all with an "opens in a new tab" warning, 41/41 distinct (same as base). The 3 changed links are "Details about SEPTA / NJ TRANSIT / LIRR (opens in a new tab)". 7 names use the exact "(opens in a new tab)". The other 34 corridor and station links, unchanged from the base, use "(official source/station, opens in a new tab)" |
| Console and page errors | PASS | none |
| `node qa/e2e-check.cjs http://127.0.0.1:4205` | PASS (known) | **120/122**. The 2 fails are the known closed-details false fails at 390/320 |
| `node qa/smoke.mjs http://127.0.0.1:4205` | PASS | home, deep links, SPA fallback, 404 asset, SEPTA proxy |

Note: on narrow screens the coverage panel is taller than the existing scroll area inside the details
(`max-height: min(24rem, 60vh)`), so it is read by scrolling inside the details, as in the base.

No defects, so no continuation branch was created. Recommendation: put **#48 @ 5438bcc** into the next RC as is.

Screenshots: `pr48-5438bcc-coverage-{1440,390,320}.png`, `pr48-5438bcc-panel-{1440,320}.png`,
`base-7fa350d-map-gaps-{1440,390,320}.png`.

## Not run

- e2e and smoke for #49 ran against v2 (abe499b), not c2cf626. v2 is c2cf626 plus the fixes above.
- No production or Render checks were run.
