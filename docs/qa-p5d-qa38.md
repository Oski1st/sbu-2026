# P5D-QA38 — independent QA of #38 (Person 4 helper)

All results here are **automated** runs in installed Google Chrome 156.0.8078.47 via Playwright (headless), on local production builds (`node server/index.mjs`). No human, screen-reader or phone testing. Run date 2026-10-25 (UTC ≈06:15–06:45).

| Item | Value |
| --- | --- |
| Tested #38 head | `b1d7e5970037e49ed1d745a627fee221256a8454` (branch `fix/p5-search-date-bounds`) |
| Also built/tested | `49bb150266dec72a08f200ffa4ad8bd9fb3705ba` (previous #38 head; differs only in `IntegrationPage.tsx` notice text) |
| Baseline | #33 `4e415429e583792f90746ee8e4c055730e090fa4` |
| Ports | #38 on 127.0.0.1:4187, #33 on 127.0.0.1:4191 |

## Build checks (observed)

| SHA | frozen install | typecheck | build | tests |
| --- | --- | --- | --- | --- |
| #38 `b1d7e59` | exit 0 | exit 0 | exit 0 | 21 files, **110/110** |
| #38 `49bb150` | exit 0 | exit 0 | exit 0 | 21 files, **110/110** |
| #33 `4e41542` | exit 0 | exit 0 | exit 0 | 21 files, 107/107 |

Logs: `docs/qa/p5d-qa38/checks-*.txt`.

## 1. #38 fixes vs #33 (harness `qa/p5d-qa38-fixes.cjs`)

| # | Check | #33 | #38 `b1d7e59` | Result |
| --- | --- | --- | --- | --- |
| F1 | Typing `01/01/20270` is blocked ("Value must be 12/31/9999 or earlier") | accepted; URL `date=20270-01-01`, form shows 10/24/2026 (S2) | **not blocked**: year segment is capped at 4 digits, the 5th keystroke rolls the year to **0270**; URL `date=0270-01-01`, form 01/01/0270, no validation message, search runs | **FAIL** (see D1) |
| F2 | `?date=0050-06-01` keeps the year | shows 2026-10-24 | 0050-06-01 | PASS |
| F3 | No `/favicon.ico` 404 | P5 sweep: 1 console 404 | inline SVG `<link rel=icon>` declared; sweep: 0 console errors | PASS (note: `/favicon.ico` itself still 404s on the server; harmless now that an icon is declared) |
| F4 | SEPTA links go to `www.septa.org` | `wwww.septa.org/fares/` | `www.septa.org/fares/` (Journey + Wallet) | PASS |
| F5 | `/?from=Albany&to=Boston&sort=fastest` lists Amtrak (arr 3:30 PM) first | Greyhound (arr 3:55 PM) first | Amtrak, 8:00 AM → 3:30 PM, first | PASS |
| F6 | Demo comparison says "35 minutes sooner" | "65 minutes sooner" | "gets you there 35 minutes sooner for $15 more" | PASS |
| F7 | Wallet SEPTA panel never shows "999 min" (mocked TrainView `late: 999` and `'999'`) | "Reported delay: 999 min" ×2 | "Delay not reported" ×2; real `late: 4` → "Reported delay: 4 min" | PASS |
| F8 | Wallet header "5h 15m" (`/wallet/regional-connection`) | "315 minutes" | "4 travel legs · Demo itinerary · 5h 15m" | PASS |
| F9 | "booking. Sample" has its space | "booking.Sample" | "booking. Sample" | PASS |
| F10 | 320px comparison shows "Unavailable" on one line | 2 lines, 16px | 1 line, 14px, no dialog overflow | PASS |
| F11 | `/journey` (no trip) notice reads "Journey preview · Choose this route on Search…" | "…being built by our team." | "Journey preview · Choose this route on Search to open its full step-by-step journey." | PASS |

**#38: 10 PASS / 1 FAIL. #33 baseline: 1/11** (F3 is not discriminating in headless Chrome, which does not auto-request favicons; the P5 sweep is).

### D1 (new, medium) — typed 5-digit year silently becomes year 0270
Keystroke trace (`qa/p5d-qa38-year-probe.cjs`, three typing variants, all identical): `2→0002, 0→0020, 2→0202, 7→2027, 0→0270`. With `max="9999-12-31"` Chrome limits the year field to 4 digits and keeps shifting, so the user's intended 20270 becomes **0270-01-01**, which is valid (min 0001), is written to the URL and searched with no message. URL and form now agree (S2's mismatch is fixed), but the claimed "Value must be 12/31/9999 or earlier" message was **not observed**. P5's own sweep on #38 reports the same (`F typed 5-digit year: 0270-01-01`). Suggest a sane lower bound (e.g. `min` = today or 1900) or an explicit year check. Repro: `/?from=Boston&to=Miami` → click the month part of Date → type `01 01 20270` → Find my way → URL `date=0270-01-01`. Also present in RC1 #39. Needs a human to confirm in headed Chrome/Safari.

