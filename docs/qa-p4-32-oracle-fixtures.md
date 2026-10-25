# P4-32: independent oracle fixtures for dated-transit QA

Owner: Person 4 (QA). Assigned by interim lead Person 6 in hub issue #2 (`P4-32`). This file makes the P4-31 G1 "independent planner oracle" concrete.

- **Builds on:** the P4-31 protocol in QA PR #18 at `4facb05c69921b531a9463621c8792b28532ad20`.
- **Source baseline (provenance only):** #30 `fe89f9ec5fc67bfdc779121143970684d649f143` on #26 `35ed1965be9a2641fa31a2b8e1de60e7223260a3`.
- **Candidate:** **PENDING.** These are synthetic networks with no relation to real operator coverage.

The expected results below were **worked out by hand** from the rules in section 0. They were then cross-checked with a throwaway brute-force search I wrote in my scratchpad. That script is not committed, and it was not written from P3's engine, which I haven't read or run. **Application results for all fixtures: NOT RUN.**

## 0. Shared conventions and assumptions

| Item | Value used here | Status |
| --- | --- | --- |
| Timezone | All stops `America/New_York`. Every fixture date is before the DST change (Sun 1 Nov 2026), so local = UTC−4 (EDT). | Fixed |
| GTFS time base | Times are measured from noon − 12 h of the service date. `25:10:00` on service date 2026-10-24 = 2026-10-25 01:10 EDT. | GTFS rule |
| Objective | **Earliest arrival**, then **fewest boardings** (P3 contract: "earliest arrival / fewer transfers") | Tie rule beyond that: **pending (U5)** |
| Bounds | At most **4 boardings**; departures within **7 days** of the query time (P3 contract: next 7 days / 4 boardings) | Exact window semantics **pending (U8)** |
| Default same-stop transfer | **10 min** when there's no `transfers.txt` row (P3 contract: "unspecified same-station 10 min") | P3 assumption |
| `transfers.txt` | `transfer_type` 2 → wait ≥ `min_transfer_time`. Type 3 → forbidden (stop-level, or trip-level with `from_trip_id`/`to_trip_id`). A row **replaces** the 10-min default. | GTFS rule; override behaviour **pending (U9)** |
| First boarding | No buffer: may depart at or after the query time | Fixed |
| Common files | `agency.txt`: `X,Fixture Rail,https://example.invalid,America/New_York`. `routes.txt`: one route `R0` (`route_type` 2) for every trip. Each trip's `trip_id` uses that trip's `service_id`. | Fixed |

How each fixture maps onto P3's API (request fields, stop or place IDs, the dated-ID format) is **pending the API checkpoint (U2)**. Only the GTFS-level inputs and the expected arrival/path are specified here.

---

## F1: direct vs transfer competition

```text
stops.txt          calendar.txt (service S runs Mon 2026-10-26 only)
A, B, C            S,1,1,1,1,1,1,1,20261026,20261026
trip  service  stop_times (stop arr/dep)
T1    S        A 08:00 → C 10:00
T2    S        A 08:10 → B 08:40
T3    S        B 09:00 → C 09:30
T4    S        A 09:00 → C 11:00
transfers.txt: none
```

| Query | Candidates checked by hand | Expected |
| --- | --- | --- |
| **F1a** A→C, depart ≥ 2026-10-26 07:30 | T1 direct: arrive 10:00. T2→T3: arrive B 08:40, wait 20 min ≥ 10, arrive **09:30**. T4: 11:00. | **Arrive 09:30 EDT, 2 boardings: T2 (A 08:10→B 08:40), T3 (B 09:00→C 09:30)** |
| **F1b** A→C, depart ≥ 08:15 | T1 (08:00) and T2 (08:10) already left; T3 alone doesn't start at A; T4 leaves 09:00. | **Arrive 11:00, 1 boarding: T4** |

Rationale: a transfer path must beat a slower direct trip (F1a). Missed first departures must not be used (F1b).

## F2: missed and forbidden connections

