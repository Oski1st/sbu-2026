# OneLine: judge and demo brief

**Live:** <https://oneline-sbu-2026.onrender.com> · SBUHacks 2026 · independent student project

## The rider problem

Getting from Philadelphia to Stony Brook can mean SEPTA, NJ TRANSIT, Amtrak and the Long Island Rail Road: four apps, four ticket systems and transfers nobody explains end to end. Riders plan in fragments and find out about a tight connection too late.

## What OneLine does

| | What you see | What it is **not** |
| --- | --- | --- |
| **One search** | Both ways there, side by side. Compare shows the trade-off: *"The express connection gets you there 65 minutes sooner for $15 more in sample fares."* | Times and fares are **sample data**, labelled on screen. They are not a timetable or a quote. |
| **One timeline** | Every leg, every transfer, and what comes next. **Simulate delay** flags an at-risk connection and suggests a recovery plan. | The delay is a **labelled demo scenario**, never a live alert. No GPS or boarding confirmation. |
| **One ticket checklist** | One card per leg with the operator's **official** ticket page (SEPTA, NJ TRANSIT, MTA TrainTime, Amtrak). | OneLine **does not sell, issue or validate tickets**. Checklist ticks are demo-only. |
| **One live signal** | A **SEPTA Regional Rail snapshot**, fetched through OneLine's own server. It expires after 60 s and says honestly when the feed is unavailable or empty. | It's agency-wide and **not matched to your journey**. It never changes the sample itinerary. No other agency data is live. |

## Two-minute demo (deployed today)

1. **Search** (`/`): Philadelphia → Stony Brook. Tick **Compare route** on both cards, then **Compare routes**.
2. **Journey:** **Choose route** on *Scenic Connection* (SEPTA + NJ TRANSIT + LIRR, 5h 15m, $46 sample). Scroll the timeline, then **Simulate delay**.
3. **Wallet:** **View ticket wallet →**. Tick a leg, point to an official ticket link, scroll to **SEPTA service snapshot**.
4. **Refresh** to show the deep link survives. The full script is in [demo-script.md](demo-script.md).

The alternative is the *Express Connection* (Amtrak + LIRR, 4h 10m, $61 sample). It has 3 legs and no SEPTA panel.

## Preview: East Coast rail and coach concepts (not deployed)

PR #13 (under review, **not merged or deployed**) extends the idea to 24 cities from Portland, ME to Miami. It adds Amtrak, Greyhound and FlixBus **city-level concepts**: Boston → New York by rail or coach, Portland → Miami arriving the next day, and Boston → Stony Brook by coach + LIRR. Every expanded route is labelled a sample concept, "not verified services", and hands off to the operator's own booking site. There's **no live bus inventory, pricing, arrival or ticket API**.

## Does it work today?

The production deploy is `main` `6df372e` (October 24, 2026). Results:

- Hosted smoke test: 6 / 6.
- Browser suite: 120 / 121. The one failure is a hosting-edge response to a deliberately malformed URL, not an app defect.
- Demo rehearsal: 8 / 8 with SEPTA live and 8 / 8 with SEPTA blocked.

Details are in [qa-checklist.md](qa-checklist.md).

## Fallback if the Wi-Fi or host fails

| Situation | What to do |
| --- | --- |
| The free host is asleep | Open the URL about 2 minutes early. The first request can take about a minute. |
| SEPTA panel says *unavailable* | Keep going: "When the feed is down, we say so instead of inventing trains." Everything else works. |
| No internet at all | On a laptop prepared **beforehand while online**, run the commands below and open <http://127.0.0.1:3000>. The app loads no external fonts or scripts, so it works offline; only the SEPTA panel shows *unavailable*. |
| Laptop fails too | Walk through the screenshots in [qa-screenshots/](qa-screenshots/). |

```sh
# Once, while online (Node 22.12+, corepack enabled)
pnpm install --frozen-lockfile && pnpm build
# At the demo, works offline
pnpm start            # http://127.0.0.1:3000
```

Deployment details are in [deployment.md](deployment.md).
