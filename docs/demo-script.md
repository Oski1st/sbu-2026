# OneLine demo script (about 2 minutes)

**One line:** OneLine turns a four-agency trip from Philadelphia to Stony Brook into one plan, one timeline and one ticket checklist, and it says honestly which parts are live and which are sample data.

## Before the demo (T–10 min)

- [ ] Open the deployed URL, or run `pnpm build && pnpm start` locally. Wake a sleeping free-tier host now.
- [ ] Use a fresh browser profile or private window so there is no old selection in `localStorage`. Zoom 110–125% for the projector.
- [ ] Open `/wallet/regional-connection` once to check the SEPTA panel. Note whether it says **Live feed fetched** or **Live data unavailable**; both are fine (see fallbacks).
- [ ] Return to `/`.
- [ ] Have `docs/qa-screenshots/` ready in case the Wi-Fi drops.

## Script

| Time | Screen | Action | Say |
| --- | --- | --- | --- |
| 0:00–0:15 | Search (`/`) | Show the hero and network strip. | "Getting from Philly to Stony Brook means SEPTA, NJ TRANSIT, maybe Amtrak, and the LIRR: four apps, four ticket systems. OneLine puts the whole trip on one line." |
| 0:15–0:40 | Search results | Change **Sort by** to *Fastest*, then *Lowest sample fare*. Untick and re-tick **Include Amtrak**. Open **View route details** on the scenic connection. | "Here are two ways there. Sort by speed or by fare, and drop Amtrak if you're on a budget. Every transfer is spelled out. These times and fares are clearly labelled sample data, not a timetable." |
| 0:40–1:10 | Journey (`/journey/regional-connection`) | Click **Choose this route** on the scenic connection. Scroll the timeline. Click **Simulate delay**. | "Now it's a journey: each train, each transfer, and what comes next. Platforms point you to the live station boards because they change. Watch what happens if SEPTA runs 12 minutes late. OneLine flags the at-risk connection and suggests a recovery plan. It's labelled as a simulation, never a live alert." |
| 1:10–1:45 | Wallet (`/wallet/regional-connection`) | Click **Wallet** in the header. Tick the first checklist item. Point to an official ticket link. Scroll to **SEPTA service snapshot**. | "The wallet collects every ticket you need, with official links for each agency. OneLine doesn't sell tickets and never fakes a boarding pass. And this is real: a live SEPTA Regional Rail snapshot fetched through our own server. It's agency-wide, and it never overwrites the sample itinerary." |
| 1:45–2:00 | Any | Optionally refresh the page to show the deep link survives. | "One journey, many connections. That's OneLine. Thanks!" |

If you have extra time, open the **express connection** (Amtrak + LIRR). Its Wallet has 3 legs and no SEPTA panel, because that trip doesn't use SEPTA.

## Fallbacks

| If… | Do / say |
| --- | --- |
| The SEPTA panel says **Live data unavailable** | "When SEPTA's feed is down, we say so instead of inventing trains. Your plan stays exactly as it was." That honest fallback is a feature; keep going. |
| The Wi-Fi or host is down | Run locally with `pnpm start` (SEPTA will show unavailable). If even that fails, walk through `docs/qa-screenshots/`. |
| You land on "Journey not found" | Click **Back to search** and choose the route again. |
| You lose your place | The header nav (Search / Journey / Wallet) remembers the chosen trip. |

## Known gaps to avoid on stage

- Until PR #1 adds an in-page Wallet button, go from Journey to Wallet with the **Wallet** tab in the header ([QA finding 1](qa-checklist.md#findings)).
- Don't claim live arrivals for NJ TRANSIT, Amtrak or LIRR. Only the SEPTA snapshot is live.
- Don't present the sample times or fares as real quotes.
