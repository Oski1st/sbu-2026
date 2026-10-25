# P4-37 (self-initiated): CONUS passenger-rail map, WIP checkpoint QA

Owner: Person 4 (QA). This QA was started on my own initiative, as P4-36-HANDOFF allows (hub issue #2, comment 6393701566). It checks a **work-in-progress checkpoint, not a frozen candidate**. The PR says it is "not frozen or QA-ready yet", so **no map pass is declared**. Protocol: [`qa-p4-36-rail-map-protocol.md`](qa-p4-36-rail-map-protocol.md).

## Target

| Item | Value |
| --- | --- |
| Checkpoint SHA | **`ce1acf4de024e8985f769c96bce03c825ad6867b`** (PR **#36** `feat/conus-passenger-rail-map`, open **draft**, WIP) |
| Actual base | #33 **`4e415429e583792f90746ee8e4c055730e090fa4`**: one commit directly on it, authored by usmej (Person 2), 2026-10-25 01:07 −0400 |
| Diff | 12 files: `CorridorMap.tsx`, new `PassengerRailMap.css`, `src/data/railMap/{build.mjs, geometry.json, provenance.json, serviceAudit.json}`, 5 gzipped source snapshots, and `docs/rail-map/README.md`. No Search, timetable, `index.css` or shared-contract changes. |
| Environment | macOS 15.7.7, Node v22.23.4 (the README specifies Node 24), pnpm 11.25.0, Playwright 1.64.1 / Chromium 156. Served on `:4173` (`index-C_j5dWwi.js`). 2026-10-25 UTC. |

## Results against the P4-36 matrix

| Row | Check | Result |
| --- | --- | --- |
| Build | `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build` | Exit 0 |
| Tests | `pnpm test` | **106 / 107: 1 FAIL**. `CorridorMap.test.tsx` "does not present state geography as nationwide service or routes" still expects the removed `ALASKA` inset, so the test is stale (W1). |
| M3 | Source hashes | **All 5** gunzipped snapshots (states, routes, stations, route metadata, station metadata) **match the SHA-256 values in `provenance.json`**. The states hash `69a0e06e…` equals #33's Natural Earth hash. |
| M4 | Licence | `provenance.json` quotes the NTAD text: "a work of the United States government as defined in 17 U.S.C. § 101 … not protected by any U.S. copyrights … available for unrestricted public use". Natural Earth is public domain. The quote was checked in the committed metadata snapshot; a fresh download was **NOT RUN**. |
| M5 | Reproducible preprocessing | `node src/data/railMap/build.mjs --verify` passes, and a **full rebuild leaves the working tree byte-identical** (`git status` clean). The Douglas-Peucker tolerance of 0.12 SVG units and 0.01 rounding are documented; 161,372 input vertices become 1,181. |
| M1 | CONUS only | Data has **49 boundaries (48 states + DC), no Alaska or Hawaii**. Browser at 1280 / 390 / 375 / 320 px: no inset frames, and no Alaska or Hawaii text. |
| M2 | Orientation (independent, from geometry) | North above south for all five state pairs (WA/CA, ND/TX, MI/AL, ME/FL, NY/GA). West→east order CA < CO < KS < MO < OH < PA < NJ. Florida's southern tip at 0.82 of its width (east side). MIA south of NYP; POR north-east of WAS. **All pass.** |
| M6 | Alignment, not schematic | Each of the 8 routes is tied to its source `OBJECTID` (11, 16, 20, 32, 34, 39, 48, 49), and the names match the source records. The longest straight segment is 14.1 units (about 80 km at about 5.6 km per unit), consistent with simplified straight track rather than city-to-city connectors. **An independent comparison of drawn vertices against projected source geometry was NOT RUN** (it would need a separate projection); the claim currently rests on the hashed source plus a byte-identical rebuild. |
| M7 / M8 | Passenger service / exclusions | `serviceAudit.json` gives an official Amtrak URL and a qualified description for each of the 8 routes. Every one of the **26 station markers is `StnType=TRAIN`** with coordinates exactly matching the source (bus/Thruway excluded). Every station is within 2 units of a drawn route vertex. Evidence notes in W4. |
| M9 | City / station mappings | 23 of 24 sample cities have TRAIN stations. Stony Brook (LIRR) is documented as a geometry gap. Boarding-location caveats (Rensselaer, North Charleston, Boston North vs South) are documented. |
| M10 | Gaps disclosed | The opened details list the **LIRR, SEPTA and NJ TRANSIT** gaps and Stony Brook |
| M11 | Accessibility | The SVG is `role="img"`, labelled and described, with **no focusable elements inside**. The closed `<details>` exposes only its summary as a Tab stop. Enter opens it, and **34 source links have accessible names** (e.g. "Downeaster (official source, opens in a new tab) ↗"). |
| M12 | Readability | At 1280 / 390 / 375 / 320 px, all visible map text is ≥ 11 px and there's no page overflow. Screenshots: [320](qa/p4-37/p4-37-rail-map-320.png), [375](qa/p4-37/p4-37-rail-map-375.png), [390](qa/p4-37/p4-37-rail-map-390.png), [1280](qa/p4-37/p4-37-rail-map-1280.png). |
| M13 | Runtime requests and bundle | **0 third-party requests** at every width, including after opening the details. Bundle against #33 (`gzip -9`): **main JS 147,484 → 135,351 B (−12,133)**; main CSS 13,826 → 14,466 B (+640). Raw main JS 452,497 → 411,099 B. |
| M14 | No service claims | The SVG description says "partial rail coverage, not a timetable or a guarantee of a direct connection". The visible note says to confirm service with the operator. |
| M15 | Regression | e2e **119 / 121**. The 2 FAILs are a **harness false positive** (W2). Canonical IDs **52 / 52**. The old `qa/p4-15-map-check.cjs` doesn't apply any more: it waits for the removed `.nationwide-map`. It's replaced by `qa/p4-37-rail-map-wip-check.cjs` (**25 / 25**). |
| M16 | Real devices / screen readers | **NOT RUN** (P5) |

## Findings (WIP; route to Person 2 via Person 6)

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| W1 | **Medium (must fix before freeze)** | `src/components/search/CorridorMap.test.tsx` still asserts the old Alaska inset and imports `usOverviewMap.json`, so `pnpm test` fails 1 of 107 | Test output; P2 said tests were still in progress |
| W2 | Info (QA harness) | e2e "buttons/links named and unclipped" at 320 / 390 px flags the 34 source links inside the **closed** `<details>`. The harness reads `innerText`, which is empty while the details are closed, even though Chromium still reports a box for them. The links aren't Tab stops while closed and do have accessible names (M11). | Probe + accessibility tree; the harness needs to skip closed `<details>` content |
| W3 | Info (repository) | The 5 gzipped source snapshots add **2,928,791 bytes (about 2.93 MB)** to the repository (not to the shipped bundle). `usOverviewMap.json` and `buildUsOverviewMap.mjs` are now referenced only by the stale test. | `du`, `grep` |
| W4 | Info (evidence strength) | Silver Meteor's evidence URL is the shared "Silver Service / Palmetto" page. Carolinian's is the generic `amtrak.com/routes` directory (the old page redirects there; P2 documents this). That's adequate as a route-level description but weaker than a route-specific page. | `serviceAudit.json` |
| W5 | Info (method) | The independent vertex-vs-source deviation check is NOT RUN, and `build.mjs --verify` was run on Node 22 instead of the specified Node 24 (it passed) | — |

**Status:** WIP checkpoint reviewed. No blocking data, licence, orientation, privacy or accessibility problem was found. W1 must be fixed before freezing. A full recheck is due on the frozen SHA (protocol steps 1–5), including M6 deviation sampling and P5 device coverage.
