import { beforeEach, expect, test } from 'vitest';
import { buildEastCoastTrips } from './eastCoast';
// Explicit legacy reference fixtures, not production startup work.
const demoTrips = [...originalDemoTrips, ...buildEastCoastTrips()];
import { cities } from './eastCoast';
import { originalDemoTrips } from './originalDemoTrips';
import { clearRoutingCacheForTests, getConceptTrip, getRoutingDiagnostics, getTripById,
  planTrips, resetRoutingDiagnosticsForTests, ROUTING_CACHE_MAX_ENTRIES } from './tripLookup';

beforeEach(() => { clearRoutingCacheForTests(); resetRoutingDiagnosticsForTests(); });

test('every existing trip reconstructs exactly after a cleared cache, including original times and IDs', () => {
  for (const trip of demoTrips) {
    clearRoutingCacheForTests();
    expect(getTripById(trip.id)).toEqual(trip);
  }
  expect(planTrips('Philly','Long Island')).toEqual(originalDemoTrips);
  expect(getTripById('east-philadelphia--stony-brook--amtrak')).toBeUndefined();
});

test('no route computations until explicit query; only requested pair/profiles are computed', () => {
  expect(getRoutingDiagnostics()).toMatchObject({ startupRouteComputations: 0, routeComputations: 0, tripCreations: 0, cacheEntries: 0 });
  const trips = planTrips('Portland, ME','Miami');
  expect(trips).toHaveLength(3);
  expect(getRoutingDiagnostics()).toMatchObject({ routeComputations: 3, tripCreations: 3, cacheEntries: 3 });
  planTrips('Portland, ME','Miami');
  expect(getRoutingDiagnostics()).toMatchObject({ routeComputations: 3, cacheHits: 3 });
  expect(Object.isFrozen(getRoutingDiagnostics())).toBe(true);
});

test('versioned LRU is bounded, records evictions, and isolates profile/direction and result mutation', () => {
  for (const a of cities) for (const b of cities) getConceptTrip(a.id,b.id,'AMTRAK');
  expect(getRoutingDiagnostics().cacheEntries).toBe(ROUTING_CACHE_MAX_ENTRIES);
  expect(getRoutingDiagnostics().evictions).toBeGreaterThan(0);
  clearRoutingCacheForTests(); resetRoutingDiagnosticsForTests();
  const a = getConceptTrip('boston','miami','GREYHOUND')!;
  a.legs[0].line = 'mutated'; a.legs.pop();
  expect(getConceptTrip('boston','miami','GREYHOUND')?.legs[0].line).not.toBe('mutated');
  expect(getConceptTrip('miami','boston','GREYHOUND')?.origin).toBe('Miami');
  expect(getConceptTrip('boston','miami','FLIXBUS')?.legs[0].agency).toBe('FLIXBUS');
  expect(getRoutingDiagnostics()).toMatchObject({ cacheEntries: 3, cacheHits: 1 });
});

test('malformed IDs, unknown cities/profiles and unconnected nationwide places do not invent service', () => {
  for (const id of [null, undefined, '', 'east-boston--miami--bad', 'east-nyc--miami--amtrak', 'east-boston--miami--amtrak--extra', 'x'.repeat(1000)]) expect(getTripById(id)).toBeUndefined();
  expect(planTrips('Los Angeles','Miami')).toEqual([]);
  expect(planTrips('NYC','New York')).toEqual([]);
  expect(getRoutingDiagnostics().routeComputations).toBe(0);
});
