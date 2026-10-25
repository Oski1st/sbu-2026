// P4-19: dump the national catalogue runtime exports (PR #20) for qa/p4-19-catalogue-audit.py.
// Run inside a catalogue checkout. Skipped unless P4_19_DUMP_OUT is set, so the normal `pnpm test` run is unaffected.
import { writeFileSync } from 'node:fs';
import { test } from 'vitest';

const out = process.env.P4_19_DUMP_OUT;
test.skipIf(!out)('dump national catalogue exports', async () => {
  const catalogue = await import('../src/data/nationalCities');
  writeFileSync(out!, JSON.stringify({
    nationalCities: catalogue.nationalCities,
    verifiedIds: catalogue.verifiedNationalCities.map((c: { id: string }) => c.id),
    majorIds: catalogue.majorCityCandidates.map((c: { id: string }) => c.id),
    audit: catalogue.nationalCoverageAudit,
    verifiedOperators: Object.fromEntries(catalogue.nationalCities.map((c: { id: string }) => [c.id, catalogue.getVerifiedOperators(c.id)])),
    unknownLookup: catalogue.getVerifiedOperators('not-a-city'),
    sourcesKeys: Object.keys(catalogue.nationalCatalogueSources),
  }));
});
