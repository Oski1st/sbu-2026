# QA P5d: draft PR #50 `fix/p5-map-network-extent` (rail map network extent and Stony Brook LIRR)

- Candidate: `fix/p5-map-network-extent` @ `5ccdbbbf152752b4e24b2876a63fd2602e85a5b4` ("fix")
- Base: RC3-UI @ `7fa350da8deec7ce7d658c3c3e25e2f88a6d2b76` ("base")
- Date: 2026-10-25. Tester: P4 QA helper. This was a test-only pass: nothing was pushed to #50, and no GitHub comments were posted.
- Setup: separate detached checkouts, `corepack pnpm install --frozen-lockfile`, production server `PORT=… node server/index.mjs` (fix on 4200, base on 4201), Playwright Chromium 1.64.1.
- Evidence: screenshots and raw logs are in `docs/qa/p5d-mapfix/` (logs in `docs/qa/p5d-mapfix/logs/`). Scripts are in `qa/p5d-*`.

## Verdict

**Do not fold #50 in as-is. Fold it in after a one-line CSS fix.** The data and geometry work is correct. Every drawn line stays inside OneLine's network, all 22 Amtrak city pairs are drawn station to station on real NTAD track, and spot checks against Amtrak's own route pages pass. However, **the Stony Brook hollow LIRR marker does not render** at any width. Only a short blue dash shows next to New York (see F1). Because the legend and the SVG description both promise a hollow marker, it has to be fixed before the change reaches the demo.

## Results

| # | Check | fix 5ccdbbb | base 7fa350d |
|---|---|---|---|
| 1a | `pnpm install --frozen-lockfile` | PASS | PASS |
| 1b | `pnpm typecheck` | PASS (rc 0) | PASS (rc 0) |
| 1c | `pnpm build` | PASS (index 405.67 kB / gz 134.24) | PASS (415.86 kB / gz 136.06) |
| 1d | `pnpm test` | PASS **191/191** (29 files) | PASS 189/189 |
| 1e | `build.mjs --verify` | PASS `routes 7, stations 26, inputPoints 161372, retainedPoints 360, verify:true` | PASS `routes 8, stations 26, inputPoints 161372, retainedPoints 1181` |
| 2a | Rendered paths | 7 groups / **22 paths** / 360 vertices / 26 markers; DOM equals `geometry.json` | 8 groups (whole federal routes) |
| 2b | Nothing west of Charlotte/Tampa | PASS (see note N1) | FAIL: 70 vertices (Floridian toward Chicago; inland Silver Star) |
| 2c | Nothing north of Portland ME | PASS (min y 102.78 vs POR 102.76) | FAIL: 5 vertices (Downeaster to Brunswick) |
| 2d | Nothing west of Albany (north of NYC) | PASS (0) | FAIL: 54 vertices (Empire Service to Buffalo/Niagara) |
| 2e | All 22 Amtrak city pairs drawn station to station | PASS: each path starts and ends at its two cities' stations; max endpoint-to-station offset **0.063 units (~0.5 km)** | n/a (no edges) |
| 2f | Markers lie on lines | PASS: max **0.646 units = RVM** (Richmond Main Street; ≈5 km, 0.50 px at 1440 / 0.24 px at 320), then BOS 0.228, TPA 0.063 (see N2) | PASS (max 0.075) |
| 2g | Stony Brook hollow blue LIRR marker with dashed NY link | **FAIL (F1)**: the DOM, colours, and NY-to-Stony Brook geometry are correct, but the ring and hole are not painted | FAIL: absent (expected; not in base) |
| 2h | No horizontal overflow at 1440/390/320 | PASS (overflow 0) | PASS |
| 2i | No console errors | PASS | PASS |
| 3a | Richmond→Raleigh→Charlotte (Carolinian/Piedmont) | PASS | n/a |
| 3b | Fayetteville→Charleston→Savannah (Palmetto/Silver) | PASS | n/a |
| 3c | Orlando→Tampa (Silver Star, now Floridian) | PASS | n/a |
| 4a | `rail-map-details-check.cjs` (polish) | PASS 25/25 | PASS 25/25 |
| 4b | `rail-map-labels-check.cjs` (polish) | PASS: output identical to base at 1280…320 | PASS |
| 4c | `rail-map-geometry-check.mjs` (polish) | Needs a new expectation: crashes (`TypeError … reading 'geometry'`) because routes no longer carry `objectId`. Adapted `qa/p5d-rail-map-geometry-check.mjs`: **ALL PASS** | ALL PASS (max dev 0.1217 / limit 0.1271) |
| 4d | `e2e-check.cjs` (polish copy) | 118/121: 2 known closed-details false fails (390/320) plus 1 stale expectation (malformed percent-encoding expects 400; the current server returns the HTML shell) | 118/121, same 3 failures |
| 4e | `e2e-check.cjs` (in-tree at 5ccdbbb) | 120/122: only the 2 known closed-details false fails | n/a |

