/**
 * Nearest published timetable stations for catalogue places with no mapped stop.
 *
 * The access trip between a place and a station is NEVER scheduled: no time,
 * fare, duration or mode is produced for it. Distances are straight-line from
 * the catalogue representative point (Census internal point or operator-stop
 * representative), not a road/transit distance and not the rider's location.
 */
export const ACCESS_POLICY = Object.freeze({
  /** Maximum straight-line distance from the place's representative point. */
  radiusKm: 100,
  /** Nearest usable stations offered per place. */
  maxStations: 3,
});

const radians = (n) => (n * Math.PI) / 180;
const finitePoint = (p) =>
  !!p &&
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180;

/** Great-circle distance in km between two {latitude, longitude} points. */
export function straightLineKm(a, b) {
  const h =
    Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

/**
 * Stations within the radius, nearest first; exact ties use code-point ID order
 * so the choice is independent of feed/object iteration order.
 * @param {{latitude:number, longitude:number} | null | undefined} point
 * @param {Iterable<string>} stationIds
 * @param {(id: string) => {latitude?: number, longitude?: number} | undefined} lookup
 */
export function stationsInRange(point, stationIds, lookup, radiusKm = ACCESS_POLICY.radiusKm) {
  if (!finitePoint(point)) return [];
  const result = [];
  for (const id of stationIds) {
    const stop = lookup(id);
    if (!finitePoint(stop)) continue;
    const km = straightLineKm(point, stop);
    if (km <= radiusKm) result.push({ id, km });
  }
  return result.sort((a, b) => a.km - b.km || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Choose access stations for one side of a query.
 * - `none-in-range`: no published station within the radius at all.
 * - `outside-snapshot`: stations exist but none of their feeds cover the date.
 * - `filtered-out`: covered stations exist but the operator toggle excludes them.
 * - `no-useful-leg`: every usable station is a station of the other place, or is no
 *   nearer to this place than the other place's own stations (a scheduled leg
 *   would not get the rider closer).
 * - `ok`: up to `maxStations` stations.
 * @param {{ inRange: {id:string, km:number}[], covered: (id:string)=>boolean,
 *   included: (id:string)=>boolean, otherStationIds: Iterable<string>,
 *   distanceTo: (id:string)=>number }} input
 */
export function chooseAccessStations({ inRange, covered, included, otherStationIds, distanceTo }) {
  if (!inRange.length) return { status: "none-in-range", stations: [] };
  const inWindow = inRange.filter((s) => covered(s.id));
  if (!inWindow.length) return { status: "outside-snapshot", stations: [] };
  const usable = inWindow.filter((s) => included(s.id));
  if (!usable.length) return { status: "filtered-out", stations: [] };
  const other = new Set(otherStationIds);
  let otherNearest = Infinity;
  for (const id of other) otherNearest = Math.min(otherNearest, distanceTo(id));
  const useful = usable.filter((s) => !other.has(s.id) && s.km < otherNearest);
  if (!useful.length) return { status: "no-useful-leg", stations: [] };
  return { status: "ok", stations: useful.slice(0, ACCESS_POLICY.maxStations) };
}

/** Display rounding: whole km, never below 1 km. */
export const roundKm = (km) => Math.max(1, Math.round(km));
