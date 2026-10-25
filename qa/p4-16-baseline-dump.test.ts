// P4-16 helper: run inside a checkout of the BASELINE (readiness 49742e7), where demoTrips is built eagerly.
// Writes every baseline trip to $P4_16_BASELINE_OUT for an independent equivalence check on the candidate.
// Skipped unless P4_16_BASELINE_OUT is set, so the normal `pnpm test` run is unaffected.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';

test.skipIf(!process.env.P4_16_BASELINE_OUT)('dump baseline eager trips', async () => {
  const { demoTrips } = await import('../src/data/demoTrips');
  writeFileSync(process.env.P4_16_BASELINE_OUT ?? 'baseline-trips.json', JSON.stringify(demoTrips));
});
