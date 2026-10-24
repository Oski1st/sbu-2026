import { expect, test, vi } from 'vitest';

test('cold production App/data imports perform zero routing and retain only original demo exports', async () => {
  vi.resetModules();
  await import('../../App');
  const { demoTrips } = await import('../demoTrips');
  const { getRoutingDiagnostics } = await import('../tripLookup');
  expect(demoTrips.map(trip => trip.id)).toEqual(['regional-connection', 'amtrak-connection']);
  expect(demoTrips.map(trip => trip.durationMinutes)).toEqual([315, 250]);
  expect(getRoutingDiagnostics()).toMatchObject({ startupRouteComputations: 0,
    routeComputations: 0, tripCreations: 0, cacheEntries: 0, totalQueries: 0 });
});

test('expanded IDs reconstruct after cold imports without search, saved selection or eager fixtures', async () => {
  vi.resetModules();
  const { getTripById, getRoutingDiagnostics, clearRoutingCacheForTests } = await import('../tripLookup');
  expect(getRoutingDiagnostics().routeComputations).toBe(0);
  for (const profile of ['amtrak', 'greyhound', 'flixbus']) {
    clearRoutingCacheForTests();
    const trip = getTripById(`east-portland--miami--${profile}`)!;
    expect(trip.origin).toBe('Portland'); expect(trip.destination).toBe('Miami');
    expect(trip.legs[0].departure).toContain('2026-10-24');
    expect(Date.parse(trip.legs.at(-1)!.arrival)).toBeGreaterThan(Date.parse(trip.legs[0].departure));
  }
  expect(getTripById('east-unknown--miami--amtrak')).toBeUndefined();
});
