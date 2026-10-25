// P4-16: in-process (Node/vitest import) checks of on-demand routing. Run inside a checkout of the candidate.
// These are module-import results, not browser measurements.
// Skipped unless P4_16_BASELINE_IN is set, so the normal `pnpm test` run is unaffected.
import { describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const enabled = !!process.env.P4_16_BASELINE_IN;
const baseline = enabled ? JSON.parse(readFileSync(process.env.P4_16_BASELINE_IN!, 'utf8')) : [];

describe.skipIf(!enabled)('P4-16 routing', () => {
  test('cold import of App, data and lookup does no routing or trip creation', async () => {
    vi.resetModules();
    await import('../src/App');
    const { demoTrips } = await import('../src/data/demoTrips');
    const { getRoutingDiagnostics } = await import('../src/data/tripLookup');
    const d = getRoutingDiagnostics();
    expect(d).toMatchObject({ startupRouteComputations: 0, routeComputations: 0, tripCreations: 0, cacheEntries: 0, totalQueries: 0 });
    expect(demoTrips.map((t: { id: string }) => t.id)).toEqual(['regional-connection', 'amtrak-connection']);
    console.log('DIAG', JSON.stringify(d));
  });

  test('every baseline trip (eager list at 49742e7) is reproduced exactly by getTripById', async () => {
    vi.resetModules();
    const { getTripById, clearRoutingCacheForTests } = await import('../src/data/tripLookup');
    const mismatches: string[] = [];
    for (const trip of baseline) {
      clearRoutingCacheForTests();
      const got = getTripById(trip.id);
      if (JSON.stringify(got) !== JSON.stringify(trip)) mismatches.push(trip.id);
    }
    console.log('BASELINE_TRIPS', baseline.length, 'MISMATCHES', mismatches.length, mismatches.slice(0, 5).join(','));
    expect(baseline.length).toBeGreaterThan(1000);
    expect(mismatches).toEqual([]);
  });

  test('cache is bounded, evicts oldest, and returns isolated copies', async () => {
    vi.resetModules();
    const m = await import('../src/data/tripLookup');
    m.clearRoutingCacheForTests(); m.resetRoutingDiagnosticsForTests();
    const ids = baseline.filter((t: { id: string }) => t.id.startsWith('east-')).map((t: { id: string }) => t.id);
    const n = m.ROUTING_CACHE_MAX_ENTRIES + 25;
    for (const id of ids.slice(0, n)) m.getTripById(id);
    const d = m.getRoutingDiagnostics();
    expect(d.cacheEntries).toBe(m.ROUTING_CACHE_MAX_ENTRIES);
    expect(d.evictions).toBe(25);
    // Most recent entry is a hit; the very first was evicted and must be recomputed.
    const before = m.getRoutingDiagnostics().routeComputations;
    m.getTripById(ids[n - 1]);
    expect(m.getRoutingDiagnostics().routeComputations).toBe(before);
    m.getTripById(ids[0]);
    expect(m.getRoutingDiagnostics().routeComputations).toBe(before + 1);
    // Mutating a returned trip must not poison the cache.
    const a = m.getTripById(ids[n - 1])!;
    a.legs[0].from = 'MUTATED'; a.durationMinutes = -1; (a.legs as unknown[]).push({});
    const b = m.getTripById(ids[n - 1])!;
    expect(b.legs[0].from).not.toBe('MUTATED'); expect(b.durationMinutes).toBeGreaterThan(0);
    expect(b).toEqual(baseline.find((t: { id: string }) => t.id === ids[n - 1]));
    console.log('CACHE', JSON.stringify(m.getRoutingDiagnostics()));
  });

  test('versions are part of every key; direction and profile are separate entries', async () => {
    vi.resetModules();
    const m = await import('../src/data/tripLookup');
    expect(m.ROUTING_DATASET_VERSION).toMatch(/\S/); expect(m.ROUTING_CACHE_VERSION).toMatch(/\S/);
    const src = readFileSync('src/data/tripLookup.ts', 'utf8');
    expect(src).toMatch(/JSON\.stringify\(\[ROUTING_DATASET_VERSION, ROUTING_CACHE_VERSION,/);
    m.clearRoutingCacheForTests();
    const ab = m.getTripById('east-boston--new-york--amtrak')!, ba = m.getTripById('east-new-york--boston--amtrak')!;
    const g = m.getTripById('east-boston--new-york--greyhound')!;
    expect(ab.origin).toBe('Boston'); expect(ba.origin).toBe('New York'); expect(g.legs[0].agency).toBe('GREYHOUND');
    expect(m.getRoutingDiagnostics().cacheEntries).toBe(3);
  });

  test('invalid, malformed, oversized and same-city IDs return undefined; aliases plan correctly', async () => {
    vi.resetModules();
    const m = await import('../src/data/tripLookup');
    for (const bad of ['bogus', 'east-boston--atlantis--greyhound', 'east-boston--boston--amtrak', 'east-boston--new-york', 'east-boston--new-york--bus',
      'east-' + 'a'.repeat(200) + '--b--amtrak', '', 'east-philadelphia--stony-brook--amtrak']) {
      expect(m.getTripById(bad)).toBeUndefined();
    }
    expect(m.getTripById(null)).toBeUndefined();
    expect(m.planTrips('NYC', 'DC').map((t) => t.id)).toEqual(['east-new-york--washington--amtrak', 'east-new-york--washington--greyhound', 'east-new-york--washington--flixbus']);
    expect(m.planTrips('Philly', 'Long Island').map((t) => t.id)).toEqual(['regional-connection', 'amtrak-connection']);
    expect(m.planTrips('Atlantis', 'Boston')).toEqual([]);
    expect(m.planTrips('boston', 'Boston')).toEqual([]);
  });

  test('production source no longer builds every pair at module scope', () => {
    const prod = ['src/data/demoTrips.ts', 'src/data/tripLookup.ts', 'src/pages/SearchPage.tsx', 'src/pages/JourneyPage.tsx', 'src/pages/WalletPage.tsx', 'src/components/layout/TripContext.tsx', 'src/App.tsx'];
    for (const f of prod) expect(readFileSync(f, 'utf8')).not.toMatch(/buildEastCoastTrips\s*\(/);
  });
});
