# OneLine demo script (about 2 minutes)

**One line:** OneLine turns a four-agency trip from Philadelphia to Stony Brook into one plan, one timeline and one ticket checklist, and it says honestly which parts are live and which are sample data.

## Before the demo (T–10 min)

- [ ] Open <https://oneline-sbu-2026.onrender.com> about 2 minutes early to wake the free Render instance (or run `pnpm build && pnpm start` locally). Production rehearsal on Oct 24 (`6df372e`): 8 / 8 steps online and offline.
- [ ] Use a fresh browser profile or private window so there is no old selection in `localStorage`. Zoom 110–125% for the projector.
- [ ] Open `/wallet/regional-connection` once to check the SEPTA panel. Note whether it says **Live feed fetched** or **Live data unavailable**; both are fine (see fallbacks).
- [ ] Return to `/`.
- [ ] Have `docs/qa-screenshots/` open in case the Wi-Fi drops.

## Script

| Time | Screen | Action | Say |
| --- | --- | --- | --- |
| 0:00–0:15 | Search (`/`) | Show the hero and the two route cards. | "Getting from Philly to Stony Brook means SEPTA, NJ TRANSIT, maybe Amtrak, and the LIRR: four apps, four ticket systems. OneLine puts the whole trip on one line." |
| 0:15–0:40 | Compare dialog | Tick **Compare route** on both cards, then click **Compare routes**. | "Two ways there, side by side. The express is about an hour faster but costs $15 more. Every transfer and every trade-off is in the open. These times and fares are clearly labelled sample data, not a timetable." |
| 0:40–1:10 | Journey (`/journey/regional-connection`) | Click **Choose route** under *Scenic Connection*. Scroll the timeline. Click **Simulate delay**. | "Now it's a journey: each train, each transfer, and what comes next. Watch what happens if SEPTA runs late. OneLine flags the at-risk connection and suggests a recovery plan. It's labelled as a simulation, never a live alert." |
| 1:10–1:45 | Wallet (`/wallet/regional-connection`) | Click **View ticket wallet →** at the end of the Journey. Tick the first checklist item. Point to an official ticket link. Scroll to **SEPTA service snapshot**. | "The wallet collects every ticket you need, with official links for each agency. OneLine doesn't sell tickets and never fakes a boarding pass. And this is real: a live SEPTA Regional Rail snapshot fetched through our own server. It's agency-wide, it expires after a minute, and it never overwrites the sample itinerary." |
| 1:45–2:00 | Wallet | Refresh the page to show the deep link survives. | "One journey, many connections. That's OneLine. Thanks!" |

If you have extra time, choose the **Express Connection** (Amtrak + LIRR) instead. Its Wallet has 3 legs and no SEPTA panel, because that trip doesn't use SEPTA.

## Fallbacks

| If… | Do / say |
| --- | --- |
| The SEPTA panel says **Live data unavailable** (**SEPTA observations unavailable** from `ea6c065` on) | "When SEPTA's feed is down, we say so instead of inventing trains. Your plan stays exactly as it was." That honest fallback is a feature; keep going. |
| The panel says **Snapshot expired** | You lingered over a minute. Click **Refresh** (**Refresh feed** from `ea6c065` on), or say: "Live data goes stale, so we hide it instead of showing old trains." |
| The panel says **no active trains** | "The feed is up but empty, and we don't pretend that means service stopped." |
| The Wi-Fi or host is down | Run locally: `pnpm build && pnpm start`, then open `http://127.0.0.1:3000`. The built app loads no external fonts or scripts, so everything except the SEPTA panel works offline, and the panel shows its unavailable state. If even that fails, walk through `docs/qa-screenshots/`. |
| You land on "Journey not found" | Click **Back to search** and choose the route again. |
| You lose your place | The header nav (Search / Journey / Wallet) remembers the chosen trip. |

## Rehearsal

`node qa/demo-rehearsal.cjs <url>` clicks through the script above and fails on any missing step. Add `--offline` to block the SEPTA proxy and rehearse the unavailable fallback.

| Date | Build | Online | Offline SEPTA |
| --- | --- | --- | --- |
| Oct 24 | `main` `93c0408` | 8 / 8 steps; panel live | 8 / 8 steps; panel unavailable |
| Oct 24 | `93c0408` + open PRs #8 and #9 (local merge, not pushed) | 8 / 8 steps; panel live | 8 / 8 steps; panel unavailable |
| Oct 24 | `main` `ea6c065` (PRs #8 and #9 merged) | 8 / 8 steps; panel live | 8 / 8 steps; panel unavailable |

The clicks take about 3 seconds in total, so the two minutes are speaking time. The Compare insight read "The express connection gets you there 65 minutes sooner for $15 more in sample fares", which matches the script's line.

## Avoid on stage

- Don't claim live arrivals for NJ TRANSIT, Amtrak or LIRR. Only the SEPTA snapshot is live.
- Don't present the sample times or fares as real quotes.
