import { cities, getConceptEdges, resolveCity, samplePlanningNote } from './eastCoast';
import { originalDemoTrips } from './originalDemoTrips';
import { agencies } from './agencies';
import type { Leg, Trip } from '../types';
import { createGraph } from './routing/graph';

export const ROUTING_DATASET_VERSION = 'east-coast-21d77dd-v1';
export const ROUTING_CACHE_VERSION = 'concept-trip-v1';
export const ROUTING_CACHE_MAX_ENTRIES = 128;
export const routingProfiles = ['AMTRAK', 'GREYHOUND', 'FLIXBUS'] as const;
export type RoutingProfile = typeof routingProfiles[number];
const cityIndex = new Map(cities.map(city => [city.id, city]));
const originalIndex = new Map(originalDemoTrips.map(trip => [trip.id, trip]));
const graphs = Object.fromEntries(routingProfiles.map(profile =>
  [profile, createGraph(cities.map(city => city.id), getConceptEdges(profile))])) as Record<RoutingProfile, ReturnType<typeof createGraph>>;
const cache = new Map<string, Trip | undefined>();
let initializing = true;
const counters = { startupRouteComputations: 0, queries: 0, routeComputations: 0, tripCreations: 0, cacheHits: 0, evictions: 0 };
const start = Date.parse('2026-10-24T08:00:00-04:00');
const clone = (trip: Trip | undefined): Trip | undefined => trip && ({
  ...trip, legs: trip.legs.map(leg => ({ ...leg, ...(leg.fare ? { fare: { ...leg.fare } } : {}) })),
});

/** No browser APIs, persistence, live data or rider coordinates. Readonly snapshot only. */
export function getRoutingDiagnostics() {
  return Object.freeze({
    datasetVersion: ROUTING_DATASET_VERSION, cacheVersion: ROUTING_CACHE_VERSION,
    cacheMaxEntries: ROUTING_CACHE_MAX_ENTRIES, cacheEntries: cache.size,
    ...counters,
    totalQueries: counters.queries,
    graphs: Object.freeze(Object.fromEntries(routingProfiles.map(profile => [profile,
      Object.freeze({ nodes: graphs[profile].nodeCount, edges: graphs[profile].edgeCount })]))),
  });
}
/** Explicit in-process test hooks; never exposed on a global or HTTP endpoint. */
export function clearRoutingCacheForTests() { cache.clear(); }
export function resetRoutingDiagnosticsForTests() {
  counters.queries = counters.routeComputations = counters.tripCreations = counters.cacheHits = counters.evictions = 0;
}

/**
 * Plans one static concept pair/profile. No date/time/filter input is accepted:
 * legacy IDs reconstruct the exact fixed sample date/times. Any future variable
 * departure/filter contract must version IDs/cache and include every such input.
 * All accepted result-affecting inputs are keyed. Unknown cities have no edges.
 */
export function getConceptTrip(from: string, to: string, profile: RoutingProfile): Trip | undefined {
  counters.queries++;
  if (!cityIndex.has(from) || !cityIndex.has(to) || from === to ||
      !routingProfiles.includes(profile) || (from === 'philadelphia' && to === 'stony-brook')) return undefined;
  const key = JSON.stringify([ROUTING_DATASET_VERSION, ROUTING_CACHE_VERSION, from, to, profile, start]);
  if (cache.has(key)) {
    counters.cacheHits++;
    const hit = cache.get(key); cache.delete(key); cache.set(key, hit);
    return clone(hit);
  }
  if (initializing) counters.startupRouteComputations++;
  counters.routeComputations++;
  const path = graphs[profile].path(from, to);
  let result: Trip | undefined;
  if (path) {
    const groups: typeof path = [];
    for (const edge of path) {
      const last = groups.at(-1);
      if (last && last.agency === edge.agency && last.line === edge.line) {
        last.to = edge.to; last.minutes += edge.minutes;
      } else groups.push({ ...edge });
    }
    const offset = profile === 'GREYHOUND' ? 30 : profile === 'FLIXBUS' ? 60 : 0;
    let elapsed = offset;
    const id = `east-${from}--${to}--${profile.toLowerCase()}`;
    const legs: Leg[] = groups.map((edge, i) => {
      if (i) elapsed += 60;
      const departure = new Date(start + elapsed * 60000).toISOString();
      elapsed += edge.minutes;
      return { id: `${id}-${i + 1}`, agency: edge.agency, mode: agencies[edge.agency].mode,
        line: edge.line, from: cityIndex.get(edge.from)!.name, to: cityIndex.get(edge.to)!.name,
        departure, arrival: new Date(start + elapsed * 60000).toISOString(), purchaseUrl: agencies[edge.agency].purchaseUrl };
    });
    if (profile === 'AMTRAK' || legs.some(leg => leg.agency === profile)) {
      const primary = profile === 'AMTRAK' && legs.every(leg => leg.agency === 'LIRR') ? 'LIRR' : profile;
      result = { id, origin: cityIndex.get(from)!.name, destination: cityIndex.get(to)!.name,
        durationMinutes: elapsed - offset, legs, dataStatus: 'sample',
        label: `${agencies[primary].name} ${agencies[primary].mode === 'rail' ? 'rail' : 'coach'} concept`,
        description: 'Check actual services and fares with the operator.', planningNote: samplePlanningNote };
      counters.tripCreations++;
    }
  }
  cache.set(key, result);
  if (cache.size > ROUTING_CACHE_MAX_ENTRIES) { cache.delete(cache.keys().next().value!); counters.evictions++; }
  return clone(result);
}

/** Deterministic reload/deep-link reconstruction, independent of prior Search/cache. */
export function getTripById(id: string | null | undefined): Trip | undefined {
  if (typeof id !== 'string' || id.length > 180) return undefined;
  if (originalIndex.has(id)) return clone(originalIndex.get(id));
  if (!id.startsWith('east-')) return undefined;
  const parts = id.slice(5).split('--');
  if (parts.length !== 3) return undefined;
  const profile = routingProfiles.find(item => item.toLowerCase() === parts[2]);
  return profile ? getConceptTrip(parts[0], parts[1], profile) : undefined;
}

/** Only the requested pair's three profiles. Population listings never create edges. */
export function planTrips(origin: string, destination: string): Trip[] {
  const from = resolveCity(origin)?.id, to = resolveCity(destination)?.id;
  if (!from || !to || from === to) return [];
  if (from === 'philadelphia' && to === 'stony-brook') return originalDemoTrips.map(trip => clone(trip)!);
  return routingProfiles.map(profile => getConceptTrip(from, to, profile)).filter((trip): trip is Trip => !!trip);
}

// Capture actual initialization work separately from subsequent user queries.
initializing = false;
