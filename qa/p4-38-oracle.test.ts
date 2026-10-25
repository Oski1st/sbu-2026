// P4-38 (WIP): runs the P4-32 hand-worked oracle fixtures F1-F6 against PR #37's timetable engine.
// Candidate: #37 2172466828f6af258281d681e8fb4f513714234b (work-in-progress checkpoint, not frozen).
// Run inside a checkout of that candidate. Skipped unless P4_38=1, so the normal `pnpm test` run is unaffected.
//   P4_38=1 corepack pnpm exec vitest run qa/p4-38-oracle.test.ts
// Optional: P4_38_OUT=<file> writes the actual engine results as JSON.
//
// U10 mapping: the engine has a public, data-injected constructor
// `createTimetableEngine(snapshot, { now })` in server/timetable-engine.mjs. The offline compiler
// (scripts/build-timetables.py) cannot take a synthetic feed without app changes: it requires the two
// named operator ZIPs, the national evidence mapping and it writes into server/data/. So this file
// converts the fixture GTFS text into the documented snapshot shape itself (adapter below). That adapter
// is QA code; the compiler step is NOT covered by these results.
// No application file is modified. Clock is injected (now = 2026-10-20 12:00Z) so the fixture dates are
// not rejected by the past-date rule.
import { writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const enabled = process.env.P4_38 === '1';
const enginePath = '../server/timetable-engine.mjs';
type Plan = {
  reason?: string;
  message?: string;
  itineraries: { arrival: string; departure: string; transfers: number; legs: { tripId: string; serviceDate: string; departure: string; arrival: string; fromStop: string; toStop: string }[] }[];
};
type Engine = { plan: (q: Record<string, unknown>, o?: { allowPast?: boolean }) => Plan };
const load = async (): Promise<(data: unknown, o: unknown) => Engine> =>
  (await import(/* @vite-ignore */ enginePath)).createTimetableEngine;

// ---------- GTFS text -> snapshot adapter (QA-owned; mirrors the shape documented in build-timetables.py) ----------
const csv = (text: string) => {
  const [head, ...rows] = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const keys = head.split(',');
  return rows.map((r) => { const v = r.split(','); return Object.fromEntries(keys.map((k, i) => [k, v[i] ?? ''])); });
};
const secs = (t: string) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
type Gtfs = { stops: string[]; calendar?: string; calendar_dates?: string; trips: [string, string, [string, string][]][]; transfers?: string; mapped?: Record<string, string[]> };
function snapshot(name: string, g: Gtfs) {
  const calendar = g.calendar ? csv('service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' + g.calendar) : [];
  const exceptions = g.calendar_dates ? csv('service_id,date,exception_type\n' + g.calendar_dates) : [];
  const transfers = g.transfers ? csv('from_stop_id,to_stop_id,transfer_type,min_transfer_time,from_trip_id,to_trip_id\n' + g.transfers) : [];
  const days = [...calendar.flatMap((r) => [r.start_date, r.end_date]), ...exceptions.map((r) => r.date)].sort();
  const feed = {
    id: 'fx', operator: 'FIXTURE', timezone: 'America/New_York', sourceUrl: 'https://example.invalid/' + name + '.zip',
    sha256: '0'.repeat(64), checkedAt: '2026-10-20T00:00:00Z', version: name,
    calendarStartDate: days[0], startDate: days[0], endDate: days.at(-1),
    calendar, exceptions, transfers,
    stops: Object.fromEntries(g.stops.map((s) => [s, { name: 'Stop ' + s, latitude: 40, longitude: -75, timezone: 'America/New_York', url: '', parent: '' }])),
    trips: g.trips.map(([id, service, st]) => ({
      id, routeId: 'R0', service, name: 'Fixture Rail', number: id, mode: 'rail', agencyName: 'Fixture Rail',
      stops: st.map(([stop, t]) => { const [a, d = a] = t.split('/'); return [stop, secs(a), secs(d), 0, 0]; }),
    })),
    skippedTrips: 0,
  };
  const mapped = g.mapped ?? Object.fromEntries(g.stops.map((s) => [s.toLowerCase(), ['fx:' + s]]));
  return {
    schema: 1, version: 'p4-38-' + name, limits: ['P4-38 synthetic fixture'], links: [], feeds: [feed],
    cities: g.stops.map((s) => ({ id: s.toLowerCase(), name: 'Place ' + s, state: 'ZZ', aliases: [] })),
    cityStops: mapped,
  };
}

// ---------- P4-32 fixtures ----------
const S26 = 'S,1,1,1,1,1,1,1,20261026,20261026';
const F1: Gtfs = { stops: ['A', 'B', 'C'], calendar: S26, trips: [
  ['T1', 'S', [['A', '08:00:00'], ['C', '10:00:00']]], ['T2', 'S', [['A', '08:10:00'], ['B', '08:40:00']]],
  ['T3', 'S', [['B', '09:00:00'], ['C', '09:30:00']]], ['T4', 'S', [['A', '09:00:00'], ['C', '11:00:00']]]] };
const F2trips: Gtfs['trips'] = [
  ['T1', 'S', [['A', '08:00:00'], ['B', '08:50:00']]], ['T2', 'S', [['B', '08:55:00'], ['C', '09:30:00']]],
  ['T3', 'S', [['B', '09:10:00'], ['C', '10:00:00']]], ['T5', 'S', [['B', '10:30:00'], ['C', '11:15:00']]]];
const F3: Gtfs = { stops: ['A', 'B', 'C'], calendar: 'SAT,1,1,1,1,1,1,1,20261024,20261024\nSUN,1,1,1,1,1,1,1,20261025,20261025', trips: [
  ['T1', 'SAT', [['A', '23:30:00'], ['B', '25:10:00']]], ['T2', 'SUN', [['B', '01:40:00'], ['C', '02:30:00']]],
  ['T3', 'SAT', [['B', '26:00:00'], ['C', '26:40:00']]]] };
const F4: Gtfs = { stops: ['A', 'B'], calendar: 'WEEKDAY,1,1,1,1,1,0,0,20261019,20261030',
  calendar_dates: 'WEEKDAY,20261026,2\nHOLIDAY,20261026,1', trips: [
  ['T1', 'WEEKDAY', [['A', '08:00:00'], ['B', '09:00:00']]], ['T2', 'HOLIDAY', [['A', '09:30:00'], ['B', '10:45:00']]]] };
const F5: Gtfs = { stops: ['A', 'B', 'C'], calendar: S26, trips: [
  ['T1', 'S', [['A', '08:00:00'], ['C', '10:00:00']]], ['T2', 'S', [['A', '08:30:00'], ['B', '09:00:00']]],
  ['T3', 'S', [['B', '09:20:00'], ['C', '10:00:00']]]] };
const F6trips: Gtfs['trips'] = [
  ['T1', 'S', [['A', '08:00:00'], ['B', '08:30:00']]], ['L1', 'S', [['P', '08:00:00'], ['Q', '08:20:00']]],
  ['L2', 'S', [['Q', '08:40:00'], ['R', '09:00:00']]], ['L3', 'S', [['R', '09:20:00'], ['S1', '09:40:00']]],
  ['L4', 'S', [['S1', '10:00:00'], ['U', '10:20:00']]], ['L5', 'S', [['U', '10:40:00'], ['V', '11:00:00']]]];
const F6stops = ['A', 'B', 'D', 'P', 'Q', 'R', 'S1', 'U', 'V'];
const F6: Gtfs = { stops: F6stops, calendar: 'S,1,1,1,1,1,1,1,20261026,20261030', trips: F6trips };
const F6unmapped: Gtfs = { ...F6, mapped: Object.fromEntries(F6stops.filter((s) => s !== 'D').map((s) => [s.toLowerCase(), ['fx:' + s]])) };

type Expect = { arrival: string; trips: string[] } | { none: string[] };
type Case = { id: string; fx: string; g: Gtfs; from: string; to: string; date: string; time: string; expect: Expect; note?: string };
const ny = (d: string, t: string) => new Date(Date.parse(`${d}T${t}:00-04:00`)).toISOString();
const cases: Case[] = [
  { id: 'F1a', fx: 'F1', g: F1, from: 'a', to: 'c', date: '2026-10-26', time: '07:30', expect: { arrival: ny('2026-10-26', '09:30'), trips: ['T2', 'T3'] } },
  { id: 'F1b', fx: 'F1', g: F1, from: 'a', to: 'c', date: '2026-10-26', time: '08:15', expect: { arrival: ny('2026-10-26', '11:00'), trips: ['T4'] } },
  { id: 'F2a', fx: 'F2a', g: { stops: ['A', 'B', 'C'], calendar: S26, trips: F2trips }, from: 'a', to: 'c', date: '2026-10-26', time: '07:30', expect: { arrival: ny('2026-10-26', '10:00'), trips: ['T1', 'T3'] } },
  { id: 'F2b', fx: 'F2b', g: { stops: ['A', 'B', 'C'], calendar: S26, trips: F2trips, transfers: 'B,B,3,,T1,T3' }, from: 'a', to: 'c', date: '2026-10-26', time: '07:30', expect: { arrival: ny('2026-10-26', '11:15'), trips: ['T1', 'T5'] } },
  { id: 'F2c', fx: 'F2c', g: { stops: ['A', 'B', 'C'], calendar: S26, trips: F2trips, transfers: 'B,B,2,300,,' }, from: 'a', to: 'c', date: '2026-10-26', time: '07:30', expect: { arrival: ny('2026-10-26', '09:30'), trips: ['T1', 'T2'] } },
  { id: 'F3', fx: 'F3', g: F3, from: 'a', to: 'c', date: '2026-10-24', time: '23:00', expect: { arrival: '2026-10-25T06:30:00.000Z', trips: ['T1', 'T2'] } },
  { id: 'F4a', fx: 'F4', g: F4, from: 'a', to: 'b', date: '2026-10-26', time: '07:00', expect: { arrival: ny('2026-10-26', '10:45'), trips: ['T2'] } },
  { id: 'F4b', fx: 'F4', g: F4, from: 'a', to: 'b', date: '2026-10-27', time: '07:00', expect: { arrival: ny('2026-10-27', '09:00'), trips: ['T1'] } },
  { id: 'F4c', fx: 'F4', g: F4, from: 'a', to: 'b', date: '2026-10-25', time: '07:00', expect: { arrival: ny('2026-10-26', '10:45'), trips: ['T2'] }, note: 'U8 resolved: forward search over 7x24h from the requested instant' },
  { id: 'F5', fx: 'F5', g: F5, from: 'a', to: 'c', date: '2026-10-26', time: '07:30', expect: { arrival: ny('2026-10-26', '10:00'), trips: ['T1'] } },
  { id: 'F6a', fx: 'F6 (D mapped, no trips)', g: F6, from: 'a', to: 'd', date: '2026-10-26', time: '07:00', expect: { none: ['no-connection', 'coverage-gap'] } },
  { id: 'F6a-gap', fx: 'F6 (D has no stop mapping)', g: F6unmapped, from: 'a', to: 'd', date: '2026-10-26', time: '07:00', expect: { none: ['coverage-gap'] } },
  { id: 'F6b', fx: 'F6', g: F6, from: 'p', to: 'v', date: '2026-10-26', time: '07:00', expect: { none: ['no-connection'] } },
  { id: 'F6c', fx: 'F6', g: F6, from: 'p', to: 'u', date: '2026-10-26', time: '07:00', expect: { arrival: ny('2026-10-26', '10:20'), trips: ['L1', 'L2', 'L3', 'L4'] } },
  { id: 'F6d', fx: 'F6', g: F6, from: 'a', to: 'b', date: '2026-11-02', time: '07:00', expect: { none: ['date-outside-snapshot'] } },
];

const now = () => Date.parse('2026-10-20T12:00:00Z');
const results: Record<string, unknown> = {};
describe.skipIf(!enabled)('P4-38 oracle fixtures F1-F6 vs PR #37 engine (WIP)', () => {
  for (const c of cases)
    test(`${c.id} ${c.from.toUpperCase()}->${c.to.toUpperCase()} ${c.date} ${c.time}`, async () => {
      const create = await load();
      const out = create(snapshot(c.fx, c.g), { now }).plan({ fromId: c.from, toId: c.to, date: c.date, time: c.time });
      const top = out.itineraries[0];
      const actual = top
        ? { arrival: top.arrival, boardings: top.legs.length, trips: top.legs.map((l) => l.tripId), legs: top.legs.map((l) => `${l.tripId}@${l.serviceDate} ${l.fromStop} ${l.departure} -> ${l.toStop} ${l.arrival}`),
            allOptions: out.itineraries.map((i) => `${i.arrival} ${i.legs.map((l) => l.tripId).join('+')}`) }
        : { reason: out.reason, message: out.message };
      results[c.id] = { expected: c.expect, actual, note: c.note };
      if ('none' in c.expect) {
        expect(out.itineraries).toHaveLength(0);
        expect(c.expect.none).toContain(out.reason);
      } else {
        expect(top?.arrival).toBe(c.expect.arrival);
        expect(top?.legs.map((l) => l.tripId)).toEqual(c.expect.trips);
      }
    });
  test.sequential('write results', () => {
    if (process.env.P4_38_OUT) writeFileSync(process.env.P4_38_OUT, JSON.stringify(results, null, 2) + '\n');
  });
});

// ---------- U4 probes (contract observations, not P4-32 fixtures) ----------
describe.skipIf(!enabled)('P4-38 U4/I2 probes', () => {
  const probe = { stops: ['A', 'B'], calendar: 'S,1,1,1,1,1,1,1,20261025,20271231', trips: [['T1', 'S', [['A', '08:00:00'], ['B', '09:00:00']]]] } as Gtfs;
  test('past date is rejected (now injected 2026-10-20)', async () => {
    const e = (await load())(snapshot('U4', probe), { now });
    expect(() => e.plan({ fromId: 'a', toId: 'b', date: '2026-10-19', time: '08:00' })).toThrow(/today or a future date/);
  });
  test('nonexistent DST local time 2027-03-14 02:30 is rejected', async () => {
    const e = (await load())(snapshot('U4', probe), { now });
    expect(() => e.plan({ fromId: 'a', toId: 'b', date: '2027-03-14', time: '02:30' })).toThrow(/daylight-saving/);
  });
  test('repeated DST local time 2026-11-01 01:30 uses earlier (EDT) occurrence with warning', async () => {
    const e = (await load())(snapshot('U4', probe), { now }) as Engine & { plan: (q: unknown) => Plan & { warnings: string[] } };
    const out = e.plan({ fromId: 'a', toId: 'b', date: '2026-11-01', time: '01:30' }) as Plan & { warnings: string[] };
    expect(out.warnings.join(' ')).toMatch(/occurs twice/);
    expect(out.itineraries[0].departure).toBe('2026-11-01T13:00:00.000Z');
  });
});

// ---------- Randomized differential check (extends G1) ----------
// Independent brute-force round search written for QA (not derived from the engine): earliest arrival
// with <= 4 boardings, no first-boarding buffer, 10-minute same-stop transfer, no transfers.txt rows,
// single service day. Compares the engine's first itinerary (arrival, boardings) with the oracle.
function rng(seed: number) { return () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32); }
function bruteForce(trips: [string, number[], string[]][], origin: string, dest: string, t0: number) {
  // best[k] = Map stop -> earliest arrival using exactly <= k boardings
  let prev = new Map<string, number>([[origin, t0]]); const firstRound = new Set([origin]);
  let answer: { arrival: number; boardings: number } | null = null;
  for (let k = 1; k <= 4; k++) {
    const next = new Map(prev);
    for (const [, times, stops] of trips)
      for (let i = 0; i < stops.length - 1; i++) {
        const at = prev.get(stops[i]);
        if (at === undefined) continue;
        const buffer = k === 1 && firstRound.has(stops[i]) ? 0 : 600;
        const dep = times[2 * i + 1];
        const ok = (k === 1 ? at + buffer <= dep : (stops[i] === origin && t0 <= dep) || at + buffer <= dep) && dep >= t0;
        if (!ok) continue;
        for (let j = i + 1; j < stops.length; j++) {
          const arr = times[2 * j];
          if (!(next.get(stops[j])! <= arr)) next.set(stops[j], arr);
        }
      }
    const d = next.get(dest);
    if (d !== undefined && (!answer || d < answer.arrival)) answer = { arrival: d, boardings: k };
    prev = next;
  }
  return answer;
}
describe.skipIf(!enabled)('P4-38 randomized differential vs independent brute force', () => {
  const N = Number(process.env.P4_38_RANDOM ?? 400);
  test(`${N} seeded random single-day networks`, async () => {
    const create = await load(), mismatches: unknown[] = [], byBoardings: Record<string, number> = {};
    const rand = rng(3838);
    const dense = ['A', 'B', 'C', 'D', 'E', 'F'], sparse = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'];
    const hhmm = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:00`;
    for (let n = 0; n < N; n++) {
      // Alternate a dense 6-stop network and a sparse 9-stop network of 2-stop trips (forces 3-4 boardings).
      const names = n % 2 ? sparse : dense, nTrips = n % 2 ? 16 : 10, maxExtra = n % 2 ? 0 : 2;
      const trips: [string, number[], string[]][] = [];
      for (let t = 0; t < nTrips; t++) {
        const len = 2 + Math.floor(rand() * (maxExtra + 1)), pool = [...names], stops: string[] = [];
        while (stops.length < len) stops.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
        let clock = 6 * 3600 + Math.floor(rand() * 72) * 300; const times: number[] = [];
        for (let i = 0; i < len; i++) {
          if (i) clock += 600 + Math.floor(rand() * 11) * 300;
          const dwell = i && i < len - 1 ? Math.floor(rand() * 2) * 300 : 0;
          times.push(clock, clock + dwell); clock += dwell;
        }
        trips.push(['X' + t, times, stops]);
      }
      const o = names[Math.floor(rand() * names.length)]; let d = o; while (d === o) d = names[Math.floor(rand() * names.length)];
      const qt = 6 * 3600 + Math.floor(rand() * 24) * 300;
      const g: Gtfs = { stops: names, calendar: S26, trips: trips.map(([id, times, stops]) => [id, 'S', stops.map((s, i) => [s, `${hhmm(times[2 * i])}/${hhmm(times[2 * i + 1])}`] as [string, string])]) };
      const out = create(snapshot('R' + n, g), { now }).plan({ fromId: o.toLowerCase(), toId: d.toLowerCase(), date: '2026-10-26', time: hhmm(qt).slice(0, 5) });
      const exp = bruteForce(trips, o, d, qt);
      const top = out.itineraries[0];
      byBoardings[String(exp?.boardings ?? 'none')] = (byBoardings[String(exp?.boardings ?? 'none')] ?? 0) + 1;
      const base = Date.parse('2026-10-26T04:00:00Z') - 0; // 00:00 EDT
      const act = top ? { arrival: (Date.parse(top.arrival) - base) / 1000, boardings: top.legs.length } : null;
      if (JSON.stringify(exp) !== JSON.stringify(act)) mismatches.push({ n, o, d, query: hhmm(qt), expected: exp && { ...exp, at: hhmm(exp.arrival) }, actual: act && { ...act, at: hhmm(act.arrival), legs: top.legs.map((l) => l.tripId) }, trips: g.trips });
    }
    if (process.env.P4_38_RANDOM_OUT) writeFileSync(process.env.P4_38_RANDOM_OUT, JSON.stringify({ cases: N, byBoardings, mismatches }, null, 2) + '\n');
    expect(mismatches).toEqual([]);
  });
});

// ---------- Observations (assert the behaviour seen at 2172466 so a re-run detects changes; not a verdict) ----------
describe.skipIf(!enabled)('P4-38 observed behaviour (owner decision, not pass/fail)', () => {
  test('observed: same-day query time earlier than "now" is accepted and returns already-departed trains', async () => {
    const at10 = () => Date.parse('2026-10-26T14:00:00Z'); // 10:00 EDT
    const out = (await load())(snapshot('F1', F1), { now: at10 }).plan({ fromId: 'a', toId: 'c', date: '2026-10-26', time: '07:30' });
    expect(out.itineraries[0].departure < new Date(at10()).toISOString()).toBe(true);
  });
  test('observed: GTFS transfer_type 0 between two different stops is treated as not allowed', async () => {
    const g: Gtfs = { stops: ['A', 'B', 'C', 'D'], calendar: S26, transfers: 'B,C,0,,,',
      trips: [['T1', 'S', [['A', '08:00:00'], ['B', '08:30:00']]], ['T2', 'S', [['C', '09:30:00'], ['D', '10:00:00']]]] };
    const out = (await load())(snapshot('T0', g), { now }).plan({ fromId: 'a', toId: 'd', date: '2026-10-26', time: '07:30' });
    expect(out.reason).toBe('no-connection');
  });
  test('observed: query date before feed start is refused even when service starts inside the 7-day window', async () => {
    const g: Gtfs = { stops: ['A', 'B'], calendar: 'S,1,1,1,1,1,1,1,20261026,20261030', trips: [['T1', 'S', [['A', '08:00:00'], ['B', '09:00:00']]]] };
    const out = (await load())(snapshot('W', g), { now }).plan({ fromId: 'a', toId: 'b', date: '2026-10-25', time: '07:00' });
    expect(out.reason).toBe('date-outside-snapshot');
  });
});