### Step 3 detail: official Amtrak pages (plain WebFetch, not blocked)

Each page loaded normally, with no bot check. The intermediate stops each page lists for the segment were projected from the bundled NTAD station snapshot and measured against the drawn path (`qa/p5d-official-stops-check.mjs`; 1 SVG unit ≈ 7.88 km; limit 3 km):

- **Richmond→Raleigh→Charlotte**: `amtrak.com/carolinian-train` lists RVR → PTB → RMT → WLN → SSM → RGH → (NSF) → CYN → DNC → BNC → GRO → HPT → (LEX) → SAL → KAN → CLT. `amtrak.com/piedmont-train` lists Raleigh to Charlotte with the same stops. Distances from the drawn path: PTB 0.13 km, RMT 0.20, WLN 0.05, SSM 0.56, CYN 0.10, DNC 0.30, BNC 0.17, GRO 0.09, HPT 0.04, SAL 0.41, KAN 0.01. **PASS**
- **Fayetteville→Charleston→Savannah**: `amtrak.com/silver-service-palmetto-train` lists FAY → DIL → FLO → KTR → CHS → YEM → … → SAV. Distances: DIL 0.78 km, FLO 0.14, KTR 0.41, YEM 0.09. **PASS**. The coastal route is drawn. The inland Columbia branch that the base build drew is gone.
- **Orlando→Tampa**: the Silver Meteor/Palmetto page lists ORL → KIS → TPA. `amtrak.com/floridian-train`, which replaced the Silver Star (a temporary combination with the Capitol Limited), lists ORL → KIS → LAK → TPA. Distances: KIS 0.09 km, LAK 0.02. **PASS**

## Findings

**F1 (must fix): the Stony Brook LIRR ring and hole are invisible.** `.prm-lirr-ring`, `.prm-lirr-hole`, and the LIRR `.prm-station-halo` are zero-length `M x,y h0` paths. Paths like that only paint with a round or square line cap. The `stroke-linecap: round` rule is scoped to `.passenger-rail-map .prm-stations path`, but the new `<g class="prm-lirr">` sits outside `.prm-stations`. As a result, the computed `stroke-linecap` is `butt` and the bounding box is 0×0 at 1440, 390, and 320 (`logs/fix-lirr-marker-check.log`). Only the dashed link paints. It is about 7 px long at 1440, so it shows as one blue dash, and at 320 it is mostly hidden under the NY and New Haven halos. Unit tests (jsdom) cannot catch this.
- Shipped: `lirr-shipped-1440.png`, `-390`, `-320`. The dash is visible but there is no ring.
- With this one rule injected, the hollow blue ring renders correctly at all widths: `.passenger-rail-map .prm-lirr path { stroke-linecap: round; }` (`lirr-linecap-round-*.png`). Adding `stroke-linecap: round` to `.prm-lirr-ring` and `.prm-lirr-hole` would also work, but the halo needs it too.
- `qa/p5d-mapfix-check.cjs` now asserts a non-`butt` cap, so it flips to PASS once the CSS is fixed.

