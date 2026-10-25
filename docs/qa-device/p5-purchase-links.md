# P5 purchase-links verification (agent B) — INCOMPLETE, stopped at coordinator time limit

Stopped 2026-10-25 ~12:53 UTC on the coordinator's instruction (about 4 minutes left).
No browser run, build, typecheck or test run was completed. Nothing below is a browser PASS or FAIL.

## Branches seen (git ls-remote, 12:48 UTC)

| Branch | SHA | Status |
|---|---|---|
| fix/amtrak-booking-handoff | 1baa179cb46e041d508205c0b77af722a8ec28f9 | Worktree created (`sbu-2026-pl-amtrak`); not built, not tested |
| feat/purchase-links-flix | 9e844ca50dc02697667222fd373c940380675a09 | Landed 12:48 UTC; worktree created (`sbu-2026-pl-flix`); not built, not tested |
| feat/purchase-links-commuter | — | BLOCKED: branch not pushed by 12:48 UTC |
| feat/purchase-links | — | BLOCKED: branch not pushed by 12:48 UTC |

Check totals: 0 run (pnpm install/typecheck/build/test not run on any branch).

## Operator × spot table

| Operator | Search card | Journey | Wallet | IntegrationPage | 390px | 320px | Playwright WebKit 27.2 |
|---|---|---|---|---|---|---|---|
| Amtrak | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Greyhound | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| FlixBus | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| SEPTA | BLOCKED (commuter not pushed) | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| NJ TRANSIT | BLOCKED (commuter not pushed) | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| LIRR | BLOCKED (commuter not pushed) | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

Counts: PASS 0, FAIL 0, BLOCKED 28 (SEPTA/NJT/LIRR), NOT TESTED 21 (Amtrak/Greyhound/FlixBus).

Sweep over 1,651 generated route IDs: not run. Amtrak clipboard/popup checks: not run.
FlixBus/Greyhound external visits and 6-minute re-open: not run. No screenshots taken.

## Code-read observations only (diff vs RC3-UI 7fa350d, not browser-verified)

- 1baa179 adds `src/components/AmtrakHandoff.tsx` and `src/lib/amtrakHandoff.ts` and wires them into
  `RouteCard.tsx`, `SegmentCard.tsx`, `TicketCard.tsx`/`ticketing.ts` and the `IntegrationPage.tsx` wallet branch.
  The href is always `https://www.amtrak.com/`; every Amtrak call site has "(opens in a new tab)" in its aria-label or sr-only text.
  The trip text includes `Train <n>` only when a `train` field exists. `Leg` is passed as-is, so whether a train number ever appears was not checked.
- 9e844ca adds `src/lib/purchase/flix.ts`, `src/data/purchase/flixCities.json` and tests, but per its diffstat no component changes.
  The FlixBus/Greyhound URLs are probably not wired into any UI spot on that branch alone. Expected to be wired on `feat/purchase-links`; unverified.

## WebKit

Not installed. Install skipped on the coordinator's instruction, so there is no on-disk size to report.

## Still to do (next agent)

Build and test both worktrees, serve on 5187/5188, then run the Chrome and WebKit checks and the 1,651-route sweep.
Poll for the commuter and combined branches.
