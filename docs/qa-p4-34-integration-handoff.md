# P4-34: integration / release handoff matrix

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-34`). **For:** the owner and Person 3. This is documentation only: no test reruns, and **no merge or deployment is prescribed**. PR state was read from GitHub at **2026-10-25 04:42 UTC**.

Status words used below:
- **PASSED:** Person 4 ran it on the exact SHA; the evidence commit is linked.
- **REPORTED:** the author's own results, not rerun by Person 4.
- **NOT RUN:** not executed.
- **UNKNOWN:** no evidence.

## 1. What's deployed vs what's reviewed

| Item | State |
| --- | --- |
| Production `https://oneline-sbu-2026.onrender.com` | Serves `assets/index-j4_4uBJG.js` (fetched 04:42 UTC). Person 4 earlier matched that asset to a local build of **`6df372e`**, the original app. **No candidate below is deployed.** |
| `main` | `db454c030040a07c00986117331f172acf5848f6`. Differs from `6df372e` in **docs only**: `docs/demo-script.md`, `deployment.md`, `qa-checklist.md` and one screenshot. |
| Anything QA-reviewed on this page | **Source on a branch, not released.** A PASSED result means "this exact SHA passed these checks", not "this is live". |

## 2. Assembly chain (each line contains the one above it)

| Layer | PR | Head (full) | Base | Contents | P4 evidence (QA #18 commit) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Release candidate | **#21** `feat/demo-readiness` → `main` | `49742e76a289f2cf5d396cc66ead01d0ab56c62f` | `main` `db454c0` | East-coast expansion (#13 `21d77dd`) + mobile map labels (#19 `af5fa8f`) + canonical-route fix | P4-14 in QA #12 `2286ddda56c327ad8721613269554ff0bea3f235` | PASSED |
| Map + routing | **#26** → `feat/demo-readiness` | `35ed1965be9a2641fa31a2b8e1de60e7223260a3` | #21 `49742e7` | National map #22 `7ff27bf` + on-demand routing #23 / #24 / #25 | P4-17 `4f5a36b`, P4-16 `1ca5065`, P4-18 `a99bdb8` / `e232f9f`, P4-21 perf `1f4f0c8` | PASSED (P4-18 performance: proposed p95 met in P4-21's 50-load sample) |
| Catalogue + helper | **#30** → `feat/map-routing-candidate` | `fe89f9ec5fc67bfdc779121143970684d649f143` | #26 `35ed196` | Patch-identical copies of #20 `d45b0d3` + #27 `fc844f7` / `e607fb9` (catalogue) and #16 `b2b9353` + #28 `0c8d968` (location helper). Data and services only, with no UI consumer. | P4-26 `d5935b6` / `ebc9de3`; sources P4-19 `3b297e0`, P4-20 `cf72e87`, P4-24 `2f0072a`, P4-22 `b97f719`, P4-23 `4133514` | PASSED |
| **Journey assembly (current)** | **#34** → `feat/catalogue-helper-candidate` | **`a4fa839667d2b18b3f277b14b3e662a45eb9dc4e`** | #30 `fe89f9e` | Patch-identical copies of #31 `5ff9dc9` (arrival timestamps), #32 `3f41b76` (disclosure focus) and #33 `4e41542` (Eastern Time wording) | **P4-33 `f71dff9`**; sources P4-28 `e2dc508`, P4-29 `c2f0eee`, P4-30 `80af646` | PASSED (169 tests; focused 65 / 16 / 24; e2e 121 and canonical 52 vs #30) |

**#34 contains** (checked by git ancestry or patch-id): #13, #19, #21, #22, #23, #24, #25, #26 and #30 as ancestors; #16, #20, #27 and #28 as patch-identical copies (through #30); #31–#33 as patch-identical copies.

**#34 intentionally lacks:**
1. **#29 Search** (`dad01cf86b64ac8f92794345913e067b21edcc74`: city autocomplete + URL date/time preferences, from #17 `17e610c`). Its 2 commits aren't in #34. Search in #34 behaves like #30 / #26.
2. **P3's dated-timetable planner.** No pushed PR exists (UNKNOWN / NOT RUN).

## 3. Source PRs already assembled elsewhere: don't merge these separately

Merging any of these on its own **would duplicate changes** already inside a candidate above:

| PR | Head | Already in | Note |
| --- | --- | --- | --- |
| #13 `feat/east-coast` → `main` | `21d77dd618538284d77ee48db7fc34821a04bd99` | #21 (ancestor) | — |
| #19 `fix/mobile-map-labels` → `feat/east-coast` | `af5fa8f27904694aaf5de8b4edcfdd68b3d1856d` | #21 (ancestor) | — |
| #22, #23, #24, #25 | `7ff27bf…`, `05dbaa3…`, `e24b794…`, `c0ff3e4…` | #26 (ancestors) | — |
| #16 → `main`, #28 → `feat/location-helper` | `b2b9353…`, `0c8d96847e3b9d7a3895b703e37295a8fa8523d2` | #30 (patch-identical) | Helper, P4-22 / P4-23 |
| #20 → `main`, #27 → `feat/national-city-catalogue` | `d45b0d3…`, `e607fb940d47ac903570e29a688c0b0995339cd2` | #30 (patch-identical) | Catalogue, P4-19 / 20 / 24 |
| #31 → #29, #32 → #31, #33 → #32 | `5ff9dc9…`, `3f41b76…`, `4e41542…` | #34 (patch-identical) | Their branches also carry #29's 2 Search commits, which #34 doesn't |
| #17 `feat/search-autocomplete` → `feat/east-coast` | `17e610c2051f28a0c6df7d33e9046e7b1981c891` | #29 (scoped transfer) | Superseded by #29 |
| #12 / #18 / #35 | QA and P5 evidence branches | — | Docs only. #35 is P5-02 device QA of #29: a draft with no completion report, not reviewed by P4. |

## 4. What P3 can take from the reviewed Journey assembly

For P3's dated-timetable candidate (which P3 said starts from #30 + #29), the Journey changes reviewed in P4-33 are exactly these 4 paths, byte-identical between #33 and #34:
- `src/components/journey/SegmentCard.tsx`
- `src/components/journey/segmentArrivalTime.test.tsx`
- `src/components/journey/segmentDisclosure.test.tsx`
- `src/pages/JourneyPage.tsx`

Transfer them by cherry-picking `0e44616`, `889ce0e` and `a4fa839` (or the #31–#33 heads) unchanged, keeping patch-id provenance. #29's Search follow-up `dad01cf` has a known open item: **S1b**, date/time clipping at 361–~389 px (P4-27 `207ab64`), which Person 6 assigned P3 to fix in the separate candidate.

## 5. Pending gates

| Gate | State | Owner |
| --- | --- | --- |
| P3 timetable candidate: pushed, frozen PR, full head/base, patch-id provenance for #30 / #29 / Journey transfers | **UNKNOWN**: no PR yet | P3 → P6 assigns |
| Source/snapshot redistribution evidence (MTA cited by P3; **Amtrak terms open**), manifest hashes, reproducible rebuild | UNKNOWN (P4-31 A1–A3) | P3 |
| API / date / transfer policy inputs: U2 schema and dated IDs, U4 past-date / DST, U5 tie-break, U8 7-day window, U9 transfer override, U10 fixture loading | UNKNOWN (P4-31 / P4-32) | P3 |
| Planner correctness vs the independent fixtures (14 queries) and real-feed spot checks | NOT RUN (P4-32 `a800a11`) | P4 once assigned |
| Resource measurements: snapshot size, server memory and cold start on the current free Render plan, API latency, bundle delta | NOT RUN (P4-31 O1, U7) | P3 report + P4 measurement |
| Real-device / screen-reader coverage | **UNKNOWN.** P5-01 (production) was acknowledged but no results are posted. P5-02 (on #29) exists only as draft PR #35 with no completion report; P4 hasn't reviewed it. Nothing covers #34 or the timetable candidate. All P4 results are Chromium-only. | P5 |
| Inherited CSS scan effects (unused utilities, no app fix requested): `.rounded` (+30 B, P4-26), `.collapse` / `.container` (from #32, P4-33) | Recorded, Info | — |
| **Owner decisions** | **Open** | **Owner** |

The owner decisions are:
- (a) Which candidate becomes the release line (#21 alone, or #21 plus the #26 / #30 / #34 chain, with or without #29 or the timetable planner).
- (b) When and whether to merge into `main`. No merge has been made or recommended here.
- (c) Whether and when to redeploy production (currently the `6df372e` build).
- (d) How to close the superseded source PRs in section 3.
