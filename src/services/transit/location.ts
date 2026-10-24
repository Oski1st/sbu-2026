/**
 * Optional, local-only location suggestion contract for Person 1.
 * Browser API reference: https://www.w3.org/TR/geolocation/
 * Requires browser permission and a secure context (HTTPS or localhost).
 *
 * Call requestCurrentLocation(catalogue) ONLY in the “Use my location” click
 * handler, never on render/mount. No location request occurs at import time.
 * Pass the current supported catalogue with representative city-centre coordinates;
 * this module deliberately owns no second list of supported cities. Coordinates
 * must describe city centres, not stations or claimed user positions.
 *
 * Render manual origin input in loading, success AND error states. A result never
 * selects an origin: offer nearestCity.name + distanceKm for explicit confirmation.
 * Show “approximate location”, uncertaintyKm and “distance to city centre (straight
 * line, not a route)”. Faraway/uncertain matches must NOT be silently selected.
 * These suggestions do not establish transit service or ticket availability.
 *
 * Raw browser coordinates are used only inside the callback and never returned,
 * persisted, logged, placed in URLs or sent over the network. Returned coordinates
 * are rounded to 0.01 degrees (roughly 1 km); uncertainty includes that rounding.
 * Keep even these approximate coordinates in transient UI memory only. Passing an
 * origin city ID onward is sufficient; do not serialize this result into URLs.
 * A browser/OS location provider may use its own services under browser permission;
 * this module makes no third-party requests and cannot control that provider.
 *
 * Example (Search integration belongs to Person 1):
 * onClick={async () => setLocation(await requestCurrentLocation(supportedCities))}
 * Ignore results from obsolete requests when a user edits origin or leaves Search.
 */
export interface LocationCity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export type LocationErrorCode =
  | 'unsupported' | 'permission-denied' | 'timeout' | 'unavailable' | 'invalid-catalogue';

export type LocationResult = {
  status: 'suggestion';
  coordinates: { latitude: number; longitude: number; precisionDegrees: 0.01 };
  /** Reported browser accuracy radius plus coordinate rounding; not a guarantee. */
  uncertaintyKm: number;
  nearestCity: { id: string; name: string };
  /** Approximate great-circle distance from rounded position to city centre. */
  distanceKm: number;
  proximity: 'nearby' | 'faraway' | 'uncertain';
  requiresConfirmation: true;
  manualEntryAvailable: true;
} | {
  status: 'error';
  code: LocationErrorCode;
  message: string;
  manualEntryAvailable: true;
};

type PositionProvider = Pick<Geolocation, 'getCurrentPosition'>;
export interface LocationOptions {
  /** Default 50 km. An uncertain error radius crossing this boundary is flagged. */
  maxDistanceKm?: number;
  /** Default 10 seconds; also enforced if the browser never calls either callback. */
  timeoutMs?: number;
  /** Testing/unsupported-browser override; omit for lazy browser feature detection. */
  geolocation?: PositionProvider | null;
}

const messages: Record<LocationErrorCode, string> = {
  unsupported: 'Location is not supported here. Enter your origin manually.',
  'permission-denied': 'Location permission was denied. Enter your origin manually.',
  timeout: 'Location took too long. Try again or enter your origin manually.',
  unavailable: 'Your location is unavailable. Enter your origin manually.',
  'invalid-catalogue': 'Supported city locations are unavailable. Enter your origin manually.',
};
const error = (code: LocationErrorCode): LocationResult => ({
  status: 'error', code, message: messages[code], manualEntryAvailable: true,
});
const validPoint = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
  Number.isFinite(longitude) && Math.abs(longitude) <= 180;
const roundUp = (n: number) => Math.ceil(n * 10) / 10;
const radians = (n: number) => n * Math.PI / 180;
function distance(lat: number, lon: number, city: LocationCity): number {
  const a = Math.sin(radians(city.latitude - lat) / 2) ** 2 +
    Math.cos(radians(lat)) * Math.cos(radians(city.latitude)) *
    Math.sin(radians(city.longitude - lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

/** One user-initiated request. Resolves a discriminated result for valid typed inputs and browser failures. */
export async function requestCurrentLocation(
  catalogue: readonly LocationCity[],
  options: LocationOptions = {},
): Promise<LocationResult> {
  // Copy inputs so later catalogue edits cannot change an in-flight suggestion.
  const cities = catalogue.map(city => ({ ...city }));
  if (!cities.length || cities.some(city => !city.id || !city.name ||
    !validPoint(city.latitude, city.longitude)) ||
    new Set(cities.map(city => city.id)).size !== cities.length) {
    return error('invalid-catalogue');
  }
  const maxDistance = options.maxDistanceKm ?? 50;
  const timeout = options.timeoutMs ?? 10_000;
  if (!Number.isFinite(maxDistance) || maxDistance <= 0 ||
    !Number.isFinite(timeout) || timeout <= 0 || timeout > 2_147_483_647) {
    return error('unavailable');
  }
  return new Promise(resolve => {
    let settled = false;
    const finish = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish(error('timeout')), timeout);
    try {
      const provider = options.geolocation === undefined
        ? (typeof navigator === 'undefined' ? null : navigator.geolocation)
        : options.geolocation;
      if (!provider) { finish(error('unsupported')); return; }
      provider.getCurrentPosition(position => {
        if (settled) return;
        const { latitude, longitude, accuracy } = position.coords;
        if (!validPoint(latitude, longitude) || !Number.isFinite(accuracy) || accuracy < 0) {
          finish(error('unavailable')); return;
        }
        const lat = Math.round(latitude * 100) / 100;
        const lon = Math.round(longitude * 100) / 100;
        // Maximum rounding displacement is <0.8 km anywhere on Earth.
        const uncertaintyKm = roundUp(accuracy / 1000 + 0.8);
        const ranked = cities.map(city => ({ city, km: distance(lat, lon, city) }))
          .sort((a, b) => a.km - b.km);
        const nearest = ranked[0];
        // Poor accuracy or an ambiguous nearest city must be explicit to callers.
        const ambiguous = ranked.length > 1 &&
          ranked[1].km - nearest.km <= 2 * uncertaintyKm;
        const proximity = nearest.km - uncertaintyKm > maxDistance ? 'faraway'
          : ambiguous || nearest.km + uncertaintyKm > maxDistance ? 'uncertain' : 'nearby';
        finish({
          status: 'suggestion',
          coordinates: { latitude: lat, longitude: lon, precisionDegrees: 0.01 },
          uncertaintyKm,
          nearestCity: { id: nearest.city.id, name: nearest.city.name },
          distanceKm: Math.round(nearest.km * 10) / 10,
          proximity, requiresConfirmation: true, manualEntryAvailable: true,
        });
      }, failure => finish(error(failure.code === 1 ? 'permission-denied'
        : failure.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: false, maximumAge: 0, timeout });
    } catch (failure) {
      finish(error(failure instanceof Error && failure.name === 'SecurityError'
        ? 'permission-denied' : 'unavailable'));
    }
  });
}
