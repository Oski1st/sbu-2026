/**
 * Optional local-only suggestion; see LOCATION_HELPER.md for the caller contract.
 * Call ONLY from the user's “Use my location” click, never render/mount/import.
 * Pass eligible, null-free supported places, each with state and a qualified
 * representative point. Internal/stop-representative points need not be downtown.
 * Keep manual entry visible while waiting and after every outcome. Never select
 * an origin automatically; display state, distance reference and uncertainty and
 * ask for confirmation, including nearby/faraway/ambiguous suggestions.
 *
 * Browser acquisition timeout excludes permission/visibility waiting:
 * https://www.w3.org/TR/geolocation/#timeout-member
 * The separate application wait limit includes all elapsed time. We cannot
 * observe when permission waiting ends or acquisition begins. Expiring/cancelling
 * this request only ignores callbacks; it cannot dismiss the permission prompt
 * or stop the browser/OS provider. The provider may use its own services.
 *
 * Raw coordinates are transient inside the callback. Matching uses 0.01-degree
 * rounding plus uncertainty, but NO coordinates are returned, stored, logged,
 * serialized into URLs or sent over a network by this module.
 */
export interface LocationCity {
  id: string;
  name: string;
  /** State code for unambiguous labels, e.g. Portland ME versus Portland OR. */
  state: string;
  /** Qualified catalogue representative point, not a rider or guaranteed centre. */
  latitude: number;
  longitude: number;
}

export type LocationErrorCode =
  | 'unsupported' | 'permission-denied' | 'timeout' | 'request-expired'
  | 'cancelled' | 'unavailable' | 'invalid-catalogue';

export type LocationResult = {
  status: 'suggestion';
  /** Browser accuracy radius plus rounding; not a guarantee or catalogue-point error bound. */
  uncertaintyKm: number;
  nearestCity: { id: string; name: string; state: string };
  /** Approximate straight-line distance from rounded location to the catalogue point. */
  distanceKm: number;
  distanceReference: 'catalogue-representative-point';
  proximity: 'nearby' | 'faraway' | 'uncertain';
  requiresConfirmation: true;
  manualEntryAvailable: true;
} | {
  status: 'error';
  code: LocationErrorCode;
  message: string;
  requiresConfirmation: true;
  manualEntryAvailable: true;
};

type PositionProvider = Pick<Geolocation, 'getCurrentPosition'>;
export interface LocationOptions {
  /** Default50km to the representative point, with uncertainty crossing flagged. */
  maxDistanceKm?: number;
  /** Browser acquisition timeout only; default10s. Permission/visibility wait is excluded by the browser. */
  timeoutMs?: number;
  /** Application elapsed wait limit, default30s, including permission/visibility wait. Not acquisition timing. */
  waitLimitMs?: number;
  /** Abort on origin edit, navigation/unmount or replacement request; late callbacks are ignored. */
  signal?: AbortSignal;
  /** Testing/unsupported-browser override; omit for lazy browser feature detection. */
  geolocation?: PositionProvider | null;
}

const messages: Record<LocationErrorCode, string> = {
  unsupported: 'Location is not supported here. Enter your origin manually.',
  'permission-denied': 'Location permission was denied. Enter your origin manually.',
  timeout: 'The browser could not acquire a position within its time limit. Try again or enter your origin manually.',
  'request-expired': 'The app stopped waiting for location. Permission or a position may still be pending. Try again or enter your origin manually.',
  cancelled: 'This location request was cancelled. Enter your origin manually.',
  unavailable: 'Your location is unavailable. Enter your origin manually.',
  'invalid-catalogue': 'Supported place locations are unavailable. Enter your origin manually.',
};
const error = (code: LocationErrorCode): LocationResult => ({
  status: 'error', code, message: messages[code], requiresConfirmation: true, manualEntryAvailable: true,
});
const validPoint = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
  Number.isFinite(longitude) && Math.abs(longitude) <= 180;
