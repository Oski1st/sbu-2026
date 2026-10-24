import { afterEach, expect, test, vi } from 'vitest';
import { requestCurrentLocation } from './location';
import type { LocationCity } from './location';

// Synthetic city centres and browser positions: no real user location is used.
const cities: LocationCity[] = [
  { id: 'a', name: 'City A', latitude: 40, longitude: -75 },
  { id: 'b', name: 'City B', latitude: 41, longitude: -74 },
];
const position = (latitude = 40.00123, longitude = -75.00456, accuracy = 20) => ({
  coords: { latitude, longitude, accuracy },
} as GeolocationPosition);
const provider = (p = position()) => ({
  getCurrentPosition: vi.fn((success: PositionCallback) => success(p)),
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('import has no location side effect; only an explicit request invokes browser geolocation', async () => {
  const geo = provider();
  vi.stubGlobal('navigator', { geolocation: geo });
  vi.resetModules();
  const module = await import('./location');
  expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  await module.requestCurrentLocation(cities);
  expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(geo.getCurrentPosition.mock.calls[0]).toEqual([
    expect.any(Function), expect.any(Function),
    { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 },
  ]);
});

test('returns rounded position, nearest supported city and distance without substituting city centre', async () => {
  const result = await requestCurrentLocation(cities, { geolocation: provider(position(40.12345, -75.12345)) });
  expect(result).toMatchObject({
    status: 'suggestion', coordinates: { latitude: 40.12, longitude: -75.12, precisionDegrees: 0.01 },
    nearestCity: { id: 'a', name: 'City A' }, proximity: 'nearby',
    uncertaintyKm: 0.9, requiresConfirmation: true, manualEntryAvailable: true,
  });
  if (result.status === 'suggestion') expect(result.distanceKm).toBeCloseTo(16.8, 0);
  expect(JSON.stringify(result)).not.toContain('40.12345');
  expect(cities[0].latitude).toBe(40);
});

test('faraway city is labelled and still requires explicit confirmation', async () => {
  expect(await requestCurrentLocation(cities, { geolocation: provider(position(0, 0)) }))
    .toMatchObject({ status: 'suggestion', proximity: 'faraway', requiresConfirmation: true, manualEntryAvailable: true });
});

test('large accuracy radius and competing nearby centres are uncertain', async () => {
  for (const geo of [provider(position(40, -75, 100_000)), provider(position(40.5, -74.5, 2000))]) {
    expect(await requestCurrentLocation(cities, { geolocation: geo, maxDistanceKm: 100 }))
      .toMatchObject({ status: 'suggestion', proximity: 'uncertain', requiresConfirmation: true });
  }
});

test('distance uses great-circle geometry, including antimeridian and poles', async () => {
  const catalogue = [{ id: 'east', name: 'East', latitude: 0, longitude: 179.9 }];
  const result = await requestCurrentLocation(catalogue, { geolocation: provider(position(0, -179.9)) });
  expect(result).toMatchObject({ distanceKm: 22.2, proximity: 'nearby' });
  const polar = await requestCurrentLocation([{ ...catalogue[0], latitude: -90 }], {
    geolocation: provider(position(90, 0)),
  });
  if (polar.status === 'suggestion') expect(polar.distanceKm).toBeCloseTo(20015.1, 0);
});

test.each([[1, 'permission-denied'], [2, 'unavailable'], [3, 'timeout'], [99, 'unavailable']] as const)(
  'browser error %s maps to %s without exposing provider details', async (code, expected) => {
    const geo = { getCurrentPosition: vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback | null) => {
      fail?.({ code, message: 'private provider detail' } as GeolocationPositionError);
    }) };
    const result = await requestCurrentLocation(cities, { geolocation: geo });
    expect(result).toMatchObject({ status: 'error', code: expected, manualEntryAvailable: true });
    expect(JSON.stringify(result)).not.toContain('private provider detail');
  },
);

test('unsupported and server environments return manual-entry fallback', async () => {
  vi.stubGlobal('navigator', undefined);
  expect(await requestCurrentLocation(cities)).toMatchObject({ code: 'unsupported', manualEntryAvailable: true });
  expect(await requestCurrentLocation(cities, { geolocation: null })).toMatchObject({ code: 'unsupported' });
});

test.each([new Error('private detail'), new DOMException('blocked', 'SecurityError')])(
  'synchronous provider failure resolves safely', async failure => {
    const result = await requestCurrentLocation(cities, { geolocation: {
      getCurrentPosition: () => { throw failure; },
    } });
    expect(result).toMatchObject({ status: 'error', code: failure.name === 'SecurityError' ? 'permission-denied' : 'unavailable' });
  },
);

test('watchdog resolves a silent provider and ignores late callbacks', async () => {
  vi.useFakeTimers();
  let success!: PositionCallback;
  const geo = { getCurrentPosition: (ok: PositionCallback) => { success = ok; } };
  const pending = requestCurrentLocation(cities, { geolocation: geo, timeoutMs: 100 });
  await vi.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(result).toMatchObject({ code: 'timeout', manualEntryAvailable: true });
  success(position());
  expect(await pending).toBe(result);
  expect(vi.getTimerCount()).toBe(0);
});

test('completed requests clear watchdog and allow a clean retry after failure', async () => {
  vi.useFakeTimers();
  await requestCurrentLocation(cities, { geolocation: null });
  expect((await requestCurrentLocation(cities, { geolocation: provider() })).status).toBe('suggestion');
  expect(vi.getTimerCount()).toBe(0);
});

test.each([
  [], [{ ...cities[0], latitude: NaN }], [{ ...cities[0], longitude: 181 }],
  [{ ...cities[0], id: '' }], [cities[0], cities[0]],
].map(catalogue => [catalogue] as const))('invalid catalogue never requests location', async catalogue => {
  const geo = provider();
  expect(await requestCurrentLocation(catalogue, { geolocation: geo })).toMatchObject({ code: 'invalid-catalogue' });
  expect(geo.getCurrentPosition).not.toHaveBeenCalled();
});

test.each([position(NaN), position(91), position(0, Infinity), position(0, 0, -1)])(
  'invalid browser coordinate or accuracy fails honestly', async p => {
    expect(await requestCurrentLocation(cities, { geolocation: provider(p) })).toMatchObject({ code: 'unavailable' });
  },
);

test('no network, storage or URL writes; catalogue is copied before async callback', async () => {
  const forbidden = vi.fn(() => { throw new Error('forbidden side effect'); });
  vi.stubGlobal('fetch', forbidden);
  vi.stubGlobal('localStorage', { setItem: forbidden });
  vi.stubGlobal('sessionStorage', { setItem: forbidden });
  vi.stubGlobal('history', { pushState: forbidden, replaceState: forbidden });
  let callback!: PositionCallback;
  const catalogue = cities.map(city => ({ ...city }));
  const pending = requestCurrentLocation(catalogue, { geolocation: {
    getCurrentPosition: success => { callback = success; },
  } });
  catalogue[0].name = 'mutated';
  callback(position());
  expect(await pending).toMatchObject({ nearestCity: { name: 'City A' } });
  expect(forbidden).not.toHaveBeenCalled();
});

test.each([{ timeoutMs: 0 }, { timeoutMs: Infinity }, { maxDistanceKm: -1 }, { maxDistanceKm: NaN }])(
  'invalid request options fail before geolocation', async options => {
    const geo = provider();
    expect(await requestCurrentLocation(cities, { ...options, geolocation: geo })).toMatchObject({ code: 'unavailable' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  },
);
