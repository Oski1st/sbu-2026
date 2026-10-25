# OneLine sample data: travel time and fare evidence (checked 2026-10-25)

Scope: src/data/eastCoast.ts, src/data/originalDemoTrips.ts, src/data/agencies.ts (read-only).
Method: WebSearch only. WebFetch was denied for every domain tried (amtrak.com, mta.info, njtransit.com, septa.org, wikipedia, juckins.net, railpassengers.org), so official PDFs were read only through search-engine snippets and summaries. "Official" means the figure came from an operator domain (amtrak.com, mta.info, greyhound.com, septa.org, portal.ct.gov). "Secondary" means an aggregator, timetable mirror, or press. "Unverified" means I found no source this session; the range given is a drive-time or general estimate and should not be treated as evidence.
% diff = (app - verified midpoint) / verified midpoint. Verdict: OK <=25%, CHECK 25-40%, WRONG >40% or the route doesn't exist as modelled.

## A. Rail edges (eastCoast.ts)

| Segment | App min | Verified typical | Source | % diff | Verdict |
|---|---|---|---|---|---|
| Downeaster Portland-Boston | 150 | 145-150 | BDN Sept/Dec 2024 schedule reports (secondary) https://archive.bdnblogs.com/?p=114860 | +2% | OK |
| NER Boston-Providence | 40 | ~40-50 (Acela ~35) | Boston-NY total check below; segment not isolated (secondary) | ~-11% | OK |
| NER Providence-New Haven | 95 | ~95-105 | as above | ~-5% | OK |
| NER New Haven-NY Penn | 100 | ~100-115 | as above | ~-7% | OK |
| (sum) Boston-NY on NER | 235 | 250-265 (4h10-4h25; Wanderu avg 4h18) | https://ammtrain.com/routes/northeast-regional/schedule.php, https://www.wanderu.com/en-us/train/us-ma/boston/us-ny/new-york/ (secondary) | -9% | OK |
| NER NY-Trenton | 55 | ~57 | https://www.rome2rio.com/s/Trenton-Transit-Center/Manhattan (secondary) | -4% | OK |
| NER Trenton-Philadelphia | 30 | 25-27 | https://www.wanderu.com/en-us/train/us-pa/philadelphia/us-nj/trenton/ (secondary) | +15% | OK |
| NER Philadelphia-Baltimore | 65 | 73-86 (NER 1h15-1h26; avg 1h13) | https://www.omio.com/trains/philadelphia-pa/baltimore-md (secondary) | -17% | OK (low end) |
| NER Baltimore-Washington | 40 | 47-48 | Amtrak NER timetable PDF via search snippet (official) https://content.amtrak.com/content/timetable/Northeast%20Regional.pdf | -16% | OK |
| Hartford Line Hartford-New Haven | 45 | 34-50 | portal.ct.gov / neal.house.gov 2018 launch (official, ~34 min); 2024 rider report 50 min (secondary) | +7% | OK |
| Empire Service Albany-NY | 155 | 149-151 (2h29-2h31) | https://travelupdate.com/review-amtrak-empire-service-from-new-york-penn-to-albany/, https://www.rome2rio.com/s/Albany-Rensselaer/Manhattan (secondary) | +3% | OK |
| Silver Meteor Washington-Richmond | 130 | ~135 (dep 19:24, Richmond SM arr 21:39) | https://www.ncbytrain.org/schedules/silver-meteor, https://travelswithkev.com/amtrak-silver-meteor-schedule/ (secondary, from Amtrak timetable) | -4% | OK |
| Silver Meteor Richmond-Fayetteville | 240 | ~208 (21:49 -> 01:17) | same | +15% | OK |
| Silver Meteor Fayetteville-Charleston | 190 | ~201 (01:27 -> 04:48) | same | -5% | OK |
| Silver Meteor Charleston-Savannah | 105 | ~107 (04:56 -> 06:43) | same + railpassengers.org 2026-03 timetable (secondary) | -2% | OK |
| Silver Meteor Savannah-Jacksonville | 155 | 155-180 (06:49 -> 09:24/09:49 arr) | same | -7% | OK |
| Silver Meteor Jacksonville-Orlando | 190 | ~195-215 (Jax 09:24-09:49 -> Orlando ~13:04) | same | -6% | OK |
| Silver Meteor Orlando-Fort Lauderdale | 260 | ~287 (13:19 -> 18:06) | https://www.ncbytrain.org/schedules/silver-meteor (secondary) | -9% | OK |
| Silver Meteor Fort Lauderdale-Miami | 45 | ~53 (18:06 -> 18:59) | same | -15% | OK |
| Carolinian Richmond-Raleigh | 230 | ~238 (Raleigh 10:13 -> Richmond SM 14:11) | Amtrak Carolinian timetable PDF via snippet (official) https://content.amtrak.com/content/timetable/Carolinian.pdf; RPA factsheet 2025 | -3% | OK |
| Carolinian Raleigh-Charlotte | 190 | 180-210 | same; https://amtrakguide.com/routes/carolinian/ (secondary) | -1% | OK |
| NER Richmond-Norfolk | 140 | ~105-160 (fastest 2h16 from "Richmond"; Main St is shorter) | https://www.wanderu.com/en-us/train/us-va/richmond/us-va/norfolk/ (secondary). Low confidence | ~+5% | OK (low confidence) |
| "Florida rail corridor" Orlando-Tampa | 120 | 105-128 (~2h; Silver Star) | https://amtrakguide.com/stations/tampa-amtrak-station/, https://www.rome2rio.com/Train/Tampa/Orlando (secondary) | +3% | OK, but label the service as Silver Star |
| LIRR New York-Stony Brook | 180 | 105-120 (about 1h50 incl. Huntington change; Penn-Huntington ~67-69 + ~37) | MTA Port Jefferson timetable eff. 2026-09-08 (official, it mentions the Huntington transfer); https://www.rome2rio.com/s/Manhattan/Stony-Brook-Station-LIRR; 2013 MTA itinerary 2:52->4:43 (secondary); stonybrook.edu "approximately two hours" (official, older page) | +50-70% | WRONG |

