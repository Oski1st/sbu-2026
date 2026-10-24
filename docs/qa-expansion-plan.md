# East Coast expansion QA plan

Owner: Person 4. Feature owner: Person 1 (`feat/east-coast`, linked from hub issue #3).

**Status: plan only. No results are recorded yet.** Results go in the tables below only after hub #3 names the exact expansion PR commit. They record that SHA, and a separate run on the merged `main` SHA. Earlier QA results stay in [qa-checklist.md](qa-checklist.md) and are not affected.

## What the expansion claims (from hub #3)

- `Agency` gains `GREYHOUND` and `FLIXBUS`. Agencies gain `mode: rail | bus`, and `Leg` gains an optional `mode`.
- 24 East Coast cities, rail / bus / mixed journeys, operator and mode filters, and city aliases.
- Stable, shareable concept-trip IDs and overnight dates.
- Original demo trip IDs and times are unchanged.
- **Every new service, duration, fare and connection is an illustrative sample concept.** There is no live bus inventory, no live prices, no arrivals, and no ticket purchase. Booking links go to the official operator.

## Acceptance criteria (from the coordinator, hub #2)

1. The existing demo still passes: `pnpm test:e2e` shows no new failures against the pre-expansion baseline, and `qa/demo-rehearsal.cjs` passes online and with `--offline`.
2. Expanded journeys are clearly labelled sample-only.
3. Official booking URLs stay operator-owned.
4. Reloads work.
5. Mobile and keyboard flows pass.
6. Failures are recorded honestly.

## Scenarios

Fill in **SHA** and **Result** only from a real run. Use "Pass", "Fail (#n)" with a finding number, or "Not run". Trip IDs are taken from the PR once it exists.

### A. Regression: the existing demo

| # | Scenario | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| A1 | Default search, Philadelphia → Stony Brook | The same two routes as before, with IDs `regional-connection` and `amtrak-connection` and unchanged times and fares | | |
| A2 | `pnpm test:e2e` | No new failures compared with the last `main` run | | |
| A3 | `qa/demo-rehearsal.cjs`, online and `--offline` | 8 / 8 steps each | | |
| A4 | Old deep links `/journey/regional-connection` and `/wallet/amtrak-connection` | Load and survive a refresh | | |

### B. New journeys

| # | Scenario | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| B1 | Boston → New York | Rail (Amtrak), Greyhound and FlixBus options. Each is labelled with its mode and operator and marked as a sample concept. | | |
| B2 | Portland → Miami | Arrives the next day. The date is shown explicitly (for example "Oct 25" or "+1 day"), and the total duration is correct across midnight. | | |
| B3 | Boston → Stony Brook | A mixed coach + LIRR journey, with the bus leg shown as bus and the LIRR leg as rail | | |
| B4 | Reverse trips (New York → Boston, Miami → Portland, Stony Brook → Boston) | Results exist, or a clear no-results state. Never the forward trip with the labels swapped. | | |
| B5 | Journey and Wallet pages for B1–B3 | Bus legs render with bus labels. The Wallet lists one card per leg, each with that operator's official link. | | |

### C. Search input

| # | Scenario | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| C1 | Aliases `NYC` and `New York City` | Resolve to New York | | |
| C2 | Alias `DC` (and `Washington, DC`) | Resolves to Washington | | |
| C3 | Case and whitespace (`  boston `) | Resolves | | |
| C4 | Unknown city (`Atlantis`) | A clear, accessible "not supported" message that names the input. No invented route and no crash. | | |
| C5 | Same origin and destination | Validation message, no results | | |
| C6 | Mode filter: rail only, bus only, mixed | Only matching journeys. The empty state is clear. | | |
| C7 | Operator filter (for example, exclude Greyhound) | Journeys using that operator are hidden. Clearing the filter restores them. | | |

### D. Data honesty

| # | Scenario | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| D1 | New journey cards, Compare, Journey and Wallet | A visible "sample" or "concept" label on times, durations and fares | | |
| D2 | Unknown fare | Shown as "Fare unavailable" or similar. Never `$0`, `NaN` or a guessed number. Compare and sort handle it without errors. | | |
| D3 | Booking links | Every Greyhound and FlixBus link goes to the operator's own domain over `https`, opens in a new tab with `rel="noopener"`, and has no tracking or affiliate parameters. Existing SEPTA / NJ TRANSIT / Amtrak / LIRR links are unchanged. | | |
| D4 | SEPTA live panel | Still appears only on journeys with a SEPTA leg. Never on bus or other-city journeys. | | |
| D5 | No live claims | No "live", "real-time" or "book now" wording for bus inventory, prices or arrivals | | |

### E. Reloads, sharing and invalid IDs

| # | Scenario | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| E1 | Refresh on `/journey/<new-id>` and `/wallet/<new-id>` | Same journey | | |
| E2 | Shared link in a fresh browser (no localStorage) | Opens the same journey | | |
| E3 | Mistyped new ID | "Journey not found" with a way back | | |

### F. Mobile and keyboard

| # | Scenario | Expected | SHA | Result |
| --- | --- | --- | --- | --- |
| F1 | 320px and 390px: Search with filters, results, Compare, Journey and Wallet for B1–B3 | No horizontal overflow. Every button and link is named and unclipped. Long city names wrap. | | |
| F2 | Keyboard only: type a city, pick an alias suggestion, change filters, choose a route, open the Wallet | Every control is reachable with a visible focus ring. Filter changes are announced or reflected in a results count. | | |
| F3 | Overnight dates at 320px | The date and "+1 day" stay visible | | |
| F4 | Page or console errors across the run | None | | |

## How this will be run

1. Check out the exact SHA from hub #3, then run `pnpm install --frozen-lockfile && pnpm build && pnpm test`.
2. Run `pnpm start`, then `pnpm test:e2e`, `pnpm test:proxy` and `node qa/demo-rehearsal.cjs <url>` (online and `--offline`).
3. Extend `qa/e2e-check.cjs` with sections B–F using the PR's real trip IDs and selectors, then run them. A scenario that can't be automated is checked by hand and recorded as "manual".
4. Record each result against its SHA in this file, and report in hub issue #2.
