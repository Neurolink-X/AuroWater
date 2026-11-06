import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileMigrationInventory } from '../../scripts/lib/migration-inventory-policy.mjs';

const baseline = JSON.parse(readFileSync('scripts/migration-inventory-baseline.json', 'utf8'));
const sample = {
  listed: ['001_core.sql', '006_current.sql'],
  numbered: ['001_core.sql', '006_current.sql', '006_old.sql'],
  timestamped: ['202610300003_one.sql', '202610300003_two.sql'],
  missingFiles: [],
  baseline: {
    schema: baseline.schema,
    unbundled: ['006_old.sql'],
    prefixCollisions: ['006_old.sql'],
    timestampVersionConflicts: ['202610300003'],
  },
};
test('existing documented inventory debt is not mistaken for a verified clean schema', () => {
  const r = reconcileMigrationInventory(sample);
  assert.equal(r.requiresManualReconciliation, true);
  assert.equal(r.ciBlocked, false);
  assert.deepEqual(r.timestampVersionConflicts, ['202610300003']);
});
test('new unbundled SQL or conflicting version fails the protected inventory gate', () => {
  const r = reconcileMigrationInventory({
    ...sample,
    numbered: [...sample.numbered, '007_new.sql'],
    timestamped: [...sample.timestamped, '202610300004_one.sql', '202610300004_two.sql'],
  });
  assert.equal(r.ciBlocked, true);
  assert.ok(r.errors.some((s) => s.includes('007_new.sql')));
  assert.ok(r.errors.some((s) => s.includes('202610300004')));
});
test('removed baseline debt requires explicit reconciliation review', () => {
  const r = reconcileMigrationInventory({ ...sample, numbered: sample.numbered.slice(0, 2) });
  assert.ok(r.ciBlocked);
  assert.ok(r.errors.some((s) => s.startsWith('STALE_BASELINE_unbundled')));
});
test('duplicate or missing ordered migration cannot bypass the baseline', () => {
  const r = reconcileMigrationInventory({ ...sample, listed: [...sample.listed, '006_current.sql'], missingFiles: ['does_not_exist.sql'] });
  assert.equal(r.ciBlocked, true);
  assert.ok(r.duplicateEntries.includes('006_current.sql'));
  assert.ok(r.errors.some((s) => s.startsWith('MISSING_BUNDLE_SQL')));
});
