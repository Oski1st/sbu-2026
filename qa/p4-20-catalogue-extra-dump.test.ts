// P4-20: dump the follow-up overlay exports (PR #27) that the P4-19 dump does not cover. Run inside the candidate checkout.
// Skipped unless P4_20_EXTRA_OUT is set, so the normal `pnpm test` run is unaffected.
import { writeFileSync } from 'node:fs';
import { test } from 'vitest';

const out = process.env.P4_20_EXTRA_OUT;
test.skipIf(!out)('dump catalogue follow-up overlay exports', async () => {
  const c = await import('../src/data/nationalCities');
  const ids: string[] = c.nationalCities.map((x: { id: string }) => x.id);
  const choices: string[] = c.verifiedMarketChoices.map((x: { id: string }) => x.id);
  writeFileSync(out!, JSON.stringify({
    relations: c.nationalCityMarketRelations,
    busSourceProvenance: c.nationalBusSourceProvenance,
    batches: c.nationalEvidenceBatches,
    choices,
    canonical: Object.fromEntries(ids.map((id) => [id, c.getCanonicalMarketCityId(id)])),
    canonicalUnknown: c.getCanonicalMarketCityId('not-a-city') ?? null,
    marketEvidence: Object.fromEntries(choices.map((id) => [id, c.getVerifiedMarketEvidence(id)])),
    marketEvidenceViaAlias: Object.fromEntries(c.nationalCityMarketRelations.map((r: { cityId: string }) => [r.cityId, c.getVerifiedMarketEvidence(r.cityId)])),
  }));
});