## P5 functional sweep (`docs/qa-device/scripts/p5-functional-sweep.mjs`, copied from `qa/p5-02-device`)

| | #38 `b1d7e59` | #33 |
| --- | --- | --- |
| Findings | 81: 63 PASS, 1 FAIL, 16 INFO, 1 CHECK | 81: 61 PASS, 3 FAIL, 16 INFO, 1 CHECK |
| A. city pairs | 552/552 return routes, 1,651 unique routes | same |
| B. Journey/Wallet pages | 3,302 checked; FAIL lists 8 near-empty (first Portland pages, cold lazy-load) | same 8 |
| D. URL dates (20) | 20/20 PASS incl. `0001-01-01` | 19/20 (`0001-01-01` FAIL) |
| F. 5-digit year typed | 0270-01-01 (D1) | 20270 → form 2026-10-24 (S2) |
| Z. console errors | **0** | 1 (404, favicon) |
| Runtime | 696 s | 694 s |

B: the 8 pages were re-checked with an 800 ms wait on #38 and all render (1,139–1,642 chars, correct h1) → harness artifact, as P5 found. Caveat: the script truncates its problem list at 8. Raw: `docs/qa/p5d-qa38/sweep-38/`, `sweep-33/`, `sweep-*.log`.

## 2. Official-source check of `p5-05-times-fares-evidence.md` (@`1be9cf0`)

Fetched 2026-10-25 06:20–06:30 UTC with plain `curl` (`qa/p5d-official-probe.sh`), WebFetch, or a normal headless Chrome page load for JS-rendered pages (`qa/p5d-official-render.cjs`, `qa/p5d-septa-fares-render.cjs`). No bot-protection bypass, no logins. Access: **mta.info** gives Akamai 403 to curl/Chrome, but WebFetch returned the two PDF documents; **amtrak.com** web pages: connection dropped (curl HTTP 000) / 45 s Chrome timeout, while `content.amtrak.com` timetable PDFs load; **njtransit.com**, **septa.org** (JS-rendered), **greyhound.com** load.

Values in rows marked † were read by this agent from timetable text extraction (column alignment). A person should spot-check them.