## B. Bus edges (eastCoast.ts, used for both Greyhound and FlixBus)

| Segment | App min | Verified typical | Source | % diff | Verdict |
|---|---|---|---|---|---|
| Portland-Boston | 135 | 110-130 (Concord Coach 1h50-2h10; Greyhound 1/day) | https://www.rome2rio.com/Bus/Portland-ME-USA/Boston, https://www.wanderu.com/en-us/bus/us-me/portland/us-ma/boston/ (secondary) | +13% | OK (mainly Concord Coach, not GH/Flix) |
| Boston-Providence | 65 | 60-65 | https://www.greyhound.com/bus-routes/boston-ma-providence-ri (official) | +4% | OK |
| Providence-New York | 210 | 190-215 (GH fastest 3h35; any-carrier fastest 3h10) | https://www.greyhound.com/bus-routes/providence-ri-new-york-ny (official), Wanderu (secondary) | +4% | OK |
| (sum) Boston-NY | 275 | 205-260 (GH fastest 3h25; FlixBus 4h20 hourly) | https://www.greyhound.com/bus-routes/boston-ma-new-york-ny (official); rome2rio FlixBus (secondary) | +18% | OK |
| New York-Trenton | 90 | unverified; Trenton isn't a typical GH/Flix NY-Phila stop | none found | n/a | CHECK (modelling) |
| Trenton-Philadelphia | 50 | unverified | none found | n/a | CHECK (modelling) |
| Philadelphia-Baltimore | 115 | 65-115 (GH fastest 1h05; reverse 1h55; Wanderu avg 2h34) | https://www.greyhound.com/bus-routes/philadelphia-pa-baltimore-md (official) | +27% vs mid 90 | OK-CHECK (within range) |
| Baltimore-Washington | 60 | ~60-75 (unverified) | none found | n/a | unverified |
| Washington-Richmond | 130 | ~110-140 (GH fastest 1h50) | https://www.greyhound.com/bus-routes/richmond-va-washington-dc (official) | +4% vs 125 | OK |
| Richmond-Raleigh | 180 | 100-150 (GH fastest 1h40 / 2h10) | https://www.greyhound.com/bus-routes/richmond-va-raleigh-nc (official) | +44% vs 125 | WRONG (overstated) |
| Raleigh-Fayetteville | 80 | 65-75 (GH fastest 1h05, 5/day) | https://www.greyhound.com/bus-routes/raleigh-nc-fayetteville-nc (official) | +14% | OK |
| Fayetteville-Charleston | 200 | no direct service found; GH Fayetteville-Savannah runs I-95 direct in 4h35, skipping Charleston | https://www.greyhound.com/bus-routes/fayetteville-nc-savannah-ga (official) | n/a | CHECK (wrong intermediate city) |
| Charleston-Savannah | 115 | ~190 (GH from North Charleston, fastest 3h10) | https://www.greyhound.com/bus-routes/north-charleston-sc-savannah-ga (official) | -39% | CHECK |
| (sum) Fayetteville-Savannah | 315 | 275 (fastest) | Greyhound (official) | +15% | OK |
| Savannah-Jacksonville | 145 | ~135-160 (unverified) | none reliable found | n/a | unverified |
| Jacksonville-Orlando | 155 | ~150 (GH fastest 2h30; Omio avg 2h30, 9/day) | https://www.greyhound.com/bus-routes/jacksonville-fl-orlando-fl (official) | +3% | OK |
| Orlando-Fort Lauderdale | 205 | ~210-240 (unverified) | none found | n/a | unverified |
| Fort Lauderdale-Miami | 55 | ~40-60 (unverified) | none found | n/a | unverified |
| Boston-Hartford | 120 | ~110-130 (unverified) | none found | n/a | unverified |
| Hartford-New Haven | 55 | ~45-60 (unverified) | none found | n/a | unverified |
| New Haven-New York | 110 | ~110-130 (unverified) | none found | n/a | unverified |
| Albany-New York | 170 | 155-180 (GH fastest 2h35, 10/day) | https://www.greyhound.com/bus-routes/albany-ny-new-york-ny (official) | +10% | OK |
| Richmond-Norfolk | 120 | ~100-130 (unverified) | none found | n/a | unverified |
| Raleigh-Charlotte | 180 | ~165-200 (unverified) | none found | n/a | unverified |
| Orlando-Tampa | 110 | 95-100 (FlixBus 1h40; avg 1h35, 16/day; one GH run 3h05) | https://www.omio.com/buses/tampa-fl-dhtdr (secondary) | +13% | OK |

