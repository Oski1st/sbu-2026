import { expect, test, vi } from 'vitest';

test('cold production App/data imports perform zero routing and retain only original demo exports', async () => {
  vi.resetModules();
  await import('../../App');
  const { demoTrips } = await import('../demoTrips');
  const { getRoutingDiagnostics } = await import('../tripLookup');
  expect(demoTrips.map(trip => trip.id)).toEqual(['regional-connection', 'amtrak-connection']);
  expect(demoTrips.map(trip => trip.durationMinutes)).toEqual([315, 250]);
  const golden = [
    [['08:00','08:55'],['09:10','10:40'],['11:00','12:10'],['12:25','13:15']],
    [['08:30','09:50'],['10:10','11:20'],['11:45','12:40']],
  ].map(trip => trip.map(pair => pair.map(time => `2026-10-24T${time}:00-04:00`)));
  expect(demoTrips.map(trip => trip.legs.map(leg => [leg.departure, leg.arrival]))).toEqual(golden);
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
