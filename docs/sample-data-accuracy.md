# Sample data accuracy (checked 2026-10-25)

OneLine's times and fares are still **sample data**. They are not timetables, fare quotes or live arrivals, and every label that says "sample", "illustrative" or "concept" stays. This page records which sample numbers were corrected against official sources, and what is still unverified.

Sources of the check:

- **QA38**: the official-source check in `docs/qa-p5d-qa38.md` on branch `qa/p5d-qa38-rc1` (2026-10-25, 06:20–06:30 UTC). It reviewed the research file `docs/qa-device/research/p5-05-times-fares-evidence.md` at `1be9cf0`.
- **This fix** (2026-10-25): re-read the Greyhound route pages, and extracted the text of the MTA Port Jefferson Branch timetable and the SEPTA Trenton Line timetable to re-check the run times. The weekend LIRR times below come from aligning timetable columns in that text, so a person should spot-check them in the PDF.

## Demo trip: Philadelphia → Stony Brook (Search cards, Compare, Journey, Wallet)

The sample date is Saturday, Oct 24, 2026, so weekend timetables and off-peak fares apply. The first departures (8:00 AM and 8:30 AM), the NJ TRANSIT and Amtrak times, the Amtrak fare and the 20-minute connections at Penn Station did not change.

| What you see | Before | After | Official source | Checked |
| --- | --- | --- | --- | --- |
| Scenic: SEPTA Trenton Line, 30th Street → Trenton | 8:00–8:55 AM (55 min) | 8:00–8:52 AM (52 min) | [SEPTA Trenton Line timetable](https://schedules.septa.org/current/TRE.pdf), eff. July 5, 2026: weekend trains leave Gray 30th St at x:40 and reach Trenton at x+1:32 | QA38 + this fix |
| Scenic: SEPTA sample fare | $10 | $11 | [septa.org/fares](https://www.septa.org/fares/), Regional Rail: NJ zone ↔ Center City $11.00 (SEPTA Key or Quick Trip), $13.00 on board | QA38 |
| Scenic: change at Trenton ("min planned", delay demo) | 15 min | 18 min | Follows from the 52-minute SEPTA leg; the 9:10 AM NJ TRANSIT departure is unchanged | – |
| Scenic: NJ TRANSIT sample fare | $20 | $20.35 in the data. It still **shows as $20** because fares are shown in whole dollars | [NJ TRANSIT adjusted fares](https://www.njtransit.com/adjustedfares) (eff. July 1, 2026) → [New York Penn Station fare table](https://content.njtransit.com/sites/default/files/marketing/website/pdf/Fares/New%20York%20Penn%20Station.pdf): Trenton, adult one-way $20.35 | QA38 |
| Scenic: LIRR Penn Station → Huntington | 11:00 AM–12:10 PM (70 min) | 11:00 AM–12:13 PM (73 min) | [MTA Port Jefferson Branch timetable](https://www.mta.info/document/216881), Sep 8–Nov 8, 2026, weekend: Penn 6:59 AM → Huntington 8:12 AM, change, 8:21 AM → Stony Brook 8:56 AM (73 + 9 + 35 = 117 min). The 12:59 PM train has the same pattern | QA38 + this fix |
| Scenic: change at Huntington | 15 min | 9 min | same | QA38 + this fix |
| Scenic: LIRR Huntington → Stony Brook | 12:25–1:15 PM (50 min) | 12:22–12:57 PM (35 min) | same (weekend 35–36 min, weekday 34–41 min) | QA38 + this fix |
| Scenic: total journey / arrival | 5h 15m, arrives 1:15 PM | 4h 57m, arrives 12:57 PM | Sum of the legs | – |
| Scenic: time on board / between services / shortest transfer | 4h 25m / 50 min / 15 min | 4h 10m / 47 min / 9 min | Sum of the legs | – |
| Scenic: sample fare total | $46 | $47 ($11 + $20.35 + $16 = $47.35) | Sum of the legs | – |
| Express: LIRR Penn Station → Huntington | 10:10–11:20 AM (70 min) | 10:10–11:23 AM (73 min) | MTA timetable, as above | QA38 + this fix |
| Express: change at Huntington | 25 min | 9 min | same | QA38 + this fix |
| Express: LIRR Huntington → Stony Brook | 11:45 AM–12:40 PM (55 min) | 11:32 AM–12:07 PM (35 min) | same | QA38 + this fix |
| Express: total journey / arrival | 4h 10m, arrives 12:40 PM | 3h 37m, arrives 12:07 PM | Sum of the legs | – |
| Express: time on board / between services / shortest transfer | 3h 25m / 45 min / 20 min | 3h 8m / 29 min / 9 min | Sum of the legs | – |
| Express: sample fare total | $61 | $61 (unchanged) | – | – |
| Express card text | "65 minutes less time on board, $15 more in sample fares." | "62 minutes less time on board, $14 more in sample fares." | 4h 10m − 3h 8m on board; $61 − $47.35. The old "65" was the total-journey gap; the on-board gap was 60. A test now ties this text to the data | – |
| Compare insight | "gets you there 35 minutes sooner for $15 more in sample fares" | "gets you there 50 minutes sooner for $14 more in sample fares" | Arrival 12:07 PM vs 12:57 PM. "Sooner" is still arrival-based: the whole journey is 80 minutes shorter and the time on board 62 minutes shorter | – |

Confirmed and unchanged: the LIRR fare of **$16** (zone 1 → zone 10 off-peak $16.00; peak $21.50; [MTA station fares](https://www.mta.info/document/194866), eff. Jan 4, 2026; Stony Brook is zone 10). The NJ TRANSIT run of **90 min** (weekend Trenton → New York Penn takes 82–94 min, 9:17 → 10:51 AM for example, in the NJ TRANSIT times printed in the SEPTA timetable above).

## Generated concept trips (city-pair graph in `src/data/eastCoast.ts`)

| Graph edge | Before | After | Official source | Checked |
| --- | --- | --- | --- | --- |
| LIRR New York ↔ Stony Brook (concept leg "LIRR connection concept · changes to confirm") | 180 min (3h 0m) | 117 min (1h 57m) | [MTA timetable](https://www.mta.info/document/216881), weekend. The six trains with a Huntington change that leave Penn between 5:38 AM and 12:59 PM take 114–119 min (QA38 read 117 and 119) | QA38 + this fix |
| Coach Richmond → Raleigh | 180 min | 130 min (2h 10m) | [Greyhound Richmond → Raleigh](https://www.greyhound.com/bus-routes/richmond-va-raleigh-nc): "Min. trip duration 2 hr 10 mins" | QA38 + this fix |
| Coach Raleigh → Richmond | 180 min | 150 min (2h 30m) | [Greyhound Raleigh → Richmond](https://www.greyhound.com/bus-routes/raleigh-nc-richmond-va): "2 hr 30 mins" | QA38 + this fix |
| Coach Fayetteville ↔ Savannah | 315 min via Charleston | 265 min (4h 25m), new city-pair edge | [Greyhound Fayetteville → Savannah](https://www.greyhound.com/bus-routes/fayetteville-nc-savannah-ga) and [Savannah → Fayetteville](https://www.greyhound.com/bus-routes/savannah-ga-fayetteville-nc): "4 hr 25 mins" | QA38 + this fix |
| Coach Albany → Boston | 445 min via New York and Providence | 220 min (3h 40m), new city-pair edge | [Greyhound Albany → Boston](https://www.greyhound.com/bus-routes/albany-ny-boston-ma): "3 hr 40 mins" | QA38 + this fix |
| Coach Boston → Albany | 445 min via New York and Providence | 200 min (3h 20m) | [Greyhound Boston → Albany](https://www.greyhound.com/bus-routes/boston-ma-albany-ny): "3 hr 20 mins" | QA38 + this fix |
| Coach Charleston → Savannah | 115 min | 190 min (3h 10m) | [Greyhound North Charleston → Savannah](https://www.greyhound.com/bus-routes/north-charleston-sc-savannah-ga): "3 hr 10 mins". QA38 marked the app's 115 as too low but did not list it as a correction; it is fixed here too | QA38 + this fix |
| Coach Savannah → Charleston | 115 min | 180 min (3h 0m) | [Greyhound Savannah → North Charleston](https://www.greyhound.com/bus-routes/savannah-ga-north-charleston-sc): "3 hr 0 mins" | this fix |

Greyhound and FlixBus concepts share the coach edges. Greyhound's figures are its fastest listed trip, and the Charleston figures are for North Charleston.

Effect: **761 of the 1,649 generated concept trips** get a new duration and arrival time (45 rail/LIRR, 358 Greyhound, 358 FlixBus). No leg endpoints change. The changes range from 245 minutes shorter (Boston/Portland → Albany by coach) to 75 minutes longer (coach trips from Charleston to Savannah or farther south). Examples: New York → Stony Brook 3h 0m → 1h 57m; Boston → Stony Brook by rail 7h 55m → 6h 52m; Boston → Albany by coach 7h 25m → 3h 20m; Portland → Miami by coach 33h 10m → 31h 30m. The routing dataset version is now `east-coast-2026-10-25-v2`.

To change an edge, edit `src/data/eastCoast.ts` (a `[there, back]` pair sets a different time for each direction), bump `ROUTING_DATASET_VERSION` in `src/data/tripLookup.ts`, and update the expected values in `src/data/eastCoast.test.ts`.

## Claims checked with no app change

- **Hartford → New York "one-seat ride"**: unsupported. QA38 found that the Valley Flyer runs only New Haven–Greenfield, and the Hartford Line PDF returned 404. The app never made this claim. It shows Hartford → New York as Hartford Line + Northeast Regional with a change at New Haven, and the rail map calls the Hartford Line a separate service. The research file's proposal to show it as one seat was not adopted.
- **Selma connections**: the app has no Selma stop, and the research file's "about 1.5–2 h plus the wait" via Selma was not adopted. QA38 found waits of 5 hours or more there: Raleigh 10:13 AM → Selma 10:48 AM, then the Palmetto 6:03 PM → Fayetteville 6:57 PM (about 8h 44m; about 6h 53m northbound), and Charlotte → Charleston about 15h 43m. The app's Raleigh–Fayetteville (8h 50m) and Charlotte–Charleston (15h 10m) rail concepts still go via Richmond. That is about as slow, except northbound Fayetteville → Raleigh, where Selma is about 2 hours faster.

## Still unverified or not changed

- **Amtrak Philadelphia → New York, 80 min and $45** (demo express leg): amtrak.com did not respond to QA38 (BLOCKED). Secondary sources give 75–90 min and dynamic fares from about $19 to more than $100.
- **Demo clock times**: the departure times (NJ TRANSIT 9:10 AM, LIRR 10:10 and 11:00 AM) and the 20-minute connections at Penn Station are illustrative, not specific trains. On the weekend timetables, NJ TRANSIT leaves Trenton at 8:16 and 9:17 AM, for example, and the LIRR trains that connect at Huntington for Stony Brook leave Penn about every 80–100 minutes (8:36, 9:57 and 11:35 AM). A real trip could wait longer at Penn than the sample shows.
- **Coach Fayetteville–Charleston (200 min), New York–Trenton (90) and Trenton–Philadelphia (50)**: Greyhound has no route page for these pairs (BLOCKED in QA38). They need a person to run a booking search.
- **Fayetteville–Savannah stops**: Greyhound's page lists no intermediate stops, so whether the bus skips Charleston is unverified.
- **Boston ↔ Albany by rail** still goes via New York (7h 30m), although QA38 found direct Lake Shore Limited Boston-section trains of about 4h 55m–5h 05m. This is a modelling change for a separate fix.
- **One-seat rides shown as transfers** (New York → Raleigh, Charlotte, Norfolk or Miami): modelling issue, not changed.
- **Coach edges with no source found**: Baltimore–Washington, Savannah–Jacksonville, Orlando–Fort Lauderdale, Fort Lauderdale–Miami, Boston–Hartford, Hartford–New Haven, New Haven–New York, Richmond–Norfolk, Raleigh–Charlotte. Bus fares are not modelled; those trips show "Check fares".
- **Older documents** (`docs/copy-humanize.md`, `docs/qa-checklist.md`, `docs/release-notes-rc3.md`) record the earlier values as they were at the time and were not rewritten.
