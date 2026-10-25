# Person 1 — P1-RC1 integration handoff

Base: `37fdccebde92ceda02846e65fcd232c5fc7755bf` (map #36).
Branch: `feat/release-candidate-1`. No merge or deployment.

## Authored cherry-picks

All eight used normal `git cherry-pick -x`; source author and author date were preserved.

| Source | Result |
| --- | --- |
| `7c8240c772928566c65ea34d2b4afe1adeff1e19` | `da6660c5db4334a91adb5fc9ce7e4e5d517f975d` |
| `81df991d8e4b3b8af70347b4e118a894330dded5` | `045e182a6f65f322fa90996d6243a5d5181eb9ac` |
| `1859a667e74577fc607cb96c599d8188cc2ac049` | `7655be89fbdd5987f684d2dce237da9640d49e2a` |
| `a0df67862f42c1af18d911498ddf3734159c2671` | `bed03f80c186fc77488cd27a0ae4039e80dcdedc` |
| `bd9a959ee2c86e1d67438f9cab8beecbf3954ccd` | `978a69e00fc20145f776fc7d2694c603130c019c` |
| `85c23d4413de8d28d548f11a99938c5dbe307969` | `81a705be1f76ee592325af22684a23b13962affa` |
| `1bdce61392a555b51e7631e1e288baf2a6d826b6` | `c2ebdaeb2ec73c59f59b68edb6da5297cb1ec671` |
| `49bb150266dec72a08f200ffa4ad8bd9fb3705ba` | `a896ab0230c6594831a9e4cb53c2646feb67a744` |

## Shared-path resolution

There were no conflict markers or manual source edits. Git automatically combined both overlaps; review against the logo source confirms:

- `RouteCard.tsx`: the accessible agency group, decorative-icon hiding and badge changes remain; P5 adds the explicit space between the planning note and fare disclaimer.
- `index.css`: the neutral operator strip/badge styling remains; P5 adds the <=380px comparison strong-text rule at 14px. Arrival-based ranking/duration changes are retained in their own files.

Timetable #37 and catalogue/Journey assembly #34 are excluded. The separate focus/date-layout follow-up remains pending Person 4; it is not claimed included.

## Actual validation

2026-10-25, Node 24.22.1, pnpm 11.25.0. Isolated production server: `http://127.0.0.1:58421`.

- Frozen install: exit 0. Initial attempt without Node on PATH failed; rerun with bundled Node succeeded.
- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.
- `pnpm test`: 22 files, 116/116 passed.
- `node src/data/railMap/build.mjs --verify`: exit 0; 49 boundaries, 8 routes, 26 stations, 161372 input vertices / 1181 retained.
- `node qa/e2e-check.cjs <url> <shots-dir>`: exit 1, **119/121 passed**. Only failures: mobile 320/390px “buttons/links named and unclipped”, reporting unnamed links inside the closed map details. These match Person 4's known harness false positives. The harness was not changed, and this is not reported as an all-green run. No page/console errors.
- `node qa/rail-map-labels-check.cjs <url>`: exit 0, no label overlap/out-of-frame issues at 320/360/375/390/640/768/900/1024/1280px. Its SVG dotBox metric returns 0, so this script alone is not evidence of marker dimensions.
- `node qa/rail-map-geometry-check.mjs`: exit 0, all eight alignments pass independent projection/deviation checks; max source-to-drawn deviation 0.1217 SVG units under 0.1271 limit.
- `git diff --check`: clean.

These are local integration results. Person 4's independent QA and Person 5's release decision remain required. Human device/screen-reader coverage was not run by Person 1.