## C. Demo trips Philadelphia -> Stony Brook (originalDemoTrips.ts). Sample date 2026-10-24 is a Saturday.

| Leg | App | Verified typical | Source | % diff | Verdict |
|---|---|---|---|---|---|
| SEPTA 30th St-Trenton time | 55 min | ~50-60 | SEPTA TRE timetable eff. 2026-07-05 (official, via snippet; run time not isolated); general | ~0% | OK, but see modelling note M7 |
| SEPTA fare Trenton-Center City | $10 | ~$11 (NJ zone); SEPTA lists Regional Rail $5.00-$13.00 | https://septa.bostonlines.com/fares/ (secondary); https://www.septa.org/schedules/TRE (official range) | -9% | OK |
| NJ TRANSIT Trenton-NY Penn time | 90 min | 80-95 | https://www.rome2rio.com/s/Trenton-Transit-Center/Manhattan (secondary, 1h34) | +3% | OK |
| NJ TRANSIT fare Trenton-NY Penn | $20 | $20.35 one-way (fares adjusted 2026-07-01; NJT has no peak/off-peak) | https://thesunpapers.com/lifestyle/nj-transit-fare/, https://www.thepricer.org/how-much-does-nj-transit-cost/ (secondary); https://www.njtransit.com/adjustedfares (official page exists, figure not read) | -2% | OK |
| NJT->LIRR transfer at Penn | 20 min | ok (same station) | n/a | | OK |
| LIRR Penn-Huntington | 70 min | 67-69 | rome2rio (secondary); 2013 MTA itinerary 67 min | +3% | OK |
| Huntington transfer wait | 15 / 25 min | usually 5-10 min, same platform, timed connections | Huntington station article via search (secondary) | | OK-ish, slightly generous |
| LIRR Huntington-Stony Brook | 50 / 55 min | ~37-40 | 2013 MTA itinerary 4:06->4:43 (secondary) | +30-40% | CHECK |
| LIRR fare Penn-Stony Brook (Zone 1->10) | $16 | off-peak $16.00, peak $21.50 (fare chart eff. 2026-01-04) | https://www.mta.info/document/194866 (official, via snippet); SBU travel PDF https://indico.cfnssbu.physics.sunysb.edu/event/604/attachments/987/1787/Travel.pdf | 0% (off-peak) | OK (Saturday = off-peak; $0 continuation leg is correct since one ticket covers the change) |
| Amtrak NER PHL-NY Penn time | 80 min | 75-90 (Wanderu avg ~1h30) | Wanderu (secondary) | -3% | OK |
| Amtrak NER fare PHL-NY | $45 | about $19 (lowest advance Value) to $100+ walk-up; Wanderu NER avg ~$96 | https://inquirer.com/business/amtrak-ticket-price-low-cost-20231026.html (secondary, 2023 tier launch); Wanderu (secondary) | within range | OK (show it as a range) |
| Trip 1 total | 315 min / $46 | ~285-320 min / ~$47.35 off-peak ($52.85 peak) | sums of the above | ~+5% / -3% | OK |
| Trip 2 total | 250 min / $61 | ~200-240 min / ~$35-$120 | sums of the above | +10-20% / n/a | OK, fare should be a range |

