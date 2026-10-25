// P4-22: independent checks of the optional location helper (PR #16, src/services/transit/location.ts).
// Run inside a checkout of the helper. Skipped unless P4_22=1, so the normal `pnpm test` run is unaffected.
// Only injected/mock geolocation and synthetic or catalogue fixture coordinates are used; the real
// browser/machine location is never requested. Optional: P4_22_CATALOGUE=<P4-19 dump.json> for the catalogue fixture.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';

type City = { id: string; name: string; latitude: number; longitude: number };
type Mod = typeof import('../src/services/transit/location');
const enabled = process.env.P4_22 === '1';
const load = async (): Promise<Mod> => import('../src/services/transit/location');
const KM_PER_DEG = 6371 * Math.PI / 180; // equatorial great-circle km per degree, as in the helper's haversine radius
const pos = (latitude: unknown, longitude: unknown, accuracy: unknown = 20) =>
  ({ coords: { latitude, longitude, accuracy } } as unknown as GeolocationPosition);
const ok = (p: GeolocationPosition) => ({ getCurrentPosition: vi.fn((s: PositionCallback) => s(p)) });
const cities: City[] = [
  { id: 'a', name: 'City A', latitude: 40, longitude: -75 },
  { id: 'b', name: 'City B', latitude: 41, longitude: -74 },
];
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.skipIf(!enabled)('P4-22 location helper', () => {
  test('L1 import touches no geolocation, navigator, timers or network', async () => {
    const access = vi.fn();
    vi.stubGlobal('navigator', new Proxy({}, { get: (_t, k) => { access(k); return undefined; } }));
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy);
    vi.useFakeTimers();
    vi.resetModules();
    await load();
    expect(access).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('L2 one explicit call = exactly one getCurrentPosition, low accuracy, no cache, never watchPosition', async () => {
    const { requestCurrentLocation } = await load();
    const geo = { ...ok(pos(40.001, -75.001)), watchPosition: vi.fn() };
    await requestCurrentLocation(cities, { geolocation: geo });
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(geo.getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 });
    expect(geo.watchPosition).not.toHaveBeenCalled();
  });

  test('L3 FINDING: the watchdog counts permission-prompt time (W3C timeout excludes it)', async () => {
    // Simulate a user who approves the prompt after 12 s and a position that arrives 0.5 s later.
    const { requestCurrentLocation } = await load();
    vi.useFakeTimers();
    let deliver!: () => void;
    const geo = { getCurrentPosition: (s: PositionCallback) => { deliver = () => s(pos(40.001, -75.001)); } };
    const pending = requestCurrentLocation(cities, { geolocation: geo });
    await vi.advanceTimersByTimeAsync(12_500);
    deliver(); // permission granted + position, after the 10 s watchdog
    const r = await pending;
    expect(r).toMatchObject({ status: 'error', code: 'timeout' }); // granted position is discarded
  });

  test('L4 late and duplicate callbacks are ignored; no timers remain', async () => {
    const { requestCurrentLocation } = await load();
    vi.useFakeTimers();
    let s!: PositionCallback; let f!: PositionErrorCallback;
    const geo = { getCurrentPosition: (a: PositionCallback, b?: PositionErrorCallback | null) => { s = a; f = b!; } };
    const p1 = requestCurrentLocation(cities, { geolocation: geo });
    s(pos(40.001, -75.001)); s(pos(41, -74)); f({ code: 1 } as GeolocationPositionError);
    expect(await p1).toMatchObject({ status: 'suggestion', nearestCity: { id: 'a' } });
    expect(vi.getTimerCount()).toBe(0);
    const p2 = requestCurrentLocation(cities, { geolocation: geo });
    f({ code: 2 } as GeolocationPositionError); s(pos(40, -75));
    expect(await p2).toMatchObject({ status: 'error', code: 'unavailable' });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('L5 no cancellation input: an unknown signal option is ignored and an obsolete request still resolves', async () => {
    const { requestCurrentLocation } = await load();
    const ctrl = new AbortController(); ctrl.abort();
    const r = await requestCurrentLocation(cities, { geolocation: ok(pos(40.001, -75.001)), signal: ctrl.signal } as never);
    expect(r.status).toBe('suggestion'); // caller must discard obsolete results itself
  });

  test.each([
    ['NaN lat', NaN, 0, 20], ['+Inf lon', 0, Infinity, 20], ['-Inf lat', -Infinity, 0, 20], ['lat 90.0001', 90.0001, 0, 20],
    ['lon -180.0001', 0, -180.0001, 20], ['accuracy NaN', 0, 0, NaN], ['accuracy Infinity', 0, 0, Infinity],
    ['accuracy -1', 0, 0, -1], ['accuracy null', 0, 0, null], ['lat string', '40', 0, 20], ['lat null', null, 0, 20],
  ])('L6 malformed position %s -> unavailable, no coordinates leaked', async (_n, la, lo, acc) => {
    const { requestCurrentLocation } = await load();
    const r = await requestCurrentLocation(cities, { geolocation: ok(pos(la, lo, acc)) });
    expect(r).toMatchObject({ status: 'error', code: 'unavailable', manualEntryAvailable: true });
    expect('coordinates' in r).toBe(false);
  });

  test('L7 exact edges accepted: lat +/-90, lon +/-180, accuracy 0', async () => {
    const { requestCurrentLocation } = await load();
    for (const [la, lo] of [[90, 180], [-90, -180]]) {
      expect((await requestCurrentLocation(cities, { geolocation: ok(pos(la, lo, 0)) })).status).toBe('suggestion');
    }
  });

  test('L8 default 50 km boundary with uncertainty (accuracy 200 m -> uncertaintyKm 1.0)', async () => {
    const { requestCurrentLocation } = await load();
    const at = async (km: number, maxDistanceKm?: number) => {
      const r = await requestCurrentLocation([{ id: 'c', name: 'C', latitude: 0, longitude: km / KM_PER_DEG }],
        { geolocation: ok(pos(0, 0, 200)), ...(maxDistanceKm ? { maxDistanceKm } : {}) });
      if (r.status !== 'suggestion') throw new Error('expected suggestion');
      expect(r.uncertaintyKm).toBe(1);
      return r.proximity;
    };
    expect(await at(48.9)).toBe('nearby');      // 48.9 + 1.0 <= 50
    expect(await at(49.1)).toBe('uncertain');   // error radius crosses 50
    expect(await at(50.9)).toBe('uncertain');
    expect(await at(51.1)).toBe('faraway');     // 51.1 - 1.0 > 50
    expect(await at(98.9, 100)).toBe('nearby'); // custom maxDistanceKm honoured
  });

  test('L9 ties: equidistant cities -> catalogue order decides the id, proximity uncertain', async () => {
    const { requestCurrentLocation } = await load();
    const e = { id: 'east', name: 'East', latitude: 0, longitude: 0.2 };
    const w = { id: 'west', name: 'West', latitude: 0, longitude: -0.2 };
    const r1 = await requestCurrentLocation([e, w], { geolocation: ok(pos(0, 0)) });
    const r2 = await requestCurrentLocation([w, e], { geolocation: ok(pos(0, 0)) });
    expect(r1).toMatchObject({ nearestCity: { id: 'east' }, proximity: 'uncertain' });
    expect(r2).toMatchObject({ nearestCity: { id: 'west' }, proximity: 'uncertain' });
  });

  test('L10 zero / one / multiple places', async () => {
    const { requestCurrentLocation } = await load();
    const geo = ok(pos(0, 0));
    expect(await requestCurrentLocation([], { geolocation: geo })).toMatchObject({ code: 'invalid-catalogue' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    const one = await requestCurrentLocation([{ id: 'o', name: 'O', latitude: 0, longitude: 0.05 }], { geolocation: ok(pos(0, 0)) });
    expect(one).toMatchObject({ nearestCity: { id: 'o' }, proximity: 'nearby' }); // no competitor -> never ambiguous
    const many = await requestCurrentLocation([{ id: 'x', name: 'X', latitude: 0, longitude: 0.3 }, { id: 'y', name: 'Y', latitude: 0, longitude: 0.05 }],
      { geolocation: ok(pos(0, 0)) });
    expect(many).toMatchObject({ nearestCity: { id: 'y' }, proximity: 'nearby' });
  });

  test('L11 whitespace-only city name and non-string fields are accepted as valid catalogue entries', async () => {
    const { requestCurrentLocation } = await load();
    const r = await requestCurrentLocation([{ id: ' ', name: ' ', latitude: 0, longitude: 0 }], { geolocation: ok(pos(0, 0)) });
    expect(r).toMatchObject({ status: 'suggestion', nearestCity: { id: ' ', name: ' ' } });
  });

  test('L12 privacy: success and error paths make no network, storage, cookie, URL or console calls; raw digits absent', async () => {
    const { requestCurrentLocation } = await load();
    const forbidden = vi.fn();
    vi.stubGlobal('fetch', forbidden); vi.stubGlobal('XMLHttpRequest', forbidden);
    vi.stubGlobal('navigator', { sendBeacon: forbidden });
    vi.stubGlobal('localStorage', { setItem: forbidden }); vi.stubGlobal('sessionStorage', { setItem: forbidden });
    vi.stubGlobal('history', { pushState: forbidden, replaceState: forbidden });
    vi.stubGlobal('document', { set cookie(_v: string) { forbidden(); } });
    vi.stubGlobal('location', { assign: forbidden, replace: forbidden, set href(_v: string) { forbidden(); } });
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, m).mockImplementation(forbidden);
    const r = await requestCurrentLocation(cities, { geolocation: ok(pos(40.123456789, -75.987654321, 5)) });
    const e = await requestCurrentLocation(cities, { geolocation: { getCurrentPosition: (_s: PositionCallback, f?: PositionErrorCallback | null) => f?.({ code: 1, message: '40.123456789' } as GeolocationPositionError) } });
    expect(forbidden).not.toHaveBeenCalled();
    const text = JSON.stringify([r, e]);
    expect(text).not.toMatch(/40\.123|75\.987/);
    expect(r).toMatchObject({ coordinates: { latitude: 40.12, longitude: -75.99, precisionDegrees: 0.01 } });
  });

  test('L13 rounding displacement bound (< 0.8 km) holds on a grid of latitudes', () => {
    let worst = 0;
    for (let lat = -89.995; lat <= 89.995; lat += 0.5) {
      const dLat = 0.005 * KM_PER_DEG; const dLon = 0.005 * KM_PER_DEG * Math.cos(lat * Math.PI / 180);
      worst = Math.max(worst, Math.hypot(dLat, dLon));
    }
    expect(worst).toBeLessThan(0.8);
  });

  test.skipIf(!process.env.P4_22_CATALOGUE)('L14 catalogue fixture (P4-19 dump of PR #20 d45b0d3): verified list valid, full audit list rejected', async () => {
    const { requestCurrentLocation } = await load();
    const dump = JSON.parse(readFileSync(process.env.P4_22_CATALOGUE!, 'utf8'));
    const verified = new Set<string>(dump.verifiedIds);
    const pick = (c: City) => ({ id: c.id, name: c.name, latitude: c.latitude, longitude: c.longitude });
    const searchable: City[] = dump.nationalCities.filter((c: City) => verified.has(c.id)).map(pick);
    const all: City[] = dump.nationalCities.map(pick);
    const philly = searchable.find(c => c.id === 'philadelphia')!;
    const r = await requestCurrentLocation(searchable, { geolocation: ok(pos(philly.latitude, philly.longitude, 50)) });
    expect(r).toMatchObject({ status: 'suggestion', nearestCity: { id: 'philadelphia', name: 'Philadelphia' } });
    const geo = ok(pos(0, 0));
    expect(await requestCurrentLocation(all, { geolocation: geo })).toMatchObject({ code: 'invalid-catalogue' }); // 10 null-coordinate rows
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    // Same-name places: the helper returns name only, so "Portland" needs the caller to add state from the id.
    const portland = searchable.find(c => c.id === 'portland-or')!;
    const p = await requestCurrentLocation(searchable, { geolocation: ok(pos(portland.latitude, portland.longitude, 50)) });
    expect(p).toMatchObject({ nearestCity: { id: 'portland-or', name: 'Portland' } });
    expect(Object.keys((p as { nearestCity: object }).nearestCity)).toEqual(['id', 'name']);
    console.info('L14 searchable', searchable.length, 'all', all.length);
  });
});
