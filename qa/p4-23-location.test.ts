// P4-23: independent checks of the location-helper follow-up (PR #28, src/services/transit/location.ts).
// Adapted from qa/p4-22-location.test.ts (P4-22, base b2b9353). Where the contract changed, the case says why.
// Run inside a checkout of the follow-up. Skipped unless P4_23=1, so the normal `pnpm test` run is unaffected.
// Mock/injected geolocation only; the real browser/machine location and permission UI are never used.
// Optional catalogue fixture: P4_23_DUMP=<P4-19 dump of #27> and P4_23_EXTRA=<P4-20 extra dump of #27>.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';

type City = { id: string; name: string; state: string; latitude: number; longitude: number };
type Mod = typeof import('../src/services/transit/location');
const enabled = process.env.P4_23 === '1';
const load = async (): Promise<Mod> => import('../src/services/transit/location');
const KM_PER_DEG = 6371 * Math.PI / 180;
const pos = (latitude: unknown, longitude: unknown, accuracy: unknown = 20) =>
  ({ coords: { latitude, longitude, accuracy } } as unknown as GeolocationPosition);
const ok = (p: GeolocationPosition) => ({ getCurrentPosition: vi.fn((s: PositionCallback) => s(p)) });
const held = () => {
  const h: { s?: PositionCallback; f?: PositionErrorCallback | null; calls: number } = { calls: 0 };
  return { h, geo: { getCurrentPosition: vi.fn((s: PositionCallback, f?: PositionErrorCallback | null) => { h.calls++; h.s = s; h.f = f; }) } };
};
const cities: City[] = [
  { id: 'a', name: 'City A', state: 'PA', latitude: 40, longitude: -75 },
  { id: 'b', name: 'City B', state: 'NJ', latitude: 41, longitude: -74 },
];
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe.skipIf(!enabled)('P4-23 location helper follow-up', () => {
  test('M1 (P4-22 L1, unchanged) import touches no navigator, timers or network', async () => {
    const access = vi.fn();
    vi.stubGlobal('navigator', new Proxy({}, { get: (_t, k) => { access(k); return undefined; } }));
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy);
    vi.useFakeTimers(); vi.resetModules();
    await load();
    expect(access).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  test('M2 (L2, unchanged) one getCurrentPosition, low accuracy, no cache, browser timeout = timeoutMs (default 10 s), never watchPosition', async () => {
    const { requestCurrentLocation } = await load();
    const geo = { ...ok(pos(40.001, -75.001)), watchPosition: vi.fn() };
    await requestCurrentLocation(cities, { geolocation: geo });
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(geo.getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 });
    expect(geo.watchPosition).not.toHaveBeenCalled();
    const g2 = ok(pos(40.001, -75.001));
    await requestCurrentLocation(cities, { geolocation: g2, timeoutMs: 4000, waitLimitMs: 60_000 });
    expect(g2.getCurrentPosition.mock.calls[0][2]).toMatchObject({ timeout: 4000 }); // wait limit is not passed to the browser
  });

  test('M3 (L3, contract changed: H1 fix) a 12 s permission wait now succeeds; app expiry is request-expired at 30 s; browser code 3 stays timeout', async () => {
    const { requestCurrentLocation } = await load();
    vi.useFakeTimers();
    const one = held();
    const p1 = requestCurrentLocation(cities, { geolocation: one.geo });
    await vi.advanceTimersByTimeAsync(12_500);
    one.h.s!(pos(40.001, -75.001));
    expect(await p1).toMatchObject({ status: 'suggestion', nearestCity: { id: 'a', state: 'PA' } }); // P4-22 observed 'timeout' here
    expect(vi.getTimerCount()).toBe(0);
    const two = held();
    const p2 = requestCurrentLocation(cities, { geolocation: two.geo });
    await vi.advanceTimersByTimeAsync(29_999);
    let done = false; p2.then(() => { done = true; });
    await Promise.resolve(); expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p2).toMatchObject({ status: 'error', code: 'request-expired', manualEntryAvailable: true, requiresConfirmation: true });
    two.h.s!(pos(40.001, -75.001)); // late success after expiry is ignored
    expect(await p2).toMatchObject({ code: 'request-expired' });
    const three = held();
    const p3 = requestCurrentLocation(cities, { geolocation: three.geo });
    three.h.f!({ code: 3 } as GeolocationPositionError);
    expect(await p3).toMatchObject({ code: 'timeout' });
    expect((await p3 as { message: string }).message).toMatch(/browser could not acquire/);
  });

  test('M4 (L4, unchanged) late and duplicate callbacks ignored; no timers remain', async () => {
    const { requestCurrentLocation } = await load();
    vi.useFakeTimers();
    const x = held();
    const p1 = requestCurrentLocation(cities, { geolocation: x.geo });
    x.h.s!(pos(40.001, -75.001)); x.h.s!(pos(41, -74)); x.h.f!({ code: 1 } as GeolocationPositionError);
    expect(await p1).toMatchObject({ status: 'suggestion', nearestCity: { id: 'a' } });
    const p2 = requestCurrentLocation(cities, { geolocation: x.geo });
    x.h.f!({ code: 2 } as GeolocationPositionError); x.h.s!(pos(40, -75));
    expect(await p2).toMatchObject({ status: 'error', code: 'unavailable' });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('M5 (L5, contract changed: H3 fix) pre-aborted signal: cancelled, geolocation never called, no timer/listener', async () => {
    const { requestCurrentLocation } = await load();
    vi.useFakeTimers();
    const ctrl = new AbortController(); ctrl.abort();
    const add = vi.spyOn(ctrl.signal, 'addEventListener');
    const geo = ok(pos(40, -75));
    expect(await requestCurrentLocation(cities, { geolocation: geo, signal: ctrl.signal })).toMatchObject({ status: 'error', code: 'cancelled', manualEntryAvailable: true });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  test('M6 in-flight abort: cancelled, timer cleared, listener removed, late success never reads coordinates', async () => {
    const { requestCurrentLocation } = await load();
    vi.useFakeTimers();
    const ctrl = new AbortController();
    const add = vi.spyOn(ctrl.signal, 'addEventListener'); const remove = vi.spyOn(ctrl.signal, 'removeEventListener');
    const x = held();
    const p = requestCurrentLocation(cities, { geolocation: x.geo, signal: ctrl.signal });
    expect(vi.getTimerCount()).toBe(1);
    ctrl.abort();
    expect(await p).toMatchObject({ code: 'cancelled' });
    expect(vi.getTimerCount()).toBe(0);
    expect(add).toHaveBeenCalledTimes(1); expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0][1]).toBe(add.mock.calls[0][1]);
    const read = vi.fn();
    x.h.s!({ get coords() { read(); return { latitude: 40, longitude: -75, accuracy: 5 }; } } as unknown as GeolocationPosition);
    x.h.f!({ code: 1 } as GeolocationPositionError);
    expect(read).not.toHaveBeenCalled();
    expect(await p).toMatchObject({ code: 'cancelled' });
  });

  test('M7 listener removed on every settle path (success, error, expiry); abort after settle is a no-op', async () => {
    const { requestCurrentLocation } = await load();
    vi.useFakeTimers();
    for (const settle of ['success', 'error', 'expire'] as const) {
      const ctrl = new AbortController(); const remove = vi.spyOn(ctrl.signal, 'removeEventListener');
      const x = held();
      const p = requestCurrentLocation(cities, { geolocation: x.geo, signal: ctrl.signal, waitLimitMs: 1000 });
      if (settle === 'success') x.h.s!(pos(40.001, -75.001));
      if (settle === 'error') x.h.f!({ code: 2 } as GeolocationPositionError);
      if (settle === 'expire') await vi.advanceTimersByTimeAsync(1000);
      const r = await p; ctrl.abort();
      expect(await p).toBe(r);
      expect(remove).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    }
  });

  test('M8 concurrent requests are independent: aborting one does not affect the other', async () => {
    const { requestCurrentLocation } = await load();
    const c1 = new AbortController(); const x1 = held(); const x2 = held();
    const p1 = requestCurrentLocation(cities, { geolocation: x1.geo, signal: c1.signal });
    const p2 = requestCurrentLocation(cities, { geolocation: x2.geo });
    c1.abort(); x2.h.s!(pos(41.001, -74.001));
    expect(await p1).toMatchObject({ code: 'cancelled' });
    expect(await p2).toMatchObject({ status: 'suggestion', nearestCity: { id: 'b', state: 'NJ' } });
  });

  test.each([
    ['NaN lat', pos(NaN, 0)], ['+Inf lon', pos(0, Infinity)], ['lat 90.0001', pos(90.0001, 0)], ['lon -180.0001', pos(0, -180.0001)],
    ['accuracy NaN', pos(0, 0, NaN)], ['accuracy -1', pos(0, 0, -1)], ['accuracy null', pos(0, 0, null)], ['lat string', pos('40', 0)],
    ['position null', null], ['coords missing', {}],
  ])('M9 (L6, plus null position / missing coords) malformed %s -> unavailable', async (_n, p) => {
    const { requestCurrentLocation } = await load();
    const r = await requestCurrentLocation(cities, { geolocation: { getCurrentPosition: (s: PositionCallback) => s(p as GeolocationPosition) } });
    expect(r).toMatchObject({ status: 'error', code: 'unavailable', manualEntryAvailable: true });
  });

  test('M10 (L8, unchanged boundaries; cities now carry state) default 50 km with uncertaintyKm 1.0', async () => {
    const { requestCurrentLocation } = await load();
    const at = async (km: number, maxDistanceKm?: number) => {
      const r = await requestCurrentLocation([{ id: 'c', name: 'C', state: 'PA', latitude: 0, longitude: km / KM_PER_DEG }],
        { geolocation: ok(pos(0, 0, 200)), ...(maxDistanceKm ? { maxDistanceKm } : {}) });
      if (r.status !== 'suggestion') throw new Error('expected suggestion');
      expect(r).toMatchObject({ uncertaintyKm: 1, distanceReference: 'catalogue-representative-point', requiresConfirmation: true, manualEntryAvailable: true });
      return r.proximity;
    };
    expect(await at(48.9)).toBe('nearby'); expect(await at(49.1)).toBe('uncertain');
    expect(await at(50.9)).toBe('uncertain'); expect(await at(51.1)).toBe('faraway');
    expect(await at(98.9, 100)).toBe('nearby');
  });

  test('M11 (L9, contract changed: H6 fix) exact ties pick the lowest codepoint ID regardless of input order, still uncertain', async () => {
    const { requestCurrentLocation } = await load();
    const e = { id: 'east', name: 'East', state: 'PA', latitude: 0, longitude: 0.2 };
    const w = { id: 'west', name: 'West', state: 'PA', latitude: 0, longitude: -0.2 };
    for (const list of [[e, w], [w, e]]) expect(await requestCurrentLocation(list, { geolocation: ok(pos(0, 0)) })).toMatchObject({ nearestCity: { id: 'east' }, proximity: 'uncertain' });
    const up = { ...w, id: 'Zed' }; const low = { ...e, id: 'alpha' };
    expect(await requestCurrentLocation([low, up], { geolocation: ok(pos(0, 0)) })).toMatchObject({ nearestCity: { id: 'Zed' } }); // codepoint: 'Z' < 'a'
  });

  test('M12 (L10, unchanged) zero / one / many places', async () => {
    const { requestCurrentLocation } = await load();
    const geo = ok(pos(0, 0));
    expect(await requestCurrentLocation([], { geolocation: geo })).toMatchObject({ code: 'invalid-catalogue' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(await requestCurrentLocation([{ id: 'o', name: 'O', state: 'PA', latitude: 0, longitude: 0.05 }], { geolocation: ok(pos(0, 0)) })).toMatchObject({ nearestCity: { id: 'o' }, proximity: 'nearby' });
  });

  test.each([
    ['blank id', { id: ' ' }], ['padded id', { id: ' a' }], ['blank name', { name: '  ' }], ['padded name', { name: 'City A ' }],
    ['lower-case state', { state: 'pa' }], ['padded state', { state: 'PA ' }], ['3-letter state', { state: 'PAX' }], ['missing state', { state: undefined }],
    ['numeric id', { id: 7 }], ['null coordinate', { latitude: null }],
  ])('M13 (L11, contract changed: H6 fix) %s -> invalid-catalogue before geolocation', async (_n, patch) => {
    const { requestCurrentLocation } = await load();
    const geo = ok(pos(0, 0));
    expect(await requestCurrentLocation([{ ...cities[0], ...patch } as unknown as City], { geolocation: geo })).toMatchObject({ code: 'invalid-catalogue' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  test.each([{ timeoutMs: 100.5 }, { waitLimitMs: 0 }, { waitLimitMs: Infinity }, { waitLimitMs: 2_147_483_648 }, { maxDistanceKm: NaN }])(
    'M14 invalid options %o -> unavailable before geolocation (non-integer timeoutMs newly rejected)', async (options) => {
      const { requestCurrentLocation } = await load();
      const geo = ok(pos(0, 0));
      expect(await requestCurrentLocation(cities, { ...options, geolocation: geo })).toMatchObject({ code: 'unavailable' });
      expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    });

  test('M15 (L12, contract changed: H5 fix) no coordinates returned; no network/storage/cookie/URL/console calls', async () => {
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
    const ctrl = new AbortController(); const pending = requestCurrentLocation(cities, { geolocation: held().geo, signal: ctrl.signal }); ctrl.abort();
    const e = [await pending, await requestCurrentLocation(cities, { geolocation: { getCurrentPosition: (_s: PositionCallback, f?: PositionErrorCallback | null) => f?.({ code: 1, message: '40.123456789' } as GeolocationPositionError) } })];
    expect(forbidden).not.toHaveBeenCalled();
    expect(r.status).toBe('suggestion');
    expect('coordinates' in r).toBe(false);
    expect(Object.keys(r).sort()).toEqual(['distanceKm', 'distanceReference', 'manualEntryAvailable', 'nearestCity', 'proximity', 'requiresConfirmation', 'status', 'uncertaintyKm']);
    expect(JSON.stringify([r, ...e])).not.toMatch(/40\.12|75\.98|75\.99/);
  });

  test('M16 every outcome carries requiresConfirmation and manualEntryAvailable; nothing selects an origin', async () => {
    const { requestCurrentLocation } = await load();
    const outcomes = [
      await requestCurrentLocation(cities, { geolocation: ok(pos(40.001, -75.001)) }),
      await requestCurrentLocation(cities, { geolocation: null }),
      await requestCurrentLocation([], { geolocation: ok(pos(0, 0)) }),
      await requestCurrentLocation(cities, { geolocation: { getCurrentPosition: () => { throw new DOMException('x', 'SecurityError'); } } }),
    ];
    for (const o of outcomes) expect(o).toMatchObject({ requiresConfirmation: true, manualEntryAvailable: true });
    expect(outcomes.map(o => o.status === 'error' ? o.code : o.status)).toEqual(['suggestion', 'unsupported', 'invalid-catalogue', 'permission-denied']);
    for (const o of outcomes) expect(JSON.stringify(o)).not.toMatch(/origin"\s*:/);
  });

  test.skipIf(!process.env.P4_23_DUMP || !process.env.P4_23_EXTRA)('M17 (L14, catalogue #27 fc844f7) verifiedMarketChoices adapter is valid; state disambiguates; full audit list rejected', async () => {
    const { requestCurrentLocation } = await load();
    const dump = JSON.parse(readFileSync(process.env.P4_23_DUMP!, 'utf8'));
    const extra = JSON.parse(readFileSync(process.env.P4_23_EXTRA!, 'utf8'));
    const byId = new Map<string, City & { auditStatus: string; coordinateMethod: string }>(dump.nationalCities.map((c: City & { auditStatus: string; coordinateMethod: string }) => [c.id, c]));
    // Adapter exactly as outlined in LOCATION_HELPER.md
    const supported: City[] = (extra.choices as string[]).map(id => byId.get(id)!).flatMap(city =>
      city.auditStatus !== 'verified' || city.coordinateMethod === 'unavailable' || typeof city.latitude !== 'number' || typeof city.longitude !== 'number' ||
      !Number.isFinite(city.latitude) || !Number.isFinite(city.longitude) ? [] : [{ id: city.id, name: city.name, state: city.state, latitude: city.latitude, longitude: city.longitude }]);
    expect(supported.length).toBe(1371);
    const por = supported.find(c => c.id === 'portland-or')!;
    expect(await requestCurrentLocation(supported, { geolocation: ok(pos(por.latitude, por.longitude, 50)) })).toMatchObject({ nearestCity: { id: 'portland-or', name: 'Portland', state: 'OR' } });
    const boise = byId.get('boise-city-id')!; // alias row is not a choice; its point resolves to the nearest choice
    const rb = await requestCurrentLocation(supported, { geolocation: ok(pos(boise.latitude, boise.longitude, 50)) });
    expect(rb).toMatchObject({ status: 'suggestion' });
    expect((rb as { nearestCity: { id: string } }).nearestCity.id).not.toBe('boise-city-id');
    console.info('M17 boise-city-id point ->', JSON.stringify((rb as { nearestCity: object }).nearestCity), (rb as { distanceKm: number }).distanceKm, (rb as { proximity: string }).proximity);
    const all = dump.nationalCities.map((c: City) => ({ id: c.id, name: c.name, state: c.state, latitude: c.latitude, longitude: c.longitude }));
    expect(await requestCurrentLocation(all, { geolocation: ok(pos(0, 0)) })).toMatchObject({ code: 'invalid-catalogue' });
    const raw = dump.nationalCities.filter((c: City) => new Set(dump.verifiedIds).has((c as { id: string }).id)).map((c: City) => ({ id: c.id, name: c.name, state: c.state, latitude: c.latitude, longitude: c.longitude }));
    expect(raw.length).toBe(1374);
    expect((await requestCurrentLocation(raw, { geolocation: ok(pos(0, 0)) })).status).toBe('suggestion'); // raw rows also valid; aliases would be duplicate choices
  });
});
