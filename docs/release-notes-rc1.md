# RC1 release notes and deployment handoff — Person 1

Application target: #39 `2d0b5ef7fa8bce374adaa72abf6bd522c097772b`.
Readiness branch: `chore/rc1-deploy-readiness`, based on that exact target.
This is a local rehearsal, not permission to release. Person 4 QA precedes
Person 5's release decision. No merge or deployment was performed.

## Changes since production 6df372e

- More East Coast sample rail/coach journeys, with overnight dates and official
  operator booking handoffs. Existing Philadelphia demo journeys remain available.
- Editable origin/destination suggestions and date/time planning preferences that
  survive shared Search URLs and history navigation. Arrival-based Fastest and
  comparison ranking, readable durations, bounded date years and narrow comparison text.
- A contiguous-US passenger-rail overview with sourced alignment, clearer station
  markers/city labels and a compact expandable coverage audit. Neutral, accessible
  operator text badges replace imitation wordmarks.
- Journey arrival timestamps, keyboard-safe collapsed details and explicit Eastern
  Time sample labels. Wallet duration and SEPTA unavailable/sentinel-delay handling
  are clearer; operator links and favicon are corrected.

## Limits and gates

RC1 has **no dated timetables**. Date/time controls are preferences; sample
itinerary times/fares are illustrative, not real inventory, quotations or bookings.
The map is **partial coverage**: eight Amtrak alignments, 26 stations for 23 of
the 24 sample cities; permitted LIRR/SEPTA/NJT alignment is missing. Geographic
membership never proves a connection or a train on a requested date.
The national catalogue/assembly #34 and timetable #37 are excluded.
Search focus/date-clipping follow-up is not included in this frozen RC1.
Real-device/screen-reader coverage and independent P4 acceptance remain gates.
SEPTA observations are agency-wide and can be unavailable; no journey matching
or real-time bus/rail coverage beyond the explicitly labelled panel is claimed.

## Production-style local rehearsal (2026-10-25)

`render.yaml` selects Node22, Free plan, branch main, health path `/`, build
`corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build`,
start `pnpm start` (which runs `node server/index.mjs`), and `HOST=0.0.0.0`.
README agrees; Render supplies PORT.

Used Node **22.23.4**, pnpm **11.25.0**, HOST **0.0.0.0**, PORT **58422**;
checked at `http://127.0.0.1:58422`. Existing previews were left running.
pnpm was already available, so no system-wide `corepack enable` was needed.
The initial bundled Node24 install/build also passed; the final rehearsal was
repeated on Node22. A preliminary node@22 package bootstrap failed because npm
was absent; the platform-specific Node22 binary resolved that tooling issue
without repository dependency or lockfile changes.

| Command | Exit | Actual result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile --prod=false` (Node22) | 0 | Lockfile unchanged |
| `pnpm build` (Node22) | 0 | TypeScript + Vite production build |
| `HOST=0.0.0.0 PORT=58422 node server/index.mjs` | running | HTTP server listening; kept running |
| `node qa/smoke.mjs http://127.0.0.1:58422` | 0 | 6/6, SEPTA returned200 during this observation |
| `node qa/septa-proxy-outage.mjs` | 0 | 5/5: HTTP500, network, malformed JSON, timeout and empty feed |
| `node qa/demo-rehearsal.cjs http://127.0.0.1:58422` | 0 | 8/8; live panel observed, 3.2s click path excluding speech |
| Same rehearsal with `--offline` | 0 | 8/8; unavailable panel observed, 3.3s excluding speech |

Rehearsal source: `origin/feat/qa-expansion` at
`2286ddda56c327ad8721613269554ff0bea3f235`; script copied unchanged and
identical to the existing RC1 script. Offline means **SEPTA request blocked in
the browser**, not a general offline/PWA claim. These are local observations,
not production latency/availability guarantees. No app code was changed.

## Exact post-deploy verification (release executor only)

1. Record Render's deployed full Git SHA. Require the approved RC1 SHA or a
   separately reviewed descendant; never infer deployment from main/PR status.
2. Fetch `/` fresh, verify JS/CSS names against the approved build and hash the
   actual downloaded asset bytes (not compressed transport bytes). For this build:
   - `index-iXTIY80o.js`: SHA256
     `1fc760c72ffba5f5e4a5979f480f6499d22caa4586a4d2d1bd29bb9468633490`
   - `index-BgJ2zc5e.css`: SHA256
     `1c341c8216a047aa1488a075b688b3d49bd7cf6a5a7ca38068827b0cb4ed09a0`
   If release code/toolchain differs, compare against that exact approved build;
   stop and investigate unexplained differences.
3. Set `RC1_URL` to the confirmed Render URL. Run
   `node qa/smoke.mjs "$RC1_URL"` (expect6/6), then
   `node qa/e2e-check.cjs "$RC1_URL" qa-results/rc1-postdeploy`.
   Record the raw exit and totals. RC1's existing local e2e was119/121, exit1:
   only320/390px unnamed-link checks on the map's closed details are known
   harness false positives. Any different/new failure requires investigation;
   don't silently report the suite green or suppress failures.
4. Rehearse online and `--offline` with `qa/demo-rehearsal.cjs` against the
   deployed URL; record8/8 each, actual SEPTA state and screenshots where useful.
   Confirm original Journey/Wallet deep links and honest sample/partial-map wording.

## Rollback

Person 5/release executor should record the previous successful Render deploy ID
and fullSHA before release. If acceptance fails, use Render's rollback to that
**previous successful deployment**, then verify its recorded SHA/assets and rerun
smoke/deep-link checks. Last confirmed production reference here is
`6df372e59388d9ec6f688cb4363e2756bc541a6a`; verify the actual previous deployment
at release time rather than assuming it has not changed. No force-push or data
migration is required by RC1. Rollback and deployment were not executed here.