```text
stops.txt: A, B, C          calendar.txt: S runs 2026-10-26 only
trip  service  stop_times
T1    S        A 08:00 → B 08:50
T2    S        B 08:55 → C 09:30
T3    S        B 09:10 → C 10:00
T5    S        B 10:30 → C 11:15
```

| Variant | `transfers.txt` | Hand analysis at B (arrive 08:50 on T1) | Expected (query A→C, depart ≥ 07:30) |
| --- | --- | --- | --- |
| **F2a** | none | T2: 5-min wait < 10, **missed**. T3: 20 min, OK. | **Arrive 10:00: T1, T3** |
| **F2b** | `B,B,3,,T1,T3` (from_stop, to_stop, type 3, min blank, from_trip T1, to_trip T3) | T2 missed (default 10). T3 **forbidden** after T1. T5: 100 min, OK. | **Arrive 11:15: T1, T5** |
| **F2c** | `B,B,2,300` (type 2, 300 s) | T2: 5 min ≥ 5, OK, which replaces the 10-min default | **Arrive 09:30: T1, T2** |

Rationale: the engine must never offer an impossible (F2a) or forbidden (F2b) connection, and it must honour published minimum times (F2c). F2c's result depends on U9 (whether a type-2 row overrides the default).

## F3: overnight service with GTFS times past 24:00

```text
stops.txt: A, B, C
calendar.txt: SAT runs 2026-10-24 only; SUN runs 2026-10-25 only
trip  service  stop_times (GTFS clock)        local wall clock
T1    SAT      A 23:30:00 → B 25:10:00        Sat 10-24 23:30 → Sun 10-25 01:10
T2    SUN      B 01:40:00 → C 02:30:00        Sun 10-25 01:40 → 02:30
T3    SAT      B 26:00:00 → C 26:40:00        Sun 10-25 02:00 → 02:40
```

| Query | Hand analysis | Expected |
| --- | --- | --- |
| **F3** A→C, depart ≥ 2026-10-24 23:00 | T1 reaches B at 01:10 on 10-25. T2 (Sunday service) leaves 01:40: 30-min wait, OK, arrive 02:30. T3 (Saturday service, `26:00` = 02:00): 50-min wait, arrive 02:40, later. | **Arrive 2026-10-25 02:30 EDT (06:30Z), 2 boardings: T1, T2.** The display must show the **next date** (Oct 25). |

Rationale: times past 24:00 belong to the previous service date, and a trip on one service day can connect to a trip on the next.

## F4: service exception (`calendar_dates.txt`)

```text
stops.txt: A, B
calendar.txt: WEEKDAY,1,1,1,1,1,0,0,20261019,20261030
calendar_dates.txt: WEEKDAY,20261026,2   (removed)
                    HOLIDAY,20261026,1   (added; HOLIDAY has no calendar.txt row)
trip  service   stop_times
T1    WEEKDAY   A 08:00 → B 09:00
T2    HOLIDAY   A 09:30 → B 10:45
```

| Query (A→B) | Hand analysis | Expected |
| --- | --- | --- |
| **F4a** Mon 2026-10-26, ≥ 07:00 | WEEKDAY removed that day, so no T1. HOLIDAY added, so T2 runs. | **Arrive 10:45: T2** |
| **F4b** Tue 2026-10-27, ≥ 07:00 | WEEKDAY active, HOLIDAY not | **Arrive 09:00: T1** |
| **F4c** Sun 2026-10-25, ≥ 07:00 | Nothing on Sunday. The next active departure inside the 7-day window is Mon 10-26 T2. | **Arrive 2026-10-26 10:45: T2** *if* the engine searches forward across days. If it searches only the requested date, the expected result is **no result for 10-25**. **Pending U8.** |

Rationale: removed dates must suppress regular service, and added-only services must appear.

## F5: equal arrival, fewer boardings

```text
stops.txt: A, B, C          calendar.txt: S runs 2026-10-26 only
trip  service  stop_times
T1    S        A 08:00 → C 10:00
T2    S        A 08:30 → B 09:00
T3    S        B 09:20 → C 10:00
```

