import { afterEach, expect, test, vi } from 'vitest';
import { requestCurrentLocation } from './location';
import type { LocationCity } from './location';

// Synthetic representative points and browser positions: no real user location is used.
const cities: LocationCity[] = [
  { id: 'a', name: 'City A', state: 'PA', latitude: 40, longitude: -75 },
  { id: 'b', name: 'City B', state: 'NJ', latitude: 41, longitude: -74 },
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

test('returns state-disambiguated place and representative distance without returning coordinates', async () => {
  const result = await requestCurrentLocation(cities, { geolocation: provider(position(40.12345, -75.12345)) });
  expect(result).toMatchObject({
    status: 'suggestion', distanceReference: 'catalogue-representative-point',
    nearestCity: { id: 'a', name: 'City A', state: 'PA' }, proximity: 'nearby',
    uncertaintyKm: 0.9, requiresConfirmation: true, manualEntryAvailable: true,
  });
  if (result.status === 'suggestion') expect(result.distanceKm).toBeCloseTo(16.8, 0);
  expect(JSON.stringify(result)).not.toContain('40.12345');
  expect(result).not.toHaveProperty('coordinates');
  expect(cities[0].latitude).toBe(40);
});

test('faraway city is labelled and still requires explicit confirmation', async () => {
  expect(await requestCurrentLocation(cities, { geolocation: provider(position(0, 0)) }))
    .toMatchObject({ status: 'suggestion', proximity: 'faraway', requiresConfirmation: true, manualEntryAvailable: true });
});

test('large accuracy radius and competing nearby representative points are uncertain', async () => {
  for (const geo of [provider(position(40, -75, 100_000)), provider(position(40.5, -74.5, 2000))]) {
    expect(await requestCurrentLocation(cities, { geolocation: geo, maxDistanceKm: 100 }))
      .toMatchObject({ status: 'suggestion', proximity: 'uncertain', requiresConfirmation: true });
  }
});

test('distance uses great-circle geometry, including antimeridian and poles', async () => {
  const catalogue = [{ id: 'east', name: 'East', state: 'ME', latitude: 0, longitude: 179.9 }];
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

test('application wait limit resolves a silent provider separately from browser timeout and ignores late callbacks', async () => {
  vi.useFakeTimers();
  let success!: PositionCallback;
  const geo = { getCurrentPosition: (ok: PositionCallback) => { success = ok; } };
  const pending = requestCurrentLocation(cities, { geolocation: geo, waitLimitMs: 100 });
  await vi.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(result).toMatchObject({ code: 'request-expired', manualEntryAvailable: true });
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

test('permission-wait duration is unknown; a12s callback is not discarded by10s acquisition option', async () => {
  vi.useFakeTimers();
  let success!: PositionCallback;
  const geo = { getCurrentPosition: vi.fn((ok: PositionCallback) => { success = ok; }) };
  const pending = requestCurrentLocation(cities, { geolocation: geo });
  const resolved = vi.fn(); void pending.then(resolved);
  await vi.advanceTimersByTimeAsync(12_000);
  expect(resolved).not.toHaveBeenCalled();
  expect(geo.getCurrentPosition.mock.calls[0][0]).toBe(success);
  success(position());
  expect(await pending).toMatchObject({status:'suggestion',manualEntryAvailable:true,requiresConfirmation:true});
  expect(vi.getTimerCount()).toBe(0);
});

test('default30s application limit never claims browser acquisition or permission timing', async () => {
  vi.useFakeTimers();
  const pending = requestCurrentLocation(cities, { geolocation: {getCurrentPosition: () => {}} });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(await pending).toMatchObject({code:'request-expired',manualEntryAvailable:true,requiresConfirmation:true});
  expect(await pending).not.toHaveProperty('coordinates');
  expect(vi.getTimerCount()).toBe(0);
});

test('browser code3 remains acquisition timeout even before the separate application limit', async () => {
  vi.useFakeTimers();
  let fail!: PositionErrorCallback;
  const pending = requestCurrentLocation(cities, { timeoutMs:100,waitLimitMs:30_000,
    geolocation:{getCurrentPosition: (_ok, error) => {fail = error!;}} });
  await vi.advanceTimersByTimeAsync(100);
  fail({code:3,message:'private provider detail'} as GeolocationPositionError);
  expect(await pending).toMatchObject({code:'timeout',manualEntryAvailable:true,requiresConfirmation:true});
  expect(vi.getTimerCount()).toBe(0);
});

test('pre-aborted request never asks the provider or creates timers', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();controller.abort();
  const geo = provider();
  expect(await requestCurrentLocation(cities,{signal:controller.signal,geolocation:geo}))
    .toMatchObject({code:'cancelled',manualEntryAvailable:true,requiresConfirmation:true});
  expect(geo.getCurrentPosition).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});

test('abort settles once, cleans listener/timer and ignores late success/error without reading coordinates', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const remove = vi.spyOn(controller.signal,'removeEventListener');
  let success!: PositionCallback;let failure!: PositionErrorCallback;
  const pending = requestCurrentLocation(cities,{signal:controller.signal,
    geolocation:{getCurrentPosition:(ok,fail) => {success=ok;failure=fail!;}}});
  controller.abort();const result = await pending;
  expect(result).toMatchObject({code:'cancelled',requiresConfirmation:true,manualEntryAvailable:true});
  const read = vi.fn(() => position().coords);
  success({get coords(){return read();}} as GeolocationPosition);
  failure({code:1} as GeolocationPositionError);
  expect(read).not.toHaveBeenCalled();expect(await pending).toBe(result);
  expect(remove).toHaveBeenCalledWith('abort',expect.any(Function));expect(vi.getTimerCount()).toBe(0);
});

test.each(['success','error','expiry','unsupported','throw'] as const)('%s removes abort listener and timer', async kind => {
  vi.useFakeTimers();const controller=new AbortController();
  const remove=vi.spyOn(controller.signal,'removeEventListener');
  const geo=kind==='unsupported'?null:{getCurrentPosition:(ok:PositionCallback,fail?:PositionErrorCallback|null)=>{
    if(kind==='success')ok(position());
    if(kind==='error')fail?.({code:2} as GeolocationPositionError);
    if(kind==='throw')throw new Error('private');
  }};
  const pending=requestCurrentLocation(cities,{signal:controller.signal,geolocation:geo,waitLimitMs:50});
  if(kind==='expiry')await vi.advanceTimersByTimeAsync(50);
  await pending;expect(remove).toHaveBeenCalledWith('abort',expect.any(Function));expect(vi.getTimerCount()).toBe(0);
});

test('a replacement request is independent of the aborted old provider', async () => {
  const controller=new AbortController();let oldSuccess!:PositionCallback;
  const old=requestCurrentLocation(cities,{signal:controller.signal,geolocation:{getCurrentPosition:ok=>{oldSuccess=ok;}}});
  controller.abort();
  const current=await requestCurrentLocation(cities,{geolocation:provider(position(41,-74))});
  oldSuccess(position());expect(await old).toMatchObject({code:'cancelled'});
  expect(current).toMatchObject({nearestCity:{id:'b',state:'NJ'}});
});

test('representative points need not be city centres; output identifies the point distance, never the rider point', async () => {
  // Qualified catalogue point fixture deliberately distinct from any supposed downtown.
  const result=await requestCurrentLocation([{id:'market',name:'Large Place',state:'AK',latitude:0.5,longitude:0}],
    {geolocation:provider(position(0,0,200))});
  expect(result).toMatchObject({distanceReference:'catalogue-representative-point',distanceKm:55.6,
    proximity:'faraway',nearestCity:{id:'market',name:'Large Place',state:'AK'},requiresConfirmation:true,manualEntryAvailable:true});
  for(const field of ['coordinates','latitude','longitude'])expect(result).not.toHaveProperty(field);
});

test('same-named places retain their state; exact ties use stable IDs rather than input order', async () => {
  const portlands=[{id:'portland-or',name:'Portland',state:'OR',latitude:0,longitude:0},
    {id:'portland-me',name:'Portland',state:'ME',latitude:0,longitude:0}];
  for(const catalogue of [portlands,[...portlands].reverse()]){
    expect(await requestCurrentLocation(catalogue,{geolocation:provider(position(0,0))}))
      .toMatchObject({nearestCity:{id:'portland-me',name:'Portland',state:'ME'},proximity:'uncertain',requiresConfirmation:true});
  }
});

test.each([{id:' '},{name:'\t'},{state:' '},{state:'or'},{id:' a'},{name:'City A '}])(
  'blank/padded identity or ambiguous state rejects before permission request: %j',async change=>{
    const geo=provider();expect(await requestCurrentLocation([{...cities[0],...change}],{geolocation:geo}))
      .toMatchObject({code:'invalid-catalogue',manualEntryAvailable:true,requiresConfirmation:true});
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

test.each([[48.9,'nearby'],[49.1,'uncertain'],[50.9,'uncertain'],[51.1,'faraway']] as const)(
  'default50km boundary retains uncertainty at%s km',async(km,proximity)=>{
    const city={id:'point',name:'Place',state:'ME',latitude:km/6371*180/Math.PI,longitude:0};
    expect(await requestCurrentLocation([city],{geolocation:provider(position(0,0,200))}))
      .toMatchObject({proximity,uncertaintyKm:1,requiresConfirmation:true,manualEntryAvailable:true});
  });

test('malformed asynchronous position fails safely and ignores duplicate callbacks',async()=>{
  let callback!:PositionCallback;
  const pending=requestCurrentLocation(cities,{geolocation:{getCurrentPosition:ok=>{callback=ok;}}});
  callback({} as GeolocationPosition);const result=await pending;
  expect(result).toMatchObject({code:'unavailable',manualEntryAvailable:true});
  callback(position());expect(await pending).toBe(result);
});

test.each([{waitLimitMs:0},{waitLimitMs:Infinity},{waitLimitMs:2_147_483_648},{timeoutMs:0.5}])(
  'invalid new timing options fail before provider request: %j',async options=>{
    const geo=provider();expect(await requestCurrentLocation(cities,{...options,geolocation:geo})).toMatchObject({code:'unavailable'});
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });
