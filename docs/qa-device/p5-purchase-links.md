# P5 purchase-links verification (agent B): partial, stopped at coordinator time limit

Run 2026-10-25 12:52–12:55 UTC. The coordinator set a hard 5-minute deadline, so only the Amtrak Journey and Wallet clicks in installed Google Chrome were run.
Everything else below is NOT TESTED or BLOCKED (time limit).

## Tested SHAs and check totals

| Branch | SHA (git ls-remote 12:52 UTC) | Checks |
|---|---|---|
| fix/amtrak-booking-handoff | 1baa179cb46e041d508205c0b77af722a8ec28f9 | `pnpm install --frozen-lockfile` OK, `pnpm build` OK. typecheck/test NOT RUN (time limit). 2 browser checks run |
| feat/purchase-links-flix | 9e844ca50dc02697667222fd373c940380675a09 | NOT TESTED (time limit) |
| feat/purchase-links-commuter | e247e06287e931ed0d1923823bfe40b563a49952 | Pushed by 12:52 UTC. NOT TESTED (time limit) |
| feat/purchase-links | not on origin | BLOCKED: not pushed by 12:52 UTC |

Server: `HOST=127.0.0.1 PORT=5187 node server/index.mjs` (production build of 1baa179), stopped after the run.
Browser: installed Google Chrome via Playwright `channel: 'chrome'`, headed, 1280×900, clipboard-read/write granted for the origin.
Script: `docs/qa-device/scripts/p5-amtrak-handoff-quick.mjs`.

## Observed Amtrak rows (Chrome, 1280px)

| Spot | Route | href | Popup host | Clipboard text | Copy feedback | Accessible name has "(opens in a new tab)" | Result | Evidence |
|---|---|---|---|---|---|---|---|---|
| Journey "Get tickets" (after "View trip details") | /journey/amtrak-connection | `https://www.amtrak.com/` | www.amtrak.com | `Amtrak · Philadelphia, 30th Street → New York Penn Station · Sat, Oct 24, 2026 · dep 8:30 AM · Northeast Regional` | "Copied" visible | yes ("Get tickets from AMTRAK for segment 1, … copies trip details (opens in a new tab)") | PASS | `p5-purchase-links/amtrak-journey-chrome-1280.png` |
| Wallet ticket card | /wallet/amtrak-connection | `https://www.amtrak.com/` | www.amtrak.com | same text as above | "Copied" visible | yes ("Amtrak booking & app … copies trip details (opens in a new tab)") | PASS | `p5-purchase-links/amtrak-wallet-chrome-1280.png` |

Notes:
- The clipboard text has from, to and date. It has no train number: the sample leg has no `train` field, so none is expected.
- The sample date is Sat, Oct 24, 2026, which is the day before this run (2026-10-25). Not a handoff defect, but the demo trip is in the past.
- The accessible name was read from the link's text content, including the sr-only span; the link has no `aria-label`.
- The amtrak.com page content was not inspected. Only the popup host was checked.
- On the Journey page the DOM also has a second, non-visible amtrak.com anchor. A first click attempt that picked it timed out because the card covered it. The visible "Get tickets" link clicked normally. Not counted as a FAIL, but worth a look.

## Operator × spot table

| Operator | Search card | Journey | Wallet | IntegrationPage | 390px | 320px | Playwright WebKit 27.2 |
|---|---|---|---|---|---|---|---|
| Amtrak | NOT TESTED (time limit) | PASS (amtrak-journey-chrome-1280.png) | PASS (amtrak-wallet-chrome-1280.png) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | BLOCKED (time limit, not installed) |
| Greyhound | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | BLOCKED (time limit, not installed) |
| FlixBus | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | BLOCKED (time limit, not installed) |
| SEPTA | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | BLOCKED (time limit, not installed) |
| NJ TRANSIT | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | BLOCKED (time limit, not installed) |
| LIRR | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | NOT TESTED (time limit) | BLOCKED (time limit, not installed) |

Combined branch (`feat/purchase-links`): every row is BLOCKED (not pushed by 12:52 UTC).

Counts: Amtrak PASS 2, FAIL 0, BLOCKED 1, NOT TESTED 4. Greyhound, FlixBus, SEPTA, NJ TRANSIT and LIRR: PASS 0, FAIL 0, BLOCKED 1, NOT TESTED 6 each.

## Not run (time limit)

- Clipboard-denied manual-copy fallback: NOT TESTED.
- Generated Amtrak routes (`east-boston--new-york--amtrak`, `east-philadelphia--washington--amtrak`) and `/journey/regional-connection`: NOT TESTED.
- FlixBus/Greyhound module-generated URLs, external visits and the 6-minute re-open: NOT TESTED.
- SEPTA/NJ TRANSIT/LIRR module-generated links and external visits: NOT TESTED.
- Sweep of the 1,651 generated route IDs: NOT TESTED.
- 390/320px widths: NOT TESTED.
- `pnpm typecheck` and `pnpm test` on any branch: NOT RUN.

## WebKit

Playwright WebKit was not installed: the coordinator said to skip it. There is no download size to report.