**N1 (not a defect): three vertices sit slightly west of Tampa's SVG x.** Three vertices of the interior **Savannah→Jacksonville** edge sit up to 1.09 units (≈8.6 km) west of Tampa's SVG x. This is the real CSX line via Jesup, GA, between two network cities. In Albers, SVG x is not longitude. No vertex beyond the network lies west of the limit. The check reports this explicitly.

**N2 (minor, optional): two station markers are not touched by a drawn line.**
- **Richmond Main Street (RVM)**: our trains in this network use Staples Mill (RVR), so no edge passes RVM. Its dot sits 0.646 units (≈5 km, at most 0.5 px) from the line.
- **Boston South Station (BOS)**: the Northeast Regional edge starts at Back Bay. South Station sits 0.228 units from the line.

Both gaps are sub-pixel and acknowledged in the author's test (`geometry.test.mjs`, which allows 0.8 for BOS and RVM). They are not a release blocker.

**N3 (cosmetic): the LIRR marker is crowded.** Once F1 is fixed, the ring overlaps the NY and New Haven halos at 320 and 390, but it stays readable as a hollow blue ring (`lirr-linecap-round-320.png`).

## Harness expectation changes (separate from real failures)

1. `qa/rail-map-geometry-check.mjs` assumes one drawn route per NTAD OBJECTID with matching part counts. #50 draws one path per network edge, built from the shortest track across all audited parts. Use `qa/p5d-rail-map-geometry-check.mjs`. It keeps the independent projection and checks four things:
   - every drawn vertex is a source vertex (max 0.0067 / limit 0.0071)
   - every drawn segment lies within the DP tolerance of source track (max 0.1141 / 0.1271)
   - path ends sit at the edge's stations (max 0.0632)
   - station and LIRR offsets (0.0063 / 0.0033)

   It also expects exactly 22 paths. **ALL PASS.**
2. The polish branch's `qa/e2e-check.cjs` still has the old malformed-URL expectation. Use the in-tree version, which splits document and non-document requests and passes them.
3. `rail-map-details-check.cjs` needs no change: 41 links still pass, because `serviceAudit.routes` still lists 8 cited route pages even though 7 groups are drawn. `rail-map-labels-check.cjs` needs no change. If the team wants the ring/hole paint test in CI, add the non-`butt` linecap assertion from `qa/p5d-mapfix-check.cjs`.

## Visual review (screenshots looked at)

- `fix-5ccdbbb-{1440,390,320}-map.png`: lines run only from Portland ME to Miami, Charlotte, and Tampa. The Floridian toward Chicago, Empire Service to Buffalo, the Roanoke branch, the Brunswick tail, and the inland Silver Star line are gone. The base equivalents (`base-7fa350d-*`) show all of these.
- `fix-5ccdbbb-zoom-{ny,carolinas,florida}.png`: lines meet the markers. Raleigh→Charlotte curves via Greensboro. Orlando→Tampa joins the southern line near Lakeland.
- `lirr-shipped-*.png` and `lirr-linecap-round-*.png` show F1 before and after.

## Scripts (in `qa/`)

- `p5d-mapfix-check.cjs <url> <label> <geometry.json> <outDir>`: rendered-DOM geometry, LIRR, overflow, console, and screenshots (fix 27/30, failing only on F1; base 15/27).
- `p5d-mapfix-zoom.cjs <url> <label> <outDir>`: regional crops at 8× DPR.
- `p5d-lirr-marker-check.cjs <url> <outDir>`: linecap probe, shipped versus a one-rule override.
- `p5d-rail-map-geometry-check.mjs`: adapted independent geometry check (copy into a checkout's `qa/`).
- `p5d-official-stops-check.mjs`: official intermediate stops against the drawn paths (copy into a checkout's `qa/`).

## Recommendation

Fold #50 into the next RC **after** the author adds `.passenger-rail-map .prm-lirr path { stroke-linecap: round; }` (or an equivalent) and re-runs `qa/p5d-mapfix-check.cjs`, which should then show 30/30 on fix. Everything else in #50 passed. It is a clear accuracy improvement over RC3-UI, with no regressions in typecheck, build, unit tests, the details, labels, or e2e harnesses, overflow, or console errors.
