# RC2 — Search focus and date/time layout

Person 1 task P1-RC2-FOCUS. New branch `feat/release-candidate-2` starts at
`5d4b670c5eaacef93fecbfea8644d4168e686521` (RC1 plus release notes).
Normal authored cherry-pick:
`d07a5ece6908f0cff05c0b4f64c323cbbfcb3671` →
`bcbd5e45fa0092cf37cda14cdffbee1e525441df`.
Both stable patch IDs are `97ab68a5700f1e6a9e098e636f958a089265fd3a`.
Authorship/date preserved. CSS auto-merged cleanly; no manual conflicts or app
edits beyond the source patch. RC1 operator badges and narrow comparison rule remain.
Source application delta: `src/index.css`, `LocationAutocomplete.tsx`; all other
source commit additions are its QA evidence. #39/#40 and source branches stay frozen.

## User-visible change

Keyboard focus indicators are darker, with contextual light indicators on dark
controls. Search date/time fields wrap before either becomes too narrow, so the
full values remain readable between the old mobile breakpoints. Original sample
journeys and manual entry remain; this does not add dated timetables, the national
catalogue, or further rail-map coverage. RC1 limitations and rollback process in
`release-notes-rc1.md` still apply; its RC1 asset hashes are superseded below for RC2.

## Actual local checks, 2026-10-25

Node22.23.4 / pnpm11.25.0; production build served at
`http://127.0.0.1:58423`, HOST=0.0.0.0, PORT=58423. These are local integration
observations, not deployment or independent Person4 acceptance.

| Check | Exit | Actual result |
| --- | --- | --- |
| Frozen install | 0 | unchanged lockfile |
| Typecheck | 0 | pass |
| Build | 0 | pass |
| Unit tests | 0 | 22 files,116/116 |
| e2e | 1 | 119/121; only known closed-map-details unnamed-link false positives at320/390px |
| Smoke | 0 | 6/6, SEPTA200 observed |
| Proxy outages | 0 | 5/5 |
| Demo online | 0 | 8/8, live observed |
| Demo --offline | 0 | 8/8, SEPTA blocked/unavailable (not full network offline) |
| P4-35 focus measurement | 0 | 6/6 controls have visible focus indicator5.05:1 against adjacent white |
| P4-25 Search | 0 | 38/38 |
| P4-27 polish | 1 | 13/16; exactly3 expected obsolete side-by-side layout assertions |

All three P4 scripts were copied unchanged from `origin/feat/qa-search-plan`
captured at `ca6fbadd5f16d3f7eaa56601edd4374382859f67`; local copies are not
included as new application code. Raw outputs and focus JSON are under
`docs/qa/rc2/`. Screenshots remain in local `work/rc2-evidence/`.

P4-27's three failed side-by-side expectations now show stacked inputs:

| Viewport | Date width | Time width |
| --- | --- | --- |
| 361px | 251px | 251px |
| 375px | 265px | 265px |
| 390px | 280px | 280px |

At320/360px the script passes, with210/250px fields respectively. Ranking matches
the independent24-query model. The harness was not altered to hide its failures.

P4-35 reached each of From, To, Date, Time, Swap and Find my way using keyboard
focus. From/To's visible2px underline is5.05:1; Date/Time's visible2px outline
and reference buttons'3px outlines are5.05:1. The script also logs transparent
outlines (1:1) and unchanged pale input borders (~1.2:1); those are not the
visible focus indicator. Its advisory AAA pixel-area calculation is not an AAA
conformance pass: From/To/Time have insufficient changed pixels under that method.
No claim of full WCAG, real-device or screen-reader certification is made.

## RC2 post-deploy asset identity

Only a separately authorized release executor may deploy. Record approved full
GitSHA and compare downloaded, decoded bytes against the exact approved build:

- `index-CEBSCLNQ.js`: SHA256
  `70caea333d261646f68e6cd494d2002608497a5e568f07de0ae2b21893171384`
- `index-DsZpWPmi.css`: SHA256
  `5a732611710e623ddb692ad38d92fc5cfa145e5533b9c837515954d4bcf7c714`

Use the RC1 smoke/e2e/demo post-deploy commands against the actual confirmed URL,
record raw failures and investigate any new regression. No merge/deploy performed.
