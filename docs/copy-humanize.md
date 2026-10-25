# Copy pass: making the site sound less AI-written

The owner asked for the site's wording to "seem less AI". This file lists the rules we used and every string we changed.

## Sources

- [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), a guide Wikipedia editors keep to spot AI-generated text. Text is CC BY-SA 4.0. We paraphrase its categories here and quote none of it.
- [blader/humanizer](https://github.com/blader/humanizer), a Claude Code skill built on the Wikipedia guide. MIT licensed. We read its pattern list and used it as a checklist. No code or skill text is copied into this repo.

## Checklist

Avoid:

- Slogan pairs and staged contrasts, such as "Different lines. Same direction.", "A little less friction. A lot more adventure.", or "not X, but Y".
- Inflated or vague words: seamless, effortless, unlock, elevate, empower, possibility, adventure, and "journey" used as a metaphor.
- Promotional lines that say nothing checkable, like "A whole coast of possibilities." or "Every connection, considered."
- Triads added for rhythm. Keep a list of three only when there really are three things.
- Em-dash asides where a full stop works.
- Title-case or teaser headings ("The best part?"). Use sentence case and say what the section is.
- Chatty filler ("Let's get you there", "Let's go somewhere").
- Emoji flourishes.

Prefer:

- Say what the page or button does, with plain verbs (Search trips, Back to search).
- Concrete facts from the data: operator names, minutes, sample fares.
- Short sentences and the same term for the same thing. We now use "leg" on both Journey and Wallet.
- Honest limits. Keep every disclosure: sample-only data, "not a timetable", partial coverage, "NOT IN PUBLISHED SCHEDULES", the Amtrak/SEPTA status notes, and the simulated-delay labels.

## Scope rules for this pass

- Only string literals changed. Logic, class names, styles, map geometry, and `server/` are untouched.
- Route labels "The scenic connection" and "The express connection" are unchanged. `docs/demo-script.md` and the compare/share accessible names use them.
- Wallet, SEPTA status, ticketing help, and map audit text were already plain and are pinned by tests, so they are unchanged.

## Before → after

Line numbers refer to this branch (`feat/copy-humanize`).

### Shell: title, header, footer, 404

| File:line | Before | After |
| --- | --- | --- |
| index.html:10 | OneLine brings SEPTA, NJ TRANSIT, Amtrak, and LIRR together in one clear journey. | Plan East Coast trips that mix SEPTA, NJ TRANSIT, Amtrak and LIRR, with every leg on one page. A student hackathon prototype that uses sample itineraries. |
| index.html:12 | OneLine · A better way there | OneLine · Trip planner |
| src/App.tsx:49 | (title suffix) A better way there | Trip planner |
| src/App.tsx:65 | Connecting your journey… | Loading… |
| src/App.tsx:81 | A little off the line. | Page not found |
| src/App.tsx:82 | Let’s get you back on track. | There’s no OneLine page at this address. |
| src/components/layout/AppLayout.tsx:35 | Less switching. More going. | Prototype · sample trips |
| src/components/layout/AppLayout.tsx:42 | Connecting your journey… | Loading… |
| src/components/layout/AppLayout.tsx:54 | A better way there. | Trip planning across transit operators. |
| src/components/layout/AppLayout.tsx:57 | Made for the in-between. | For trips with transfers. |
| src/components/layout/AppLayout.tsx:66 | Built together | Source on GitHub |
| src/components/layout/AppLayout.tsx:70 | One journey. Many connections. | Not affiliated with any transit operator. |
| docs/deployment.md:45 | "A little off the line" page | "Page not found" page |

### Search page

| File:line | Before | After |
| --- | --- | --- |
| src/pages/SearchPage.tsx:135 | ALL YOUR CONNECTIONS. ONE CLEAR PATH. | EAST COAST RAIL AND BUS TRIP PLANNER |
| src/pages/SearchPage.tsx:138–142 | Different lines. / Same direction. | Plan trips that / cross operators. |
| src/pages/SearchPage.tsx:153 | From your first departure to your last stop. / A simpler way to travel across the East Coast. | Every leg of your trip on one page. / You buy tickets from each operator directly. |
| src/pages/SearchPage.tsx:160 | {n} cities, one bigger idea | {n} sample cities |
| src/pages/SearchPage.tsx:165 | Trains + coaches. More possibility. | Rail and intercity bus |
| src/pages/SearchPage.tsx:189 | A clearer view of your options. | Ready to compare. |
| src/pages/SearchPage.tsx:224 | A BIGGER PICTURE | SAMPLE CORRIDORS |
| src/pages/SearchPage.tsx:225 | A whole coast of possibilities. | Try another corridor. |
| src/pages/SearchPage.tsx:227 | {n} cities, Maine to Florida. Explore sample rail and coach corridors. | {n} cities from Maine to Florida. Pick a corridor to load its sample rail and bus trips. |
| src/pages/SearchPage.tsx:310 | THE JOURNEY STARTS HERE | RESULTS |
| src/pages/SearchPage.tsx:312 | A few ways to get there. | Sample routes. |
| src/pages/SearchPage.tsx:317 | Philadelphia to Stony Brook. Every connection, considered. | Showing the demo search: Philadelphia to Stony Brook. |
| src/pages/SearchPage.tsx:405 | Compare two options | Compare the first two |
| src/pages/SearchPage.tsx:429 | Try another mode or operator. No matching sample is not evidence that real service is unavailable. | Try another mode or operator. A missing sample doesn’t mean there’s no real service. |
| src/pages/SearchPage.tsx:444 | Designed for clarity, not guesswork. All displayed times and fares are illustrative. Confirm your trip with the agencies before traveling. Bus and expanded rail routes are city-level concepts, not verified services. | All times and fares shown are illustrative. Confirm your trip with each agency before you travel. Bus routes and the expanded rail routes are city-level concepts, not verified services. |
| src/pages/SearchPage.tsx:456 | LESS TAB-HOPPING. | WHY WE BUILT IT |
| src/pages/SearchPage.tsx:458–460 | Your whole trip. / Finally together. | Every leg / on one page. (also fixes the words running together at 320px, where the `<br>` is hidden) |
| src/pages/SearchPage.tsx:463 | More operators shouldn’t mean more scattered plans. See the connections, compare your options, and know what comes next. | Philadelphia to Stony Brook by train can mean SEPTA, NJ TRANSIT and LIRR, each with its own app. OneLine lists the legs, the transfers, and where to buy each ticket. |
| src/pages/SearchPage.tsx:470 | Every leg in one place | Times for each leg |
| src/pages/SearchPage.tsx:474 | Clear transfer points | Where you change services |
| src/pages/SearchPage.tsx:478 | Official ticket links | Links to official ticket sites |
| src/pages/SearchPage.tsx:490–492 | A little less friction. / A lot more adventure. | You still buy tickets / from each operator. |
| src/pages/SearchPage.tsx:498 | A glimpse of what’s next | Hackathon prototype |
| src/pages/SearchPage.tsx:500 | Built at SBUHacks 2026. Real networks, sample journeys, one connected idea. | Built by a student team at SBUHacks 2026. The operators are real; the trips are samples. |
| src/pages/SearchPage.tsx:510 | TAKE THE CONNECTED ROUTE | ANOTHER TRIP? |
| src/pages/SearchPage.tsx:512–514 | The best part? / You’re already on your way. | Planning something else? / Start a new search. |
| src/pages/SearchPage.tsx:518 | Let’s go somewhere | Back to search (matches its existing aria-label) |

### Search components

| File:line | Before | After |
| --- | --- | --- |
| src/components/search/SearchForm.tsx:42 | LET’S GET YOU THERE | PLAN A TRIP |
| src/components/search/SearchForm.tsx:86 | Where to? (placeholder) | Arrival city |
| src/components/search/SearchForm.tsx:122 | Find my way | Search trips |
| src/components/search/RouteCard.tsx:52 | EXPLORE THIS CORRIDOR | CITY-LEVEL CONCEPT |
| src/components/search/RouteComparison.tsx:67 | A LITTLE PERSPECTIVE | COMPARE ROUTES |
| src/components/search/RouteComparison.tsx:79 | Find your kind of journey. | Two routes, side by side. |
| src/components/search/RouteComparison.tsx:81 | Side by side. Every trade-off in the open. All times and fares below are sample data. | All times and fares below are sample data. |
| src/components/search/CorridorMap.tsx:31 | Follow the rails. | Amtrak corridors. |

### Data shown on Search

| File:line | Before | After |
| --- | --- | --- |
| src/data/eastCoast.ts:282 | Explore the corridor. Check actual services and fares with the operator. | Check actual services and fares with the operator. |
| src/data/tripLookup.ts:85 | (same as above) | (same as above) |
| src/data/eastCoast.ts:294 | City lights | Sample trips |
| src/data/eastCoast.ts:300 | The capital connection | Sample trips |
| src/data/eastCoast.ts:306 | Carolina calling | Sample trips |
| src/data/eastCoast.ts:312 | Chase the sunshine | Sample trips |
| src/data/originalDemoTrips.ts:40 | A little more time. A lot more possibility. | SEPTA, NJ TRANSIT, then LIRR. Lower sample fare, one more transfer. |
| src/data/originalDemoTrips.ts:91 | Trade a transfer for a little more breathing room. | Amtrak to New York, then LIRR. 65 minutes less time on board, $15 more in sample fares. |

The figures come from the sample data: 315 vs 250 minutes, $46 vs $61, 3 vs 2 transfers.

### Journey

| File:line | Before | After |
| --- | --- | --- |
| src/components/journey/DelaySimulation.tsx:18 | Journey lab | Demo |
| src/components/journey/DelaySimulation.tsx:20 | See how OneLine helps when a connection is at risk. This is a demo scenario, never a live alert. | Add a simulated 12-minute delay to the first leg to see what OneLine suggests for your connection. This is a demo, not a live alert. |
| src/components/journey/JourneyDemoControls.tsx:51 | Guided journey to {destination} | Steps to {destination} |
| src/components/journey/JourneyDemoControls.tsx:52 | A tap-through walkthrough only — it does not use GPS, confirm boarding, or show live arrivals. | You tap through each step yourself. It doesn’t use GPS, confirm boarding, or show live arrivals. |
| src/components/journey/RecoveryRecommendation.tsx:19 | Your connection may no longer be comfortable. | You might miss your connection. |
| src/components/journey/SegmentCard.tsx:84 | Journey segment {n} | Leg {n} |

### Wallet and the Journey/Wallet fallback page

| File:line | Before | After |
| --- | --- | --- |
| src/pages/WalletPage.tsx:29 | One journey. / Every ticket, together. | Where to buy / each ticket |
| src/pages/WalletPage.tsx:33 | Plan here. Purchase with the agency. | OneLine doesn’t sell tickets. Buy them from each agency. |
| src/components/layout/IntegrationPage.tsx:28 | YOUR NEXT CHAPTER | JOURNEY |
| src/components/layout/IntegrationPage.tsx:32 | A clear path ahead. | Your journey |
| src/components/layout/IntegrationPage.tsx:33 | Every ticket. One starting point. | Ticket links |
| src/components/layout/IntegrationPage.tsx:37 | Your selected connection is ready to explore. | The route you choose on Search appears here. |
| src/components/layout/IntegrationPage.tsx:105 | Start with a connection. | No route chosen yet. |
| src/components/layout/IntegrationPage.tsx:106 | Choose a route from Search to bring your journey here. | Choose a route on the Search page first. |
| src/components/layout/IntegrationPage.tsx:108 | Find my way | Go to search |