## D. Bus fare reference (the app doesn't model bus fares)
- Boston-NY bus: from $13 (Wanderu, 6 carriers); FlixBus $30-75 (rome2rio); Greyhound route page exists (https://www.greyhound.com/bus-routes/boston-ma-new-york-ny). Typical $20-60. Secondary, dynamic.
- Portland-Boston: Concord $23-35; Greyhound from $17 (secondary).

## E. Modelling errors
- M1 Boston-Albany is routed via NYC (rail 235+155+transfer = about 7.5h; the bus graph also goes via NYC). There is a direct one-seat Lake Shore Limited Boston section, 5h05-5h20 (Boston 12:50 -> Albany 18:10; Albany 15:27 -> Boston 20:32), https://railpace.com/lake-shore-limited-train-service-resumes-between-albany-and-boston/ (secondary). There is also a direct Greyhound Albany-Boston bus in 3h10-3h40, https://www.greyhound.com/bus-routes/albany-ny-boston-ma (official). WRONG.
- M2 Raleigh-Fayetteville rail goes via Richmond (230+240 = 470 min plus a transfer). Real option: Carolinian Raleigh->Selma, then Palmetto Selma->Fayetteville (the Silver Meteor doesn't stop at Selma), about 1.5-2h plus the wait. Better still, use the bus (Greyhound, 65 min). WRONG.
- M3 Charlotte-Charleston rail goes via Raleigh-Richmond-Fayetteville (850 min plus transfers). There's no direct train. Realistic options are Carolinian to Selma plus Palmetto, or a bus. WRONG.
- M4 One-seat rides are shown as transfers, because WAS-Richmond is tagged "Silver Meteor corridor" while the Carolinian and NER are separate lines. NY-Raleigh/Charlotte is one-seat on the Carolinian, but the app shows NER, Silver Meteor, then Carolinian, with two 60-min connections. NY-Norfolk is one-seat on the NER, but the app shows NER, Silver Meteor, then NER. NY-Miami is one-seat on the Silver Meteor (dep NY ~14:30), but the app shows NER then Silver Meteor. Hartford-NY has one-seat Amtrak Hartford Line/Valley Flyer trips, but the app shows a transfer at New Haven. WRONG (structure).
- M5 NY-Stony Brook is 180 min in the graph, but it's actually about 1h50 including the Huntington change. WRONG.
- M6 Orlando-Tampa is labelled "Florida rail corridor". The real service is the Amtrak Silver Star, which isn't a separate corridor. Brightline Orlando-Miami (~3.5h) is not modelled. Minor.
- M7 SEPTA Trenton Line: as of 2026, most weekday trains terminate at Temple University and don't run through to 30th Street. Earlier plans to eliminate the line in Jan 2026 seem not to have happened (Wikipedia via search; SEPTA TRE page). The demo is on a Saturday, so confirm the weekend pattern. CHECK.
- M8 Bus graph: Trenton isn't a normal intercity coach stop between NY and Philadelphia. The Fayetteville-Charleston-Savannah bus path doesn't match Greyhound's I-95 routing, which skips Charleston (Greyhound serves North Charleston). Portland-Boston is mostly Concord Coach. CHECK.
- M9 Bus legs carry a fixed head-start offset (Greyhound +30, FlixBus +60). That's cosmetic only.

## F. Purchase URLs (agencies.ts)
I couldn't load any of them (fetch blocked). Assessment from search results:
- https://www.septa.org/fares/ is an info page, not a purchase page (SEPTA sells via Key card / contactless / app). Fine as a link, but "purchase" overstates it.
- https://www.njtransit.com/tickets/train-tickets is unverified. NJT sells mainly via the NJ TRANSIT Mobile App and ticket machines.
- https://www.mta.info/traintime is the TrainTime app (buys LIRR mobile tickets). Plausible, unverified.
- amtrak.com, greyhound.com, flixbus.com are the root booking sites. OK.

## G. Proposed corrected sample values
Rail minutes: NY-Stony Brook 180 -> 110 (MTA Port Jefferson timetable; Penn-Huntington ~68 + change + ~37). Philadelphia-Baltimore 65 -> 75 (Omio). Baltimore-Washington 40 -> 45 (Amtrak NER PDF). Boston-Providence 40 -> 45. New Haven-NY 100 -> 105 (gives Boston-NY ~245). Richmond-Fayetteville 240 -> 210, Orlando-Fort Lauderdale 260 -> 285, Fort Lauderdale-Miami 45 -> 55 (Silver Meteor timetable via ncbytrain / travelswithkev). Add Boston-Albany rail 305 (Lake Shore Limited Boston section). Add Raleigh-Fayetteville as a bus-only edge, or a Selma connection node, to remove the Richmond detours. Merge the WAS-Richmond edge into each through service (Carolinian, NER-Norfolk, Silver Meteor from NY) so one-seat rides aren't split.
Bus minutes: Richmond-Raleigh 180 -> 140 (Greyhound). Charleston-Savannah 115 -> 150-190 (Greyhound from North Charleston, 3h10 fastest). Or replace the Fayetteville-Charleston-Savannah chain with Fayetteville-Savannah 275 (Greyhound) plus a Charleston spur. Add Albany-Boston bus 200 (Greyhound 3h10-3h40). Drop or flag the Trenton intermediate on the bus corridor.
Demo legs: Huntington-Stony Brook 50/55 -> 40, with a Huntington wait of 5-10 min. Trip 1 total ~300 min, trip 2 total ~220 min.
Fares, shown as ranges with an "as of" date: SEPTA Trenton-Center City $11 (NJ zone; SEPTA range $5-13). NJT Trenton-NY Penn $20.35 (fixed, eff. 2026-07-01). LIRR Penn-Stony Brook $16.00 off-peak / $21.50 peak (eff. 2026-01-04). Amtrak NER PHL-NY $19-$100+ (dynamic; display "from ~$19"). Boston-NY bus $15-$75 (dynamic).
Labelling: keep fare.status "sample". Show fares as "from $X" or "$X-$Y" ranges with the "as of 2026-10-25" date. The demo-trip card, the trip detail fare total, and samplePlanningNote should all state "illustrative sample times and fares, not timetables or quotes; dynamic fares (Amtrak, Greyhound, FlixBus) vary by date". Any line names ending "· sample" should keep that suffix.