| Evidence row (P5 verdict) | App | Official URL | Value seen | Outcome |
| --- | --- | --- | --- | --- |
| LIRR NY–Stony Brook (WRONG, propose ~110) | 180 | https://www.mta.info/document/216881 (Port Jefferson Branch timetable, eff. Sep 8–Nov 8 2026) | † Weekend: Penn 5:38a → Huntington 6:50a, change (T), 7:01a → Stony Brook 7:37a = **119 min**; Penn 6:59a → 8:12a, 8:21a → 8:56a = **117 min** | **Corrected**: 180 is wrong, but the official time is ~117–119, not 110 |
| Huntington–Stony Brook (CHECK, ~40) | 50/55 | same | † Weekend 7:01→7:37, 8:21→8:56, 9:55→10:30 (35–36); weekday 7:02→7:43, 8:32→9:12, 9:23→10:00, 10:43→11:17 (34–41) | **Confirmed** (app overstated) |
| Huntington transfer wait (5–10) | 15/25 | same | † 6:50→7:01 (11), 8:12→8:21 (9) | **Confirmed** ~9–11 |
| Penn–Huntington (OK, 67–69) | 70 | same | † Weekend 72–73 min | Corrected slightly; app 70 is fine |
| LIRR fare Penn–Stony Brook (OK $16/$21.50) | $16 | https://www.mta.info/document/194866 "Station Fares – Effective January 4, 2026" | Zone 1→10: one-way peak **$21.50**, off-peak **$16.00**; Stony Brook = zone 10 (per 216881) | **Confirmed** |
| NJ TRANSIT fare Trenton–NY Penn ($20.35) | $20 | https://www.njtransit.com/adjustedfares ("Adjusted Fares (Effective July 1, 2026)") → https://content.njtransit.com/sites/default/files/marketing/website/pdf/Fares/New%20York%20Penn%20Station.pdf | Trenton zone 22, adult one-way **$20.35** (RT $40.70) | **Confirmed** |
| NJ TRANSIT Trenton–NY Penn time (80–95) | 90 | https://schedules.septa.org/current/TRE.pdf (NJT NEC times eff. Oct 11 2026) | Weekend 6:40→8:02 (82), 8:16→9:50 (94), 9:17→10:51 (94) | **Confirmed** |
| SEPTA fare Trenton–Center City (~$11) | $10 | https://www.septa.org/fares/ (Regional Rail tab) | NJ zone ↔ Center City, weekday and weekend: Key **$11.00**, Contactless N/A, Quick Trip $11.00, on-board $13.00 | **Confirmed** $11 (app $10 is low) |
| SEPTA 30th St–Trenton time (OK) | 55 | TRE.pdf (eff. July 5 2026) | Weekend Gray 30th St x:40 → Trenton x+1:32 = 52 min | **Confirmed** |
| M7 Trenton Line terminus (CHECK, weekend?) | — | TRE.pdf | Weekend/holiday trains run through Gray 30th St (to/from Jefferson; few to Temple); weekday trains end at Temple U | **Confirmed**: a Saturday demo via 30th St is valid |
| Richmond–Raleigh bus (WRONG, ~140) | 180 | https://www.greyhound.com/bus-routes/richmond-va-raleigh-nc | "Min. trip duration 2 hr 10 mins", 11 per day, from $28.48; reverse page: 2 h 30 | **Corrected**: fastest 130 (150 northbound); P5's "1h40" not seen |
| Charleston–Savannah bus (CHECK) | 115 | https://www.greyhound.com/bus-routes/north-charleston-sc-savannah-ga | Min 3 h 10, 1 per day, from $22.98 | **Confirmed** (app understated) |
| Fayetteville–Savannah bus (direct) | 315 via Charleston | https://www.greyhound.com/bus-routes/fayetteville-nc-savannah-ga | Min **4 h 25**, 2 per day, from $45.98 | **Corrected** 265 (P5 had 4 h 35). "Skips Charleston" is not shown on the page: **BLOCKED**, needs a person to open a dated schedule |
| Fayetteville–Charleston bus (CHECK) | 200 | greyhound.com/bus-routes/fayetteville-nc-charleston-sc | Redirects to the generic "Bus Routes Overview" (no route page) | **BLOCKED**: absence of a page ≠ no service; needs a person on the booking search |
| NY–Trenton, Trenton–Phila bus (CHECK) | 90 / 50 | greyhound.com/bus-routes/new-york-ny-trenton-nj, …/trenton-nj-philadelphia-pa | Both redirect to the generic overview | **BLOCKED**: same reason (it supports P5's concern but doesn't prove it) |
| M1 Boston–Albany direct | 7 h 30 via NY | https://content.amtrak.com/content/timetable/Lake%20Shore%20Limited.pdf (dated Sat Oct 24 2026); greyhound albany-ny-boston-ma / boston-ma-albany-ny | Rail 448: Albany 3:27p → Boston South Sta 8:32p (**5 h 05**); 1448: 3:05p → 8:00p (4 h 55); 449/1449 Boston 12:50p, Albany time shown 7:05p. Bus: Albany→Boston min **3 h 40** (4 per day, $33.48); Boston→Albany min **3 h 20** (5 per day, $32.48) | **Confirmed** (direct services exist). Bus corrected: 3 h 20–3 h 40, not 3 h 10. amtrak.com route page **BLOCKED** (timeout) |
| M2 Raleigh–Fayetteville rail | 8 h 50 via Richmond | Carolinian.pdf, Palmetto.pdf (content.amtrak.com, dated Sun Oct 25 2026) | Carolinian 80 Raleigh 10:13a → Selma 10:48a, then Palmetto 89 Selma 6:03p → Fayetteville 6:57p (≈8 h 44). Northbound: Palmetto 90 Fay 12:22p → Selma 1:11p, Carolinian 79 Selma 6:27p → Raleigh 7:15p (≈6 h 53) | **Corrected**: the Selma connection exists but the waits are 5 h+; P5's "1.5–2 h plus the wait" understates. Bus 65 min not re-checked |
| M3 Charlotte–Charleston rail | 15 h 10 via Richmond | same | Carolinian 80 Charlotte 6:45a → Selma 10:48a; Palmetto 89 Selma 6:03p → Charleston 10:28p = **15 h 43** | **Corrected**: the route via Richmond is wrong, but the real Selma path is not faster |
| M4 one-seat rides | split | Carolinian.pdf, Silver%20Meteor.pdf, Valley%20Flyer.pdf | Carolinian 80/79: one train Charlotte↔NY (13 h 50 / 15 h 41). Silver Meteor 97: NY 2:30p → Miami 6:59p next day, one train (28 h 29), no Selma stop. Valley Flyer: New Haven–Greenfield only | **Confirmed** for Carolinian and Silver Meteor. Hartford–NY one-seat **not supported** by these PDFs (Hartford Line PDF 404). NY–Norfolk **not checked** |
| Rail segments spot-check | 230 / 190 / 105 | Carolinian / Palmetto / Silver Meteor PDFs | Raleigh→Richmond 231; Charleston→Fayetteville 187; Savannah→Charleston 100 (Palmetto) / 109 (Meteor) | **Confirmed** |
| Amtrak NER PHL–NY fare (range) | $45 | https://www.amtrak.com/ | curl: no response (HTTP 000); Chrome: 45 s timeout | **BLOCKED**: needs a person (dynamic fare search) |