const validText = (value: string) => typeof value === 'string' && !!value.trim() && value.trim() === value;
const validDuration = (value: number) => Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
const roundUp = (n: number) => Math.ceil(n * 10) / 10;
const radians = (n: number) => n * Math.PI / 180;
function distance(lat: number, lon: number, city: LocationCity): number {
  const a = Math.sin(radians(city.latitude - lat) / 2) ** 2 +
    Math.cos(radians(lat)) * Math.cos(radians(city.latitude)) *
    Math.sin(radians(city.longitude - lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

/** One user-initiated request. An aborted signal never starts geolocation. */
export async function requestCurrentLocation(
  catalogue: readonly LocationCity[],
  options: LocationOptions = {},
): Promise<LocationResult> {
  if (options.signal?.aborted) return error('cancelled');
  // Copy inputs so later catalogue edits cannot change an in-flight suggestion.
  const cities = catalogue.map(city => ({ ...city }));
  if (!cities.length || cities.some(city => !validText(city.id) || !validText(city.name) ||
    !validText(city.state) || !/^[A-Z]{2}$/.test(city.state) ||
    !validPoint(city.latitude, city.longitude)) ||
    new Set(cities.map(city => city.id)).size !== cities.length) {
    return error('invalid-catalogue');
  }
  const maxDistance = options.maxDistanceKm ?? 50;
  const timeout = options.timeoutMs ?? 10_000;
  const waitLimit = options.waitLimitMs ?? 30_000;
  const signal = options.signal;
  if (!Number.isFinite(maxDistance) || maxDistance <= 0 ||
    !validDuration(timeout) || !validDuration(waitLimit)) return error('unavailable');

  return new Promise(resolve => {
    let settled = false;
    const onAbort = () => finish(error('cancelled'));
    const finish = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const timer = setTimeout(() => finish(error('request-expired')), waitLimit);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      const provider = options.geolocation === undefined
        ? (typeof navigator === 'undefined' ? null : navigator.geolocation)
        : options.geolocation;
      if (settled) return;
      if (!provider) { finish(error('unsupported')); return; }
      provider.getCurrentPosition(position => {
        if (settled) return;
        const coords = position?.coords;
        if (!coords) { finish(error('unavailable')); return; }
        const { latitude, longitude, accuracy } = coords;
        if (!validPoint(latitude, longitude) || !Number.isFinite(accuracy) || accuracy < 0) {
          finish(error('unavailable')); return;
        }
        const lat = Math.round(latitude * 100) / 100;
        const lon = Math.round(longitude * 100) / 100;
        // Maximum rounding displacement is <0.8 km anywhere on Earth.
        const uncertaintyKm = roundUp(accuracy / 1000 + 0.8);
        const ranked = cities.map(city => ({ city, km: distance(lat, lon, city) }))
          // Codepoint ID order makes exact ties independent of catalogue order/locale.
          .sort((a, b) => a.km - b.km || (a.city.id < b.city.id ? -1 : a.city.id > b.city.id ? 1 : 0));
        const nearest = ranked[0];
        const ambiguous = ranked.length > 1 && ranked[1].km - nearest.km <= 2 * uncertaintyKm;
        const proximity = nearest.km - uncertaintyKm > maxDistance ? 'faraway'
          : ambiguous || nearest.km + uncertaintyKm > maxDistance ? 'uncertain' : 'nearby';
        finish({
          status: 'suggestion', uncertaintyKm,
          nearestCity: { id: nearest.city.id, name: nearest.city.name, state: nearest.city.state },
          distanceKm: Math.round(nearest.km * 10) / 10,
          distanceReference: 'catalogue-representative-point',
          proximity, requiresConfirmation: true, manualEntryAvailable: true,
        });
      }, failure => {
        if (settled) return;
        finish(error(failure?.code === 1 ? 'permission-denied' : failure?.code === 3 ? 'timeout' : 'unavailable'));
      }, { enableHighAccuracy: false, maximumAge: 0, timeout });
    } catch (failure) {
      finish(error(failure instanceof Error && failure.name === 'SecurityError' ? 'permission-denied' : 'unavailable'));
    }
  });
}
