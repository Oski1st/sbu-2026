# P5D-MAPFIX-QA — source and build findings

Checked October 25, 2026 in an isolated checkout of
`5ccdbbbf152752b4e24b2876a63fd2602e85a5b4` (PR #50). The comparison baseline is
RC3-UI `7fa350da8deec7ce7d658c3c3e25e2f88a6d2b76`.

## Verified defects and follow-up

1. **LIRR marker styling:** the hollow marker consists of three zero-length SVG
   paths. The existing round-cap rule applied only inside `.prm-stations`, while
   the new marker is inside `.prm-lirr`. SVG's default butt cap does not paint a
   zero-length stroke. The follow-up gives the LIRR group round caps and no fill,
   so its white halo, blue ring and white centre inherit the intended marker
   styling. Browser pixel verification remains outstanding.
2. **Contradictory gap text:** the LIRR entry still stated that no straight-line
   substitute was drawn, despite the new dashed link. It now describes the link
   as an orientation schematic and says that validated track geometry is absent.
3. **Broken independent geometry harness:** the old harness expects an `objectId`
   on each rendered route. PR #50 intentionally replaced full source routes with
   clipped corridors containing `edges` and `paths`, causing a `TypeError` at the
   old harness's line 52. The follow-up checks this new contract without importing
   the generator or its projection implementation.

No coordinates, route paths, snapshots, itinerary data or dependencies changed.

## Source and geometry results

RC3-UI contained eight complete routes / 127 source parts. PR #50 contains seven
rendered corridors / 22 sample-network connections. Both contain 49 contiguous
state/DC boundaries and 26 Amtrak station markers; PR #50 adds LIRR station and
schematic metadata separately.

The updated independent harness checks every retained vertex against the eight
audited federal source routes, samples drawn segments against source track, checks
all 22 city-station endpoints and reproduces station positions through its own
Albers projection. It does not require intentionally excluded source extensions
to remain on the map.

- Source vertices: 161,372; retained drawn vertices: 360.
- Segment samples: 10,603 across seven corridors / 22 edges.
- Maximum retained-vertex offset: 0.0067 SVG units (rounding allowance 0.0071).
- Maximum sampled track offset: 0.1204 SVG units; sample limit: 0.1271.
  The 0.05-unit sampling step bounds intervening points by 0.1454 units.
- Maximum city-station endpoint offset: 0.0632 SVG units.
- Maximum station source-coordinate offset: 0.0063 SVG units.
- Independent LIRR coordinate and New York Penn schematic-origin checks: PASS.

The distance check measures generalized map geometry, not verified passenger
service, a usable railway connection or navigation accuracy.

## Validation

The exact PR #50 base passed frozen install, typecheck, production build and
**29 test files / 191 tests**. Its offline generator reproduced both committed
outputs: 49 boundaries, seven corridors, 26 Amtrak stations, 161,372 input points
and 360 retained points. Its old independent geometry harness failed as described
above.

The follow-up also passes frozen install, typecheck, production build, **29 test
files / 191 tests**, the updated independent geometry harness and offline
`node src/data/railMap/build.mjs --verify`. Its exact pushed SHA is recorded in the
follow-up PR.

## Remaining acceptance checks

Browser comparisons at 1440/390/320px, the labels/details browser harnesses,
screenshots, and three official Amtrak route-map spot-checks were **NOT RUN** in
this source/build worker. No local preview server or browser was started here.
The existing details harness still expects 41 source/station/gap links; that count
does not change because the audit retains its eight official source routes.
The labels harness also needs an additional visual check of the hollow LIRR
marker and schematic around the crowded New York area.

Recommendation: include these three focused fixes with PR #50, then complete the
remaining independent browser and official-map checks before treating
P5D-MAPFIX-QA as an end-to-end pass. This report does not authorize merging or
deployment.
