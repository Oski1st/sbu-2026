# P5-06 — 3-minute demo script and presenter notes (RC1 #39)

Person 5 · docs only.

| Item | Value |
| --- | --- |
| App build demoed | **RC1** PR #39 `feat/release-candidate-1` at **`2d0b5ef7fa8bce374adaa72abf6bd522c097772b`** (base #36 `37fdcce…`). Open draft, **not deployed** |
| How it was served | Isolated checkout → `pnpm install --frozen-lockfile` → `pnpm build` → `HOST=127.0.0.1 PORT=5180 node server/index.mjs` (the production Node server, with the real SEPTA proxy) |
| Checks at SHA | typecheck exit 0 · build exit 0 · tests **22 files / 116 passed** · `pnpm test:proxy` **5/5 PASS** (HTTP 500, network failure and non-array JSON give 502; stall gives 504; empty feed gives 200 `[]`; all `no-store`) |
| Browser check | Every step below was clicked through in Google Chrome 156.0.8078.47 (installed, Playwright-driven) at 1440×900 on macOS 26.6. **8/8 steps PASS**, no page or console errors. Click-through: `p5-06/verify-demo.mjs`; results: `p5-06/demo-steps-rc1-2d0b5ef.json` |
| Screenshots | `docs/demo/p5-06/01-…10-*.png` (local app only; no personal data) |

**Before you start:** serve RC1 locally as above, open `http://127.0.0.1:<port>/` in a **desktop-width** window (≥1280px wide, 100% zoom), and close other tabs. Don't present the Render URL; it is not this build and it cold-starts.

## The 3-minute script

Spoken lines total **219 words**, about 1:30 at ~150 wpm. The rest of each slot is clicking and letting the screen land, so the full run fits in 3:00. Timings are cumulative.

### 1 · Landing — 0:00–0:20
- **Click:** nothing. Start on `/`.
- **Expected screen:** "Different lines. Same direction." with the rail map on the right (`01-landing.png`).
- **Say:** "Getting from Philadelphia to Stony Brook means four operators, four websites and four sets of tickets. OneLine puts the whole trip in one place: one search, one journey, one wallet."

### 2 · Search with autocomplete — 0:20–0:50
- **Click:** **From**, select all, type `phil`, press **↓**, press **Enter**. Then **To**, type `stony`, and **click** "Stony Brook". In **Date**, click the month and type `11152026`. Click **Find my way**.
- **Expected screen:** the suggestion list while typing (`02-autocomplete.png`), then **2 sample connections**: the scenic SEPTA + NJ TRANSIT + LIRR route and the express Amtrak + LIRR route. The URL ends `?date=2026-11-15` (`03-results.png`).
- **Say:** "Autocomplete works with the keyboard or the mouse, and it only offers cities in our 24-city sample catalogue. The date is saved in the share link. It's a planning preference: these are sample itineraries, not a live timetable."

### 3 · Rail map — 0:50–1:20
- **Click:** scroll up to **Follow the rails.** Click **Corridors, cities & coverage gaps**, point at the list, then click it again to close.
- **Expected screen:** a north-up map of the contiguous US with 8 Amtrak corridors and labelled cities from Boston to Miami (`04-rail-map.png`). The opened panel lists the corridors with official sources, all 24 cities and "What is missing" (`05-map-coverage.png`).
- **Say:** "The lines are real Amtrak alignments from the federal NTAD dataset, bundled offline. We're honest about gaps: Stony Brook's LIRR line isn't mapped yet, and every corridor links to its official source."

### 4 · Compare — 1:20–1:50
- **Click:** scroll back to the results. Click **Compare two options**.
- **Expected screen:** the dialog headline **"The express connection gets you there 35 minutes sooner for $15 more in sample fares."** It shows $46 vs $61, 3 vs 2 transfers, arrival 1:15 PM vs 12:40 PM (`06-compare.png`).
- **Say:** "Compare puts the trade-offs side by side: arrival time, sample fare, transfers, time on board, and the tightest connection. The express gets you there 35 minutes sooner for fifteen dollars more."

### 5 · Journey with a simulated delay — 1:50–2:25
- **Click:** in the dialog, **Choose route** under **Scenic Connection**. On the Journey page, click **Start demo journey**, then **Next step**. Scroll to **Simulate a delay** and click **Simulate delay**.
- **Expected screen:** "Philadelphia → Stony Brook · 5h 15m total · 4 segments" with SEPTA, NJ TRANSIT and LIRR badges, and "Step 2 of 7 · Current step: transfer at Trenton Transit Center…" (`07-journey.png`). After the delay: "Add 12 minutes to Trenton Line", "Simulated delay: +12 min" and "Your connection may no longer be comfortable." (`08-delay.png`).
- **Say:** "Journey walks you through each leg and transfer. If your SEPTA train runs twelve minutes late, OneLine flags that your Trenton connection is at risk and tells you what to check. It's a demo scenario, never a live alert."

### 6 · Wallet with the SEPTA panel — 2:25–2:55
- **Click:** scroll up and click **View ticket wallet**. Scroll to **SEPTA service snapshot**.
- **Expected screen:** "4 travel legs · Demo itinerary · 5h 15m", one card per operator with its official ticket link, then the live panel: "SEPTA observations retrieved. This snapshot expires after 60 seconds." plus real trains and "Reported delay: 3 min" / "Delay not reported" (`09-wallet-septa.png`; trains vary).
- **Say:** "The wallet gathers every ticket link in one place. You still buy from each agency; we never sell tickets. And this panel is live SEPTA Regional Rail data through our own proxy, clearly labelled as agency-wide, not matched to your train."

