import { createHash } from "node:crypto";
import {
  ACCESS_POLICY,
  chooseAccessStations,
  roundKm,
  stationsInRange,
  straightLineKm,
} from "./access-stations.mjs";

export const POLICY = Object.freeze({
  horizonDays: 7,
  maxBoardings: 4,
  defaultTransferSeconds: 600,
  results: 5,
});
const DAY = 86400000;
const isoDay = (key) =>
  `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
const keyDay = (day) => day.replaceAll("-", "");
const plusDay = (day, n) =>
  new Date(Date.parse(day + "T12:00:00Z") + n * DAY).toISOString().slice(0, 10);
const normalize = (s) =>
  s.toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");
const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const formatters = new Map();
function localParts(ms, tz) {
  if (!formatters.has(tz))
    formatters.set(
      tz,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }),
    );
  return Object.fromEntries(
    formatters
      .get(tz)
      .formatToParts(ms)
      .map((p) => [p.type, p.value]),
  );
}
export function localDate(ms, tz) {
  const p = localParts(ms, tz);
  return `${p.year}-${p.month}-${p.day}`;
}
/** All matching instants, earliest first; zero means nonexistent local clock time. */
export function localInstants(date, time, tz) {
  const naive = Date.parse(date + "T" + time + ":00Z");
  const result = new Set();
  for (const delta of [-DAY, -DAY / 2, 0, DAY / 2, DAY]) {
    const sample = naive + delta,
      p = localParts(sample, tz);
    const clock = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    const candidate = naive - (clock - sample),
      c = localParts(candidate, tz);
    if (
      `${c.year}-${c.month}-${c.day}` === date &&
      `${c.hour}:${c.minute}` === time
    )
      result.add(candidate);
  }
  return [...result].sort((a, b) => a - b);
}
/** GTFS service-time origin is local noon minus12h, including DST transition days. */
export function serviceEpoch(date, tz) {
  return localInstants(date, "12:00", tz)[0] - 12 * 3600000;
}
export function isActive(feed, service, date) {
  const key = keyDay(date),
    exception = feed.exceptions.find(
      (r) => r.service_id === service && r.date === key,
    );
  if (exception) return exception.exception_type === "1";
  const row = feed.calendar.find((r) => r.service_id === service);
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return (
    !!row &&
    key >= row.start_date &&
    key <= row.end_date &&
    row[weekdays[new Date(date + "T12:00:00Z").getUTCDay()]] === "1"
  );
}
export class PlanningError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
const fail = (code, message, status) => {
  throw new PlanningError(code, message, status);
};
const validDate = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;

export function createTimetableEngine(
  data,
  { now = () => Date.now(), maxWork = 2_000_000, places = [] } = {},
) {
  const cityIndex = new Map(data.cities.map((c) => [c.id, c])),
    textIndex = new Map(),
    feeds = new Map(data.feeds.map((f) => [f.id, f]));
  for (const city of data.cities)
    for (const value of [
      city.id,
      city.name,
      `${city.name}, ${city.state}`,
      ...city.aliases,
    ]) {
      const key = normalize(value);
      if (!textIndex.has(key)) textIndex.set(key, new Set());
      textIndex.get(key).add(city.id);
    }
  const stops = new Map();
  for (const f of data.feeds)
    for (const [id, s] of Object.entries(f.stops))
      stops.set(f.id + ":" + id, { ...s, feed: f.id, id });
  // Representative points and qualified operator listings for catalogue places.
  // Used only to pick nearby published stations; never to create schedules.
  const placeInfo = new Map();
  for (const p of [...data.cities, ...places])
    if (cityIndex.has(p.id))
      placeInfo.set(p.id, {
        ...placeInfo.get(p.id),
        ...(Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
          ? { latitude: p.latitude, longitude: p.longitude }
          : {}),
        ...(Array.isArray(p.listings) ? { listings: p.listings } : {}),
      });
  // Stops where at least one published trip allows boarding / alighting.
  const boardingStops = new Set(),
    alightingStops = new Set();
  for (const f of data.feeds)
    for (const t of f.trips)
      t.stops.forEach(([stop, , , pickup, dropoff], i) => {
        if (pickup === 0 && i < t.stops.length - 1)
          boardingStops.add(f.id + ":" + stop);
        if (dropoff === 0 && i > 0) alightingStops.add(f.id + ":" + stop);
      });
  const placePoint = (id) => {
    const p = placeInfo.get(id);
    return p && "latitude" in p ? p : null;
  };
  const nearby = (cityId, pool) =>
    stationsInRange(placePoint(cityId), pool, (id) => stops.get(id));
  const incoming = new Map(),
    rules = new Map();
  const addIncoming = (from, to) => {
    if (!incoming.has(to)) incoming.set(to, new Set([to]));
    incoming.get(to).add(from);
  };
  for (const l of data.links) addIncoming(l.from, l.to);
  for (const f of data.feeds)
    for (const r of f.transfers) {
      const from = f.id + ":" + r.from_stop_id,
        to = f.id + ":" + r.to_stop_id;
      addIncoming(from, to);
      const key = from + "|" + to;
      if (!rules.has(key)) rules.set(key, []);
      rules.get(key).push(r);
    }
  for (const group of rules.values())
    group.sort(
      (a, b) =>
        [b.from_trip_id, b.to_trip_id, b.from_route_id, b.to_route_id].filter(
          Boolean,
        ).length -
        [a.from_trip_id, a.to_trip_id, a.from_route_id, a.to_route_id].filter(
          Boolean,
        ).length,
    );
  const singleGatewayFeeds = new Set();
  for (const feed of data.feeds) {
    const inside = new Set(),
      outside = new Set();
    for (const link of data.links) {
      const a = link.from.startsWith(feed.id + ":"),
        b = link.to.startsWith(feed.id + ":");
      if (a !== b) {
        inside.add(a ? link.from : link.to);
        outside.add(a ? link.to : link.from);
      }
    }
    if (inside.size === 1 && outside.size === 1)
      singleGatewayFeeds.add(feed.id);
  }
  const nearbyFlag = new Map(
    data.cities.map((c) => [
      c.id,
      !!data.cityStops[c.id]?.length ||
        nearby(c.id, boardingStops).length > 0 ||
        nearby(c.id, alightingStops).length > 0,
    ]),
  );
  const cache = new Map();
  let computations = 0;
  const resolveCity = (value) => {
    const ids = textIndex.get(normalize(value));
    if (!ids?.size)
      fail(
        "unknown-city",
        "Choose a listed city; no verified timetable match was found.",
      );
    if (ids.size !== 1)
      fail(
        "ambiguous-city",
        "This city name is ambiguous. Choose its city and state from the suggestions.",
      );
    return cityIndex.get([...ids][0]);
  };
  const covered = (feed, date) =>
    keyDay(date) >= feed.startDate && keyDay(date) <= feed.endDate;
  const metadata = () => ({
    version: data.version,
    policy: POLICY,
    accessPolicy: ACCESS_POLICY,
    limits: data.limits,
    feeds: data.feeds.map(
      ({
        id,
        operator,
        sourceUrl,
        sha256,
        checkedAt,
        version,
        startDate,
        endDate,
      }) => ({
        id,
        operator,
        sourceUrl,
        sha256,
        checkedAt,
        version,
        startDate: isoDay(startDate),
        endDate: isoDay(endDate),
      }),
    ),
    cities: data.cities.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      aliases: c.aliases,
      hasTimetableStops: !!data.cityStops[c.id]?.length,
      // A published station lies within the access radius; the access trip
      // itself is never scheduled. Mapped places are trivially true.
      hasNearbyTimetableStation: nearbyFlag.get(c.id),
    })),
  });
  function parse(input, allowPast = false) {
    const from = input.fromId
        ? cityIndex.get(input.fromId)
        : resolveCity(String(input.from ?? "").slice(0, 100)),
      to = input.toId
        ? cityIndex.get(input.toId)
        : resolveCity(String(input.to ?? "").slice(0, 100));
    if (!from || !to) fail("unknown-city", "Choose a listed city and state.");
    if (from.id === to.id) fail("same-city", "Choose two different cities.");
    const date = String(input.date ?? ""),
      time = String(input.time ?? "");
    if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      fail("invalid-date", "Choose a valid departure date and time.");
    const includeAmtrak =
      input.includeAmtrak !== false && input.includeAmtrak !== "0";
    const mappedOrigin = data.cityStops[from.id] ?? [],
      mappedDestination = data.cityStops[to.id] ?? [];
    const access = resolveAccess(
      from,
      to,
      mappedOrigin,
      mappedDestination,
      date,
      includeAmtrak,
      input.access,
    );
    const originIds = access.origin?.stations.map((s) => s.id) ?? mappedOrigin,
      destinationIds =
        access.destination?.stations.map((s) => s.id) ?? mappedDestination;
    const tzStop = originIds[0] ?? nearby(from.id, boardingStops)[0]?.id;
    const tz = tzStop ? stops.get(tzStop).timezone : "America/New_York";
    if (!allowPast && date < localDate(now(), tz))
      fail(
        "past-date",
        "Choose today or a future date in the departure station’s time zone.",
      );
    const instants = localInstants(date, time, tz);
    if (!instants.length)
      fail(
        "nonexistent-time",
        "That local time does not occur on this daylight-saving date. Choose another time.",
      );
    const mode = input.mode ?? "all",
      operator = input.operator ?? "all",
      order = input.order ?? "arrival";
    if (
      !["all", "rail", "bus", "mixed"].includes(mode) ||
      ![
        "all",
        "AMTRAK",
        "LIRR",
        "SEPTA",
        "NJ_TRANSIT",
        "GREYHOUND",
        "FLIXBUS",
      ].includes(operator) ||
      !["arrival", "transfers"].includes(order)
    )
      fail("invalid-filter", "Choose a valid transport filter or order.");
    return {
      from: from.id,
      to: to.id,
      date,
      time,
      timezone: tz,
      epoch: instants[0],
      ambiguousTime: instants.length > 1,
      mode,
      operator,
      order,
      includeAmtrak,
      originIds,
      destinationIds,
      access,
    };
  }
  const usableFeed = (id, date, includeAmtrak) => {
    const feed = feeds.get(stops.get(id).feed);
    return {
      covered: covered(feed, date),
      included: includeAmtrak || feed.operator !== "AMTRAK",
    };
  };
  /**
   * Access stations for a side whose place has no mapped stop. `override` comes
   * only from a versioned itinerary ID and is revalidated against the radius, so
   * a shared link reconstructs the same station choice.
   */
  function resolveAccess(
    from,
    to,
    mappedOrigin,
    mappedDestination,
    date,
    includeAmtrak,
    override,
  ) {
    const result = { origin: null, destination: null };
    const sides = [
      ["origin", from, mappedOrigin, boardingStops, to, mappedDestination, alightingStops],
      ["destination", to, mappedDestination, alightingStops, from, mappedOrigin, boardingStops],
    ];
    const inRange = sides.map(([, place, mapped, pool]) =>
      mapped.length ? null : nearby(place.id, pool),
    );
    if (
      override !== undefined &&
      (!Array.isArray(override) ||
        override.length !== 2 ||
        override.some(
          (ids, i) =>
            (ids === null) !== (inRange[i] === null) ||
            (ids !== null &&
              (!Array.isArray(ids) ||
                !ids.length ||
                ids.length > ACCESS_POLICY.maxStations ||
                new Set(ids).size !== ids.length ||
                ids.some((id) => !inRange[i].some((s) => s.id === id)))),
        ))
    )
      fail("invalid-itinerary", "Invalid itinerary link.", 404);
    sides.forEach(([side, place, , , other, otherMapped, otherPool], i) => {
      if (!inRange[i]) return;
      let choice;
      if (override !== undefined)
        choice = {
          status: "ok",
          stations: override[i].map((id) =>
            inRange[i].find((s) => s.id === id),
          ),
        };
      else {
        const usable = (id) => usableFeed(id, date, includeAmtrak);
        const otherIds = otherMapped.length
          ? otherMapped
          : nearby(other.id, otherPool)
              .filter((s) => usable(s.id).covered && usable(s.id).included)
              .map((s) => s.id);
        const point = placePoint(place.id);
        choice = chooseAccessStations({
          inRange: inRange[i],
          covered: (id) => usable(id).covered,
          included: (id) => usable(id).included,
          otherStationIds: otherIds,
          distanceTo: (id) => straightLineKm(point, stops.get(id)),
        });
      }
      result[side] = {
        placeId: place.id,
        place: `${place.name}, ${place.state}`,
        status: choice.status,
        hasPoint: !!placePoint(place.id),
        stations: choice.stations.map((s) => ({ id: s.id, km: s.km })),
      };
    });
    return result;
  }
  const usesAccess = (q) => !!(q.access.origin || q.access.destination);
  function stopSummary(id) {
    const s = stops.get(id);
    return { stationId: id, id: s.id, feed: s.feed, name: s.name };
  }
  function accessSummary(q) {
    const side = (a) =>
      a
        ? {
            placeId: a.placeId,
            place: a.place,
            status: a.status,
            stations: a.stations.map((s) => ({
              ...stopSummary(s.id),
              straightLineKm: roundKm(s.km),
            })),
            listings: placeInfo.get(a.placeId)?.listings ?? [],
          }
        : null;
    return {
      radiusKm: ACCESS_POLICY.radiusKm,
      maxStations: ACCESS_POLICY.maxStations,
      distanceReference: "catalogue-representative-point",
      scheduled: false,
      origin: side(q.access.origin),
      destination: side(q.access.destination),
    };
  }
  /** Unscheduled access between a place and the station actually used. */
  function itineraryAccess(q, label) {
    const leg = (a, stationId) => {
      if (!a) return null;
      const s = a.stations.find((x) => x.id === stationId);
      return {
        place: a.place,
        placeId: a.placeId,
        station: stopSummary(stationId),
        straightLineKm: roundKm(s.km),
        distanceReference: "catalogue-representative-point",
        scheduled: false,
        listings: placeInfo.get(a.placeId)?.listings ?? [],
      };
    };
    return {
      before: leg(q.access.origin, label.legs[0].fromStop),
      after: leg(q.access.destination, label.legs.at(-1).toStop),
    };
  }
  function instances(q) {
    const end = q.epoch + POLICY.horizonDays * DAY,
      result = [];
    for (const feed of data.feeds) {
      // Entering and leaving a single-gateway feed returns to the same station
      // later with more boardings. Omit that detour when neither endpoint needs it.
      if (
        singleGatewayFeeds.has(feed.id) &&
        q.originIds.some((id) => !id.startsWith(feed.id + ":")) &&
        q.destinationIds.some((id) => !id.startsWith(feed.id + ":"))
      )
        continue;
      if (
        (!q.includeAmtrak && feed.operator === "AMTRAK") ||
        !covered(feed, q.date)
      )
        continue;
      const maxSeconds = Math.max(...feed.trips.map((t) => t.stops.at(-1)[1]));
      const previous = Math.ceil(maxSeconds / 86400);
      for (let offset = -previous; offset <= POLICY.horizonDays; offset++) {
        const date = plusDay(q.date, offset),
          base = serviceEpoch(date, feed.timezone),
          active = new Map();
        for (const t of feed.trips) {
          if (!active.has(t.service))
            active.set(t.service, isActive(feed, t.service, date));
          if (
            !active.get(t.service) ||
            (q.mode === "rail" && t.mode !== "rail") ||
            (q.mode === "bus" && t.mode !== "bus")
          )
            continue;
          const ts = t.stops.map(
            ([stop, arrival, departure, pickup, dropoff]) => ({
              id: feed.id + ":" + stop,
              arrival: base + arrival * 1000,
              departure: base + departure * 1000,
              pickup,
              dropoff,
            }),
          );
          if (ts.at(-1).arrival < q.epoch || ts[0].departure > end) continue;
          result.push({
            feed,
            trip: t,
            date,
            uid: `${feed.id}:${date}:${t.id}`,
            stops: ts,
          });
        }
      }
    }
    return result.sort(
      (a, b) =>
        a.stops[0].departure - b.stops[0].departure ||
        a.uid.localeCompare(b.uid),
    );
  }
  function transfer(previous, to, instance) {
    if (!previous.legs.length) return previous.stop === to ? 0 : null;
    const last = previous.legs.at(-1);
    if (last.instance === instance.uid) return null;
    const from = previous.stop;
    if (from !== to) {
      const link = data.links.find((l) => l.from === from && l.to === to);
      if (link) return link.seconds;
    }
    if (!from.startsWith(instance.feed.id + ":")) return null;
    const matching = (rules.get(from + "|" + to) ?? []).filter(
      (r) =>
        (!r.from_trip_id || r.from_trip_id === last.tripId) &&
        (!r.to_trip_id || r.to_trip_id === instance.trip.id) &&
        (!r.from_route_id || r.from_route_id === last.routeId) &&
        (!r.to_route_id || r.to_route_id === instance.trip.routeId),
    );
    const rule = matching[0];
    if (rule?.transfer_type === "3") return null;
    if (rule?.transfer_type === "1") return 0;
    if (rule?.transfer_type === "2") return Number(rule.min_transfer_time) || 0;
    return from === to ? POLICY.defaultTransferSeconds : null;
  }
  function labelGroup(paths) {
    paths.sort((a, b) => a.arrival - b.arrival);
    const best = [];
    for (const path of paths) {
      const prior = best.at(-1);
      best.push(
        !prior ||
          (path.legs[0]?.departure ?? path.arrival) >
            (prior.legs[0]?.departure ?? prior.arrival)
          ? path
          : prior,
      );
    }
    return { paths, best };
  }
  function* candidates(previous, to, instance, latest) {
    for (const id of incoming.get(to) ?? [to]) {
      const group = previous.get(id);
      if (!group) continue;
      const source = feeds.get(stops.get(id).feed);
      // A feed with no trip-specific transfers has a constant transfer buffer.
      // Prefix-best labels answer latest-origin-departure queries without scanning
      // every earlier train. Trip-specific LIRR rules still use full exact labels.
      if (!source.transfers.length) {
        const first = group.paths[0];
        const buffer = !first.legs.length
          ? id === to
            ? 0
            : null
          : id === to
            ? POLICY.defaultTransferSeconds
            : data.links.find((l) => l.from === id && l.to === to)?.seconds;
        if (buffer == null) continue;
        const cutoff = latest - buffer * 1000;
        let lo = 0,
          hi = group.paths.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (group.paths[mid].arrival <= cutoff) lo = mid + 1;
          else hi = mid;
        }
        if (lo) yield group.best[lo - 1];
      } else {
        for (const path of group.paths) {
          if (path.arrival > latest) break;
          yield path;
        }
      }
    }
  }

  function run(q) {
    const from = cityIndex.get(q.from),
      to = cityIndex.get(q.to),
      warnings = [...data.limits];
    if (q.ambiguousTime)
      warnings.push(
        "The requested local time occurs twice; the earlier occurrence is used.",
      );
    const response = {
      version: data.version,
      query: {
        from: q.from,
        to: q.to,
        date: q.date,
        time: q.time,
        timezone: q.timezone,
      },
      itineraries: [],
      warnings,
      feeds: metadata().feeds,
      policy: POLICY,
      ...(usesAccess(q) ? { access: accessSummary(q) } : {}),
    };
    for (const a of [q.access.origin, q.access.destination]) {
      // Places without a representative point fall through to the generic gap.
      if (!a || a.status === "ok" || !a.hasPoint) continue;
      if (a.status === "none-in-range")
        return {
          ...response,
          reason: "no-station-in-range",
          message: `No published Amtrak or LIRR station in the loaded timetables is within ${ACCESS_POLICY.radiusKm} km (straight-line) of ${a.place}. Check the operators listed for this place; their listings are not schedules.`,
        };
      if (a.status === "outside-snapshot")
        return {
          ...response,
          reason: "date-outside-snapshot",
          message: `The selected date is outside the published snapshot for the stations near ${a.place}. Check the feed dates below or choose another travel date.`,
        };
      if (a.status === "filtered-out")
        return {
          ...response,
          reason: "access-filtered-out",
          message: `The published stations within ${ACCESS_POLICY.radiusKm} km of ${a.place} are all excluded by your operator settings. Include Amtrak to search them.`,
        };
      return {
        ...response,
        reason: "no-useful-scheduled-leg",
        message: `The published stations nearest ${a.place} are no closer to it than the stations used for ${a === q.access.origin ? `${to.name}, ${to.state}` : `${from.name}, ${from.state}`}, so the loaded timetables offer no useful scheduled leg between these places. Check the operators listed for these places; this is not proof that no real service exists.`,
      };
    }
    if (!q.originIds.length || !q.destinationIds.length)
      return {
        ...response,
        reason: "coverage-gap",
        message:
          "No verified scheduled stop mapping for one or both listed places. Catalogue membership does not prove a timetable or route.",
      };
    const validOrigins = q.originIds.filter((id) =>
      covered(feeds.get(stops.get(id).feed), q.date),
    );
    const validDestinations = q.destinationIds.filter((id) =>
      covered(feeds.get(stops.get(id).feed), q.date),
    );
    if (!validOrigins.length || !validDestinations.length)
      return {
        ...response,
        reason: "date-outside-snapshot",
        message:
          "The selected date is outside the published snapshot available for this city. Check the feed dates below or choose another travel date.",
      };
    if (!["all", "AMTRAK", "LIRR"].includes(q.operator))
      return {
        ...response,
        reason: "operator-coverage-gap",
        message:
          "No verified timetable feed is loaded for this operator. Its sample routes and directory listings are not used as schedules.",
      };
    let work = 0;
    const checkBudget = () => {
      if (++work > maxWork)
        fail(
          "search-limit",
          "This search exceeds the current planning work limit. Try a more specific departure time or check the operators; no sample route was substituted.",
          503,
        );
    };
    const trips = instances(q);
    let end = q.epoch + POLICY.horizonDays * DAY;
    const destinationSet = new Set(validDestinations),
      boundKeys = new Map();
    const eligible = (label) =>
      (q.operator === "all" ||
        label.legs.some((l) => l.operator === q.operator)) &&
      (q.mode !== "mixed" || new Set(label.legs.map((l) => l.mode)).size > 1);
    const tighten = (label) => {
      if (!eligible(label)) return;
      boundKeys.set(digest(label.legs), label.arrival);
      if (boundKeys.size >= POLICY.results)
        end = Math.min(
          end,
          [...boundKeys.values()].sort((a, b) => a - b)[POLICY.results - 1],
        );
    };
    let previous = new Map(
        validOrigins.map((stop) => [
          stop,
          labelGroup([{ stop, arrival: q.epoch, legs: [] }]),
        ]),
      ),
      arrivals = [];
    for (let round = 1; round <= POLICY.maxBoardings; round++) {
      const next = new Map();
      for (const instance of trips) {
        let boarded = null;
        for (let i = 0; i < instance.stops.length; i++) {
          checkBudget();
          const at = instance.stops[i];
          if (
            boarded &&
            at.dropoff === 0 &&
            at.arrival <= end &&
            at.arrival >= q.epoch
          ) {
            const leg = {
              instance: instance.uid,
              feed: instance.feed.id,
              operator: instance.feed.operator,
              tripId: instance.trip.id,
              routeId: instance.trip.routeId,
              serviceDate: instance.date,
              route: instance.trip.name,
              number: instance.trip.number,
              agencyName: instance.trip.agencyName,
              mode: instance.trip.mode,
              fromStop: boarded.at.id,
              toStop: at.id,
              departure: boarded.at.departure,
              arrival: at.arrival,
            };
            const label = {
              stop: at.id,
              arrival: at.arrival,
              legs: [...boarded.path.legs, leg],
            };
            if (!next.has(at.id)) next.set(at.id, new Map());
            const map = next.get(at.id),
              old = map.get(instance.uid);
            if (!old || label.legs[0].departure > old.legs[0].departure) {
              map.set(instance.uid, label);
              if (destinationSet.has(at.id)) tighten(label);
            }
          }
          if (at.pickup !== 0 || at.departure < q.epoch || at.departure > end)
            continue;
          for (const path of candidates(
            previous,
            at.id,
            instance,
            Math.min(at.departure, end),
          )) {
            checkBudget();
            if (path.legs.some((l) => l.instance === instance.uid)) continue;
            const buffer = transfer(path, at.id, instance);
            if (buffer === null || path.arrival + buffer * 1000 > at.departure)
              continue;
            const first = path.legs[0]?.departure ?? at.departure;
            if (
              !boarded ||
              first > (boarded.path.legs[0]?.departure ?? boarded.at.departure)
            )
              boarded = { at, path };
          }
        }
      }
      for (const stop of validDestinations)
        for (const label of next.get(stop)?.values() ?? [])
          arrivals.push(label);
      for (const map of next.values())
        for (const [id, label] of map) if (label.arrival > end) map.delete(id);
      previous = new Map(
        [...next]
          .filter(([, labels]) => labels.size)
          .map(([stop, labels]) => [stop, labelGroup([...labels.values()])]),
      );
      if (!previous.size) break;
    }
    const unique = new Map();
    for (const label of arrivals) {
      const ops = new Set(label.legs.map((l) => l.operator)),
        modes = new Set(label.legs.map((l) => l.mode));
      if (
        (q.operator !== "all" && !ops.has(q.operator)) ||
        (q.mode === "mixed" && modes.size < 2)
      )
        continue;
      const key = digest(label.legs);
      if (!unique.has(key)) unique.set(key, label);
    }
    let options = [...unique.values()];
    // Suppress options worse in arrival, changes AND departure convenience.
    options = options.filter(
      (b) =>
        !options.some(
          (a) =>
            a !== b &&
            a.arrival <= b.arrival &&
            a.legs.length <= b.legs.length &&
            a.legs[0].departure >= b.legs[0].departure &&
            (a.arrival < b.arrival ||
              a.legs.length < b.legs.length ||
              a.legs[0].departure > b.legs[0].departure),
        ),
    );

    options.sort(
      (a, b) =>
        (q.order === "transfers" ? a.legs.length - b.legs.length : 0) ||
        a.arrival - b.arrival ||
        a.legs.length - b.legs.length ||
        b.legs[0].departure - a.legs[0].departure ||
        digest(a.legs).localeCompare(digest(b.legs)),
    );
    options = options.slice(0, POLICY.results);
    response.itineraries = options.map((label) => {
      const pick = digest(label.legs),
        payload = {
          v: data.version,
          fromId: q.from,
          toId: q.to,
          date: q.date,
          time: q.time,
          mode: q.mode,
          operator: q.operator,
          order: q.order,
          includeAmtrak: q.includeAmtrak,
          // Exact access-station choice, so a shared link reconstructs it.
          ...(usesAccess(q)
            ? {
                access: [q.access.origin, q.access.destination].map(
                  (a) => a?.stations.map((s) => s.id) ?? null,
                ),
              }
            : {}),
          pick,
        };
      return {
        id: "tt1-" + Buffer.from(JSON.stringify(payload)).toString("base64url"),
        origin: `${from.name}, ${from.state}`,
        destination: `${to.name}, ${to.state}`,
        departure: new Date(label.legs[0].departure).toISOString(),
        arrival: new Date(label.arrival).toISOString(),
        durationMinutes: Math.round(
          (label.arrival - label.legs[0].departure) / 60000,
        ),
        waitFromRequestedMinutes: Math.round(
          (label.legs[0].departure - q.epoch) / 60000,
        ),
        transfers: label.legs.length - 1,
        ...(usesAccess(q) ? { access: itineraryAccess(q, label) } : {}),
        legs: label.legs.map((l) => ({
          ...l,
          departure: new Date(l.departure).toISOString(),
          arrival: new Date(l.arrival).toISOString(),
          from: stops.get(l.fromStop),
          to: stops.get(l.toStop),
          sourceUrl: feeds.get(l.feed).sourceUrl,
          purchaseUrl:
            l.operator === "LIRR"
              ? "https://www.mta.info/fares/lirr-metro-north"
              : "https://www.amtrak.com/tickets.html",
        })),
      };
    });
    return response.itineraries.length
      ? response
      : {
          ...response,
          reason: "no-connection",
          message:
            "No usable published connection found within the loaded feeds, selected filters, seven-day horizon and four-boarding limit. This is not proof that no real service exists.",
        };
  }
  function plan(input, { allowPast = false } = {}) {
    const q = parse(input, allowPast),
      key = JSON.stringify([data.version, q]);
    if (cache.has(key)) {
      const hit = cache.get(key);
      cache.delete(key);
      cache.set(key, hit);
      return structuredClone(hit);
    }
    computations++;
    const result = run(q);
    cache.set(key, result);
    if (cache.size > 64) cache.delete(cache.keys().next().value);
    return structuredClone(result);
  }
  function itinerary(id) {
    if (
      typeof id !== "string" ||
      id.length > 900 ||
      !/^tt1-[A-Za-z0-9_-]+$/.test(id)
    )
      fail("invalid-itinerary", "Invalid itinerary link.", 404);
    let p;
    try {
      p = JSON.parse(Buffer.from(id.slice(4), "base64url").toString());
    } catch {
      fail("invalid-itinerary", "Invalid itinerary link.", 404);
    }
    if (p.v !== data.version)
      fail(
        "stale-itinerary",
        "This timetable snapshot has changed. Search again for a current itinerary.",
        409,
      );
    const result = plan(p, { allowPast: true }),
      trip = result.itineraries.find((t) => t.id === id);
    if (!trip)
      fail(
        "itinerary-not-found",
        "This published itinerary could not be reconstructed. Search again.",
        404,
      );
    return { ...result, itinerary: trip, itineraries: undefined };
  }
  return {
    metadata,
    plan,
    itinerary,
    diagnostics: () => ({ computations, cacheSize: cache.size }),
  };
}