Totals by row: **12 confirmed, 6 corrected, 3 BLOCKED** (Fayetteville–Charleston bus, NY–Trenton/Trenton–Phila bus, Amtrak NER fare). Some rows also contain a sub-claim that was corrected or BLOCKED: the M1 bus time (corrected) and amtrak.com route page (BLOCKED); M4 Hartford (unsupported) and NY–Norfolk (not checked); Fayetteville–Savannah stops (BLOCKED). Bus fares (section D) were not re-checked. Text extracts: `docs/qa/p5d-qa38/official/`. The PDFs are not committed (third-party copyright); the URLs above are re-fetchable.

Side note: `wwww.septa.org` resolves (HTTP 200) and SEPTA's own pages emit `wwww.` links. The #38 change to `www.` is still the canonical choice.

## 3. Button-audit regression on #38 (`qa/p5d-qa38-regression.cjs`)

Identical outcome on #38 and #33: **16 known findings REPRODUCE, 7 general checks PASS, 0 regressions.**

| Finding (owner) | #38 observed |
| --- | --- |
| J2 delay always warns (P2) | REPRODUCES: 60-min transfer, +12 delay → "Your connection may no longer be comfortable." |
| J3 delayed arrival alignment, 320px (P2) | REPRODUCES: delayed times `align-items:flex-end` (left 191/152px vs depart 63px) |
| W3 no Wallet → Journey link (P2) | REPRODUCES: no `/journey/…` link in Wallet main |
| F8 long coach leg (P2) | REPRODUCES: Portland→Miami coach 33 h 10 m as one leg |
| S4 transfer prompt without date (P2) | REPRODUCES: "Next: Silver Meteor corridor · sample toward Miami at 4:05 PM." while the timeline shows Oct 25 |
| F1 demo focus lost (P2) | REPRODUCES: after 4 × Enter on Next, Next is disabled and focus is on `<body>` |
| F6 single-leg delay silent (P2) | REPRODUCES: +12 badge, delay live region empty |
| Detours (P3) | REPRODUCES: Raleigh→Fayetteville 8 h 50 via Richmond; Charlotte→Charleston 15 h 10 via Richmond; Boston↔Albany 7 h 30 via New York |
| One-seat rides as transfers (P3) | REPRODUCES: NY→Raleigh = NER + Silver Meteor + Carolinian; NY→Miami = NER + Silver Meteor; NY→Norfolk, Hartford→NY split |
| Segment times (P3) | REPRODUCES: NY→Stony Brook 3 h 0 m; Richmond→Raleigh bus 180 min; demo Huntington→Stony Brook 50 |
| Fares (P3) | REPRODUCES: demo $10/$20/$16 sample fares, no "as of" ranges |
| Contrast (P3) | REPRODUCES: results disclaimer 3.20:1 (9px), "REAL OPERATORS…" 3.11:1 (8px); the other three labels were not located by this probe |
| Header nav loses trip / filter count not announced / third Compare tick / "Let's go somewhere" name (P3) | all REPRODUCE |
| General: header nav, compare dialog open + Esc, copy link (clipboard `/journey/regional-connection`), mode filters (3/1/2/3), SEPTA 500/empty/bad-shape states, Back to same search, sweep-8 pages | all PASS |

## 4. P2/P3 frozen heads
At 06:40 UTC the hub threads (#1, #4) had no `DONE — Person 3 — P5D-DATA33` or `DONE — Person 2 — P5D-JOURNEY33`, and there was no open app PR for them. Nothing to retest.

## Defects / actions
1. **D1** (#38 and RC1): a typed 5-digit year becomes 0270 silently (above). Owner: Person 5.
2. The official-source corrections above go to Person 3 (P5D-DATA33): NY–Stony Brook ≈117–119 (not 110); Richmond→Raleigh bus 130; Fayetteville–Savannah 265; Albany↔Boston bus 200–220; the Selma connections are slow (don't assume ~2 h); the Hartford one-seat claim is unsupported.
3. BLOCKED rows need a person: amtrak.com NER fare; Greyhound Fayetteville–Charleston, NY–Trenton, Trenton–Phila; Fayetteville–Savannah intermediate stops.
