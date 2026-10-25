# P4-31: dated-transit (timetable) QA protocol

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-31`). This is a **plan, not a result**. **Every test below is NOT RUN**, and nothing here claims operator coverage, correctness or a pass.

## Target and provenance

| Item | Value |
| --- | --- |
| **Candidate** | **PENDING.** P3's `feat/dated-transit-search` has no frozen pushed PR yet. Testing starts only when Person 6 assigns a full frozen SHA. |
| Dependency baseline | #30 `fe89f9ec5fc67bfdc779121143970684d649f143` (catalogue + helper, P4-26), on combined #26 `35ed1965be9a2641fa31a2b8e1de60e7223260a3` |
| Search source (provenance only) | #29 `dad01cf86b64ac8f92794345913e067b21edcc74` (P4-25 / P4-27). P3 reported an earlier cherry-pick of #29 `3fa52d1` as `ad713c8` on the new branch. |
| Contract read | P3 issue #1 comments 6393249833 and 6393258754; Person 6 assignment 6393270962 |

**Entry gate**, checked before any test runs:

1. The PR is open and frozen, with full head and base SHAs.
2. The transferred #30 and #29 commits are **patch-id identical** to their sources, or else each adaptation is listed.
3. Every changed path is inside the owned paths P3 declared.
4. A snapshot manifest exists (described in section A).

If any of these is missing, that's reported as a blocker and the test matrix doesn't run.

## Test matrix

Kind: **D** = deterministic (unit, Node or script), **B** = browser (Playwright / Chromium), **P5** = real device or screen reader (handed to Person 5). Severity if it fails: **Blk** = release blocker, **Hi**, **Med**, **Low**.

| # | Area | Inputs | Expected behaviour | Evidence to collect | Kind | Sev |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Source provenance | `server/data/timetable-manifest.json` and the saved feed ZIPs | Each feed has its URL, retrieval date/time, HTTP status, SHA-256 and `feed_info` version/start/end. Amtrak: `content.amtrak.com/content/gtfs/GTFS.zip`. LIRR: `rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip`. | Manifest copy; fresh hash of any re-downloaded feed, without bypassing access controls | D | Blk |
| A2 | Licence / redistribution | Operator terms pages | Written evidence that bundling a derived snapshot is allowed. MTA's developer page says its feeds are free to use. The Amtrak terms are an **open input** (see section U). | URLs, quotes and retrieval dates in the evidence doc | D | Blk |
| A3 | Snapshot reproducibility | `scripts/build-timetables.py` + saved ZIPs | The rebuild is **byte-identical** to the committed `timetables.json.gz` | `cmp` result plus both hashes | D | Hi |
| A4 | Snapshot integrity | A tampered or truncated snapshot | The server refuses it with a clear error; it never serves partial data or falls back to sample data | Server log + API response | D | Hi |
| A5 | Validity window | Dates before, inside and after each feed's start/end | Out-of-window dates show an honest "no published timetable for this date / operator" message and no results | API JSON + screenshot | D+B | Blk |
| B1 | Service calendar | `calendar.txt` weekday patterns; 25 Oct (Sun) vs 26 Oct (Mon) 2026 | Only services active on the requested date appear | Fixture + real-feed trip IDs per date | D | Blk |
| B2 | Calendar exceptions | `calendar_dates.txt` added (1) and removed (2) dates | Removed services never appear; added ones do | Fixture covering both types + one real exception | D | Blk |
| C1 | Overnight / >24h times | GTFS times like `25:10:00` | Correct next-day date and display ("· Oct 27") with an ISO `datetime` | Fixture + one real overnight Amtrak trip | D+B | Hi |
| D1 | DST end (US, **Sun 1 Nov 2026**) | Trips around 01:00–02:59 local; GTFS "noon minus 12h" day base | No hour lost or doubled; the repeated 01:xx hour is handled deterministically; durations stay correct | Fixture + real trips on 31 Oct–1 Nov | D | Hi |
| D2 | DST start (US, **Sun 14 Mar 2027**) | Same, with the 02:xx gap | No result at a nonexistent local time; durations correct | Fixture + real trips if the feed covers that date | D | Hi |
| E1 | Origin-timezone input | A requested time at an origin outside Eastern Time, if the feed has one (e.g. a Central Time Amtrak station) | The time is interpreted in the **origin station's** timezone, and the label says so | API request/response + screenshot | D+B | Hi |
| F1 | Published transfers | `transfers.txt` types 0, 1, 2 and 3 (LIRR) | Type 3 (forbidden) is never used. Type 2 respects `min_transfer_time`. Type 1 (timed) is allowed as published. | Small fixture per type + one real LIRR case | D | Blk |
| F2 | Missed connections | An arrival later than the next departure minus the buffer | That connection is never offered | Fixture | D | Blk |
| F3 | Assumed buffers | Penn/Moynihan cross-operator **15 min**; unspecified same-station **10 min** (P3 contract) | Applied exactly as documented, and **disclosed in the UI** as assumptions | Fixture + UI wording | D+B | Hi |
| F4 | Pickup / drop-off | `pickup_type` / `drop_off_type` = 1 | No boarding or alighting at stops that forbid it | Fixture | D | Blk |
| G1 | **Independent planner oracle** | Hand-made GTFS fixture (≤ 8 stops, ≤ 12 trips) with a known optimum | The candidate's earliest arrival equals my independently written brute-force search, under the same bound (7 days, ≤ 4 boardings) | Oracle script + diff of results | D | Blk |
| G2 | Real-feed spot checks | **Boston MA → Philadelphia PA** on 25 and 26 Oct 2026; **Philadelphia PA ↔ Stony Brook NY** both ways; **NYC → Boston** | The oracle over the same snapshot finds no earlier arrival within the bounds; each leg's stop/trip IDs and times match the feed rows | Oracle diff + trip/stop IDs + screenshots | D+B | Blk |
| G3 | Fewer transfers | Two itineraries with equal arrival times | The tie-break is documented and applied consistently | Fixture | D | Med |
| H1 | Operator gaps | Pairs needing NJ TRANSIT, SEPTA, Greyhound or FlixBus | Shown as **explicit coverage gaps**; never served from catalogue directory membership or sample routes | API + screenshot | D+B | Blk |
| H2 | Unsupported / ambiguous / same place | Atlantis; "Portland" (ME vs OR); origin equals destination; a catalogue place with no timetable stop | An honest message for each; state-disambiguated choices; no crash | Screenshots + API | B | Hi |
| H3 | Date input edge cases | A past date, invalid dates (2026-02-30, 25:00), leap day 2028-02-29, an empty value | Validated or rejected with a clear message; past-date policy documented | Screenshots + URLs | D+B | Med |
| I1 | Dated IDs | Refresh or share a dated Journey URL | Rebuilt from the snapshot plus query; the same legs return | Before/after JSON | B | Hi |
| I2 | Stale / tampered IDs | A modified ID, or an ID from an older snapshot | Rejected; **never** replaced by a sample or a different itinerary | Screenshot + API | D+B | Blk |
| I3 | Legacy separation | `/demo`, `regional-connection`, `amtrak-connection`, `east-…` IDs, canonical Journey/Wallet routes | The sample engine, IDs, times and the SEPTA proxy are unchanged and clearly labelled as samples | Legacy suites (section N) + screenshots | B | Blk |
| J1 | URL / history | Share, refresh, back/forward, a date-only change | The form and results always match the URL | Playwright trace | B | Hi |
| J2 | Request races | Two quick searches, with the first one slowed artificially | A stale reply never overwrites the newer search | Playwright with route delay | B | Hi |
| K1 | Privacy and network | Full browser session | Only same-origin API calls at runtime: no third-party requests, no geolocation, no coordinates in the URL or storage | Request log + storage dump | B | Blk |
| L1 | Wording | All result, gap and journey pages | Source and check date shown. No claims of Google Transit participation, live or real-time service, fares, inventory, or "all operators". Real and sample journeys are visually distinct. | Screenshots + text scan | B | Blk |
| M1 | Date/time readability (S1b) | **320, 360, 375, 390, 400 px** | Full date and time values visible at every width (P4-27 found 361–389 px clipping on #29) | Screenshots + width/stacking checks | B | Hi |
| M2 | Autocomplete at catalogue scale | 1,371 choices | Ranking, keyboard/pointer/Escape and state labels keep working; typing stays responsive | P4-25 / P4-27 checks adapted + timing | B | Med |
| N1 | Legacy regressions | Regression, canonical, expansion, national map, P4-25 Search, P4-28 / P4-29 / P4-30 Journey suites | Pass, with any URL moves (e.g. `/` → `/demo`) **documented as harness adaptations**, not silent edits | Totals per suite | B | Blk |
| O1 | Local performance (not production) | Key pairs, cold and warm | API latency p50/p95 on this machine, snapshot size, server memory, bundle delta against the #30 build | JSON with run details; no production claim | D | Med |
| P1 | Real devices / screen readers | iPhone Safari, Android Chrome, VoiceOver / TalkBack / NVDA | Date pickers, combobox, result and gap announcements | **P5 scope**; listed as a known gap if not done | P5 | Med |

## Evidence checklist (per run)

- [ ] Full candidate, base and source SHAs; patch-id provenance table
- [ ] Tool versions: Node, pnpm, Chromium, Python
- [ ] Install, typecheck, build and test exit codes with totals
- [ ] Manifest copy, feed hashes, retrieval dates, licence quotes, and the rebuild `cmp`
- [ ] Oracle script and fixture committed under `qa/`, with the diff against candidate output
- [ ] Trip, stop and route IDs for each real-feed spot check
- [ ] Network/request log and storage dump (K1)
- [ ] Screenshots: M1 widths, gap messages, real vs sample labelling
- [ ] Legacy suite totals, with any harness adaptations listed
- [ ] NOT RUN / gap list, including the P5 items

## Proposed release blockers

1. Missing or unverifiable **source provenance or licence** for any bundled snapshot (A1, A2)
2. Any wrong service day, removed-date service, forbidden or missed transfer, or forbidden boarding (B1, B2, F1, F2, F4)
3. The **oracle finds an earlier arrival** within the documented bounds, or the real-feed spot checks don't match the feed rows (G1, G2)
4. Uncovered operators or dates presented as served, or any sample data presented as dated (A5, H1, I2, I3, L1)
5. Third-party runtime requests or exposed location data (K1)
6. Legacy sample or canonical regressions that aren't documented harness moves (N1)

## Open protocol inputs

These need answers or candidate evidence before execution:

- **U1:** the Amtrak GTFS redistribution / licence terms (the MTA terms are already cited by P3).
- **U2:** the API contract: endpoint paths, request and response schema, error codes, and the dated-ID format.
- **U3:** the feed validity windows in the committed snapshot. The P4-19 Amtrak feed was version 20261024, valid 2026-10-25 to 2027-10-18; the LIRR window is unknown.
- **U4:** the past-date policy, and how nonexistent or repeated DST local times are handled.
- **U5:** the tie-break rule between earliest arrival and fewer transfers.
- **U6:** the final route map (`/` planner vs `/demo` samples), so the legacy harness URLs can be adapted explicitly.
- **U7:** the snapshot size in the repository and its effect on server memory and cold start on Render's free tier. This is a deployment concern to flag, not to test on production.
