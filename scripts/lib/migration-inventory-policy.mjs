/**
 * Pure, read-only inventory policy. These known exceptions are NOT approvals
 * to execute, rename or reapply migrations. Any drift must be reviewed first.
 */
const duplicatesOf = (values) => [...new Set(values.filter((x, i) => values.indexOf(x) !== i))].sort();
const sorted = (values) => [...new Set(values)].sort();

export function reconcileMigrationInventory({ listed, numbered, timestamped, missingFiles = [], baseline }) {
  if (!Array.isArray(listed) || !Array.isArray(numbered) || !Array.isArray(timestamped)) {
    throw new TypeError('Migration inventory expects arrays');
  }
  if (baseline?.schema !== 'aurotap-migration-inventory-baseline-v1' ||
      !['unbundled', 'prefixCollisions', 'timestampVersionConflicts'].every((key) => Array.isArray(baseline[key]))) {
    throw new Error('MIGRATION_BASELINE_INVALID');
  }
  const entries = new Set(listed);
  const bundledPrefixes = new Set(listed.filter((f) => !f.startsWith('../'))
    .map((f) => f.match(/^(\d{3})_/)?.[1]).filter(Boolean));
  const unbundled = sorted(numbered.filter((f) => !entries.has(f)));
  const prefixCollisions = sorted(unbundled.filter((f) => bundledPrefixes.has(f.match(/^(\d{3})_/)?.[1])));
  const byVersion = new Map();
  for (const name of timestamped) {
    const version = name.match(/^(\d{12})_/ )?.[1];
    if (!version) throw new Error('INVALID_TIMESTAMPED_MIGRATION_NAME');
    byVersion.set(version, (byVersion.get(version) ?? 0) + 1);
  }
  const timestampVersionConflicts = sorted([...byVersion].filter(([, count]) => count > 1).map(([version]) => version));
  const baselineDrift = {};
  for (const [key, current] of Object.entries({ unbundled, prefixCollisions, timestampVersionConflicts })) {
    const expected = sorted(baseline[key]);
    const actual = new Set(current);
    const baselineSet = new Set(expected);
    baselineDrift[key] = {
      new: current.filter((x) => !baselineSet.has(x)),
      resolvedNeedsReview: expected.filter((x) => !actual.has(x)),
    };
  }
  const duplicateEntries = duplicatesOf(listed);
  const errors = [
    ...duplicateEntries.map((x) => 'DUPLICATE_BUNDLE_ENTRY: ' + x),
    ...sorted(missingFiles).map((x) => 'MISSING_BUNDLE_SQL: ' + x),
    ...Object.entries(baselineDrift).flatMap(([key, diff]) => [
      ...diff.new.map((x) => 'UNREVIEWED_' + key + ': ' + x),
      ...diff.resolvedNeedsReview.map((x) => 'STALE_BASELINE_' + key + ': ' + x),
    ]),
  ];
  return {
    duplicateEntries, missingFiles: sorted(missingFiles), unbundled,
    prefixCollisions, timestampVersionConflicts, baselineDrift,
    requiresManualReconciliation: Boolean(unbundled.length || prefixCollisions.length || timestampVersionConflicts.length),
    ciBlocked: errors.length > 0, errors,
  };
}
