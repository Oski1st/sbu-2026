# Catalogue follow-up regression checklist (P4-20)

Owner: Person 4. Data owner: Person 3 (follow-up to PR #20). Assigned in hub issue #2 as **P4-20**.

This is **preparation only**. Nothing here has been run against a follow-up target. The full run waits for a newly pushed P3 branch, PR and full SHA that the coordinator assigns in hub issue #2. The P4-19 baseline and its evidence ([qa-catalogue-results.md](qa-catalogue-results.md), PR #18 `3b297e0`) stay unchanged.

## Baseline

| Item | Value |
| --- | --- |
| Frozen baseline | PR #20 `d45b0d3305e154ac93c165af70ecfb6e8812f74b` |
| Counts | 1,550 entries: 1,370 verified, 179 unresolved, 1 excluded. 343 benchmark rows (342 + Urban Honolulu). 3 hubs. 1,204 operator-listed. |
| Operator records | SEPTA 2, NJ TRANSIT 3, LIRR 2, Amtrak 149, Greyhound 563, FlixBus 1,328 (2,047) |
| Bus page checks | 2,792: 1,891 verified, 816 Greyhound request failures, 85 fetched but not qualifying |
| Source hashes | Census CSV `e3508f52…`, Gazetteer `49644173…`, Amtrak GTFS `ff8fc4c5…` (feed `20261024`), FlixBus directory `15c7454f…`, Greyhound directory `935822d8…` |
| Known limitation to keep | Amtrak station pages return HTTP 403 to plain requests (re-observed in P4-19), and ArcGIS returned "Token Required". No bypass. |

## Commands (on the assigned SHA only)

1. Confirm the target. The PR is open, its head equals the assigned full SHA, and the ancestry and diff are limited to the catalogue files. There must be no Search, UI, routing or `server/` change.
2. `pnpm install --frozen-lockfile && pnpm build && pnpm test`. Record the totals; all catalogue tests must pass.
3. If the Census sources are unchanged, rerun the Census regeneration plus `cmp` (byte-identical expected).
4. Produce a candidate dump, then run both audits. The baseline dump is regenerated from `d45b0d3` the same way (offline, no frozen-sample rerun).
   - `P4_19_DUMP_OUT=<cand.json> pnpm exec vitest run qa/p4-19-catalogue-dump.test.ts`
   - `python3 -I qa/p4-19-catalogue-audit.py <cand.json> <checkout> <Gazetteer zip>`: all-record mechanical audit, **0 failures** expected
   - `python3 -I qa/p4-20-catalogue-delta.py <base.json> <base sources.json> <cand.json> <cand sources.json> <Amtrak GTFS zip> <cand README.md>`

**Harness control:** run on the baseline against itself, `p4-20-catalogue-delta.py` reports 16 PASS, 7 FAIL and 2 CHECK. The FAILs are C1 ×2, C2 ×3, C3 wording and C4, which are exactly the P4-19 gaps. So each gap will show as fixed or not fixed on the follow-up.

## Regression rules (all records)

| # | Rule | Expected |
| --- | --- | --- |
| R1 | Mechanical contract (the P4-19 audit) | 0 failures |
| R2 | Source snapshots | Census, Gazetteer, Amtrak and directory hashes are unchanged. A new snapshot must be explicitly declared, with a new date and hash, never substituted silently. |
| R3 | Existing bus page checks | All 2,792 are kept unchanged. Additions are only those explained by C1. |
| R4 | Legacy IDs | All 24 IDs, names and states are unchanged |
| R5 | Search eligibility | No previously verified entry drops out, especially the 1,204 operator-listed places. No population threshold is applied to `verifiedNationalCities`. |
| R6 | Excluded set | Urban Honolulu only, still with no verified record |
| R7 | Honesty fields | `municipalCoverage` and `operatingCarrier` stay `pending` on every verified record. Pending records keep "not evidence of no service". |
| R8 | Limitations | The Amtrak 403/blocked and ArcGIS "Token Required" limitations are still stated |
| R9 | Count deltas | Every change to the totals is explained by C1 to C5. Audit-row resolutions (an existing unresolved row becoming verified) are reported **separately** from new distinct markets (new IDs). |

## Focused checks C1 to C5

| # | Expected outcome on the follow-up | Delta-script check | Minimal official-source check |
| --- | --- | --- | --- |
| **C1** DC state label | `washington` gains verified FlixBus and Greyhound records from `/bus/washington-dc`, each with a hashed, verified page check. No new `*-dc` duplicate entry. No other city gains page checks from the label fix (the "D.C." label is the only one affected in the saved directories). | `C1` lines | Fetch the two DC pages once each (plain request). Compare the stop names with the record. In P4-19 they were Washington DC (Union Station), Washington DC (Dupont Circle), Arlington (Rosslyn) and Bethesda. |
| **C2** Boise, Lexington, Macon | Each city counts **once** as a market. Preferred: the Census benchmark row (`boise-city-id`, `lexington-fayette-urban-county-ky`, `macon-bibb-county-ga`) becomes verified as an **audit-row resolution**, with a friendly display name ("Boise", "Lexington", "Macon") and the operator-market row merged or explicitly linked. Either way the link must be sourced (the operator page URL). `verifiedCityMarkets` must not count the same city twice. | `C2` lines: PASS only when the Census row is verified and one entry is searchable | None. The pages were checked in P4-19 (Boise 200, Lexington 200). Re-fetch Macon only if its record content changes. |
| **C3** Shared bus directory | The README and manifest stop calling FlixBus and Greyhound "independent evidence sources" and describe them as a shared directory or network listing. Greyhound records keep `operatingCarrier: pending`. No record or count claims Greyhound-only or independent service. A Greyhound record without new non-shared evidence must not raise any service claim. | `C3` lines (wording FAIL until changed; overlap counts reported) | None. This is a provenance and wording change. |
| **C4** New York Amtrak | `new-york` gains a verified Amtrak record containing "Ny Moynihan Train Hall At Penn Station" (GTFS `NYP`, rail). It can come from a manual record or an alias. The fix must add or remove **no** other Amtrak record unless each is listed and justified. | `C4` lines | GTFS `stops.txt` check only (hash-matched). The station page `/stations/nyp` returned 403, which is the expected, documented limitation. |
| **C5** Bus-only versus rail | Amtrak records carry honest mode evidence. The 23 records whose matched stops appear only on route type 3 (bus) trips in this feed are marked as bus or Thruway (or "mode unknown"), never rail. Rail-served records are not marked bus-only. The baseline list is in [qa-catalogue-results.md](qa-catalogue-results.md) C5. This describes the feed only, not whether other service exists. | `C5` lines (mode field names are reported for review) | GTFS `routes.txt`, `trips.txt` and `stop_times.txt` only |

## Report contents (once a target is assigned)

- The exact tested SHA, PR, ancestry and diff scope.
- Install, build and test totals; R1 to R9 results.
- Count deltas, split into audit-row resolutions and new distinct markets.
- C1 to C5 results, with record IDs and any official-source fetches (URL, HTTP status, stop names).
- Changed-source findings and new limitations, with severity and owner.
- No claim of real or independent service from shared directories, and no claim that missing evidence means no service.
- Evidence committed to PR #18 (`docs/qa-catalogue-results.md`, new section). The P4-19 section stays unchanged.