| Query | Hand analysis | Expected |
| --- | --- | --- |
| **F5** A→C, depart ≥ 07:30 | T1 arrives 10:00 with 1 boarding. T2→T3 (20-min wait) also arrives 10:00 with 2 boardings. | **Arrive 10:00, 1 boarding: T1** (fewer boardings wins at equal arrival) |

Rationale: this checks the stated secondary objective. A preference for later departure or shorter travel time between equal options isn't specified (U5), so no fixture depends on it.

## F6: unreachable, operator gap, boarding bound and validity

```text
stops.txt: A, B, D, P, Q, R, S1, U, V   (D: a stop served only by an operator with no loaded feed; no trips)
calendar.txt: S,1,1,1,1,1,1,1,20261026,20261030
trip  service  stop_times
T1    S        A 08:00 → B 08:30
L1    S        P 08:00 → Q 08:20
L2    S        Q 08:40 → R 09:00
L3    S        R 09:20 → S1 09:40
L4    S        S1 10:00 → U 10:20
L5    S        U 10:40 → V 11:00
```

| Query | Hand analysis | Expected |
| --- | --- | --- |
| **F6a** A→D, 2026-10-26 ≥ 07:00 | No trip serves D | **No itinerary.** The UI shows an operator/coverage gap and **never** falls back to a sample route. |
| **F6b** P→V, 2026-10-26 ≥ 07:00 | Only path is L1→L5, which is **5 boardings**, over the bound of 4 | **No itinerary within bounds**, with honest wording about the search limit |
| **F6c** P→U, 2026-10-26 ≥ 07:00 | L1→L4: 4 boardings, each wait 20 min ≥ 10 | **Arrive 10:20, 4 boardings** (boundary case: exactly at the limit) |
| **F6d** A→B, 2026-11-02 ≥ 07:00 | After the calendar's end (2026-10-30); no service in the next 7 days | **No itinerary**, and the UI states the date is outside the feed's validity |

---

## Summary of expected results (NOT RUN against any candidate)

| Case | Expected arrival (EDT) | Boardings | Trips | Application result |
| --- | --- | ---: | --- | --- |
| F1a | 2026-10-26 09:30 | 2 | T2, T3 | NOT RUN |
| F1b | 2026-10-26 11:00 | 1 | T4 | NOT RUN |
| F2a | 2026-10-26 10:00 | 2 | T1, T3 | NOT RUN |
| F2b | 2026-10-26 11:15 | 2 | T1, T5 | NOT RUN |
| F2c | 2026-10-26 09:30 | 2 | T1, T2 | NOT RUN (U9) |
| F3 | 2026-10-25 02:30 | 2 | T1, T2 | NOT RUN |
| F4a | 2026-10-26 10:45 | 1 | T2 | NOT RUN |
| F4b | 2026-10-27 09:00 | 1 | T1 | NOT RUN |
| F4c | 2026-10-26 10:45 *or* none | 1 | T2 | NOT RUN (U8) |
| F5 | 2026-10-26 10:00 | 1 | T1 | NOT RUN (U5 for further ties) |
| F6a | none (operator gap) | — | — | NOT RUN |
| F6b | none (over 4-boarding bound) | — | — | NOT RUN |
| F6c | 2026-10-26 10:20 | 4 | L1–L4 | NOT RUN |
| F6d | none (outside validity) | — | — | NOT RUN |

## Unresolved mappings (need P3's frozen candidate or answers)

- **U2:** API request/response schema, how fixture stops map to the engine's place/stop IDs, and the dated-ID format. Needed to feed these fixtures to the engine; the fixtures are GTFS-level so they can be loaded either way.
- **U5:** the tie-break among equal-arrival, equal-boarding options.
- **U8:** what the 7-day window means: forward search across days vs requested date only (F4c), and whether the window is counted in service days or clock time.
- **U9:** whether a `transfers.txt` type-2 row overrides the 10-minute default (F2c), and whether trip-level type-3 rows are supported (F2b).
- **U10:** how the engine loads a fixture feed: a test hook, the build script on a fixture ZIP, or a unit-level injection. The fixtures must be run without changing application code.