### Close — 2:55–3:00
- **Say:** "One search, one journey, one wallet. Thank you."

## 60-second backup: if the SEPTA feed is down

Verified on `2d0b5ef` by forcing the proxy to return 502, and an empty feed (`10-backup-outage-502.png`, `10-backup-empty-200.png`). `pnpm test:proxy` shows the server returns these states for real upstream failures and timeouts.

1. **0:00–0:15.** If the panel says **"SEPTA observations unavailable. Try Refresh feed or check SEPTA directly."**, click **Refresh feed** once. Don't keep retrying.
2. **0:15–0:40.** If it's still unavailable, **say:** "This is our real failure state. When SEPTA's feed is down, OneLine says so plainly and never invents trains. The itinerary stays clearly simulated, and it points you to SEPTA directly."
3. **0:40–1:00.** Scroll up to the per-leg cards and point at the official links (SEPTA, NJ TRANSIT, MTA TrainTime): "Every leg still links to the agency that sells the ticket."

If the feed returns **"The feed returned no active trains. This does not confirm that service has stopped."**, use the same lines. If the laptop is offline altogether, the rest of the demo still works: city data and map geometry are bundled.

## What not to click · known limits on RC1

| Avoid | Why | Status |
| --- | --- | --- |
| Narrow windows (<400px) or a phone | **F2:** around 375px the date year is clipped. **F1:** the Search field focus line is faint (2.3:1) | Known; Person 3 |
| Claiming the date changes the trip | Itinerary times always start 8:00 AM on Oct 24. The date is a saved preference only (dated timetables, #37, are not in RC1) | Disclosed in the UI |
| Non-demo city pairs when talking about prices | Only the Philadelphia→Stony Brook demo has sample fares; other routes say "Check fares with the operator" | Product gap; Person 3 adding sourced ranges |
| Raleigh→Fayetteville, Charlotte→Charleston, Boston↔Albany, New York→Stony Brook | Sample rail routes detour (e.g. Raleigh→Fayetteville 8h 50m via Richmond); NY–Stony Brook is 180 min vs ~110 published | Person 3 (P5D-DATA33) |
| Simulate delay on long-transfer routes | It always warns, even with plenty of slack. On the demo route the warning is genuinely right | Person 2 (P5D-JOURNEY33) |
| Keyboard-only through the final demo step | Focus drops to the page when Next disables at the last step. Use the mouse for steps | Person 2 |
| Header **Journey/Wallet** after opening a shared Journey link | Can land on the empty "/journey" page. Navigate with the in-page buttons | Person 3 |
| Opening `/journey` directly | Shows an old "being built by our team" notice; the fix in #38 `b1d7e59` isn't in RC1 | Fixed on #38, not in RC1 |
| The map's Floridian line | Drawn only to western Pennsylvania though the route runs to Chicago; 7 source links don't announce "new tab" | Person 2 |
| "It's live on Render" | RC1 is a local build; the Render site's identity is unverified | Never claim deployment |

Human checks (real phone, VoiceOver, real 200% zoom) are still pending in P5D-HUMAN33; don't claim them.

## Five likely judge questions

1. **"Where does the data come from?"** Itineraries, times and fares are illustrative sample data. We checked them against published sources: 22 of 23 rail segments are within 25% of published times, and the demo's LIRR $16 matches the off-peak fare. Map lines come from the federal FRA/BTS NTAD Amtrak dataset; state outlines from Natural Earth (both public domain, bundled offline). The only live data is SEPTA's TrainView feed.
2. **"Which operators are real, and what's sample?"** All operators are real (SEPTA, NJ TRANSIT, Amtrak, LIRR, Greyhound, FlixBus) and every link goes to their official site. Schedules and fares are samples. Greyhound and FlixBus concepts share one sample network. We don't sell or issue tickets.
3. **"Is it accessible?"** Keyboard-first: an ARIA combobox for autocomplete, live result announcements, a skip link, visible focus, collapsed details kept out of the tab order, and reduced-motion support. Known gaps are disclosed: the search-field focus line contrast and narrow-screen date clipping are being fixed. Real VoiceOver and phone sessions are in progress with a human tester.
4. **"Does picking a date or time change the results?"** Not yet. It's saved in the share link as a planning preference, and the UI says so. Dated timetables are the next integration (PR #37) and are not in this candidate.
5. **"What happens if SEPTA's API fails?"** Our own server proxies one fixed SEPTA endpoint with no keys or cookies forwarded, a 1 MiB cap and a 4.5 s timeout. Failures return 502/504 with `no-store`, and the UI shows a clear "unavailable" message instead of stale or invented trains. We tested five failure modes.

## Rehearsal record

- **Click-through on `2d0b5ef`:** 8/8 PASS (landing, autocomplete search, rail map and details, compare "35 minutes sooner for $15 more", Journey demo and delay, Wallet with live SEPTA, 502 backup, empty-feed backup). No console errors.
- **Read-aloud length:** 219 spoken words (counted), about 1:30 of speech. Add about 1:30 for clicks and pauses across the six steps, giving roughly 3:00. The automated click-through itself takes about 4 seconds, so it doesn't measure presenter time. Not yet rehearsed aloud by a person; time it once before presenting.
- **Steps that failed on RC1:** none. Limits above are known findings, not demo-step failures.
