/**
 * Audits the manually ordered SQL bundle without changing or applying migrations.
 * The legacy sql/ stream and timestamped supabase/migrations stream are reported
 * separately: they must not be merged automatically because deployment history
 * may already contain independently applied patches.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlDir = join(root, 'sql');
const builderPath = join(root, 'scripts', 'build-supabase-migrations.mjs');
const builder = readFileSync(builderPath, 'utf8');
const match = builder.match(/const files = \[([\s\S]*?)\n\];/);

if (!match) {
  console.error('Unable to locate the explicit migration order in scripts/build-supabase-migrations.mjs');
  process.exit(2);
}

const listed = [...match[1].matchAll(/'([^']+\.sql)'/g)].map((item) => item[1]);
const listedSet = new Set(listed);
const duplicates = listed.filter((file, index) => listed.indexOf(file) !== index);
const missingFiles = listed.filter((file) => !readdirSync(sqlDir).includes(file));
const numberedFiles = readdirSync(sqlDir)
  .filter((file) => /^\d{3}_.*\.sql$/i.test(file))
  .sort((a, b) => a.localeCompare(b));
const unbundled = numberedFiles.filter((file) => !listedSet.has(file));
const timestamped = readdirSync(join(root, 'supabase', 'migrations'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^\d{12}_.*\.sql$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

console.log(`Legacy SQL bundle: ${listed.length} explicitly ordered files`);
console.log(`Numbered SQL source files: ${numberedFiles.length}`);
console.log(`Timestamped Supabase migrations (separate stream): ${timestamped.length}`);

if (duplicates.length) console.error('Duplicate bundle entries:', [...new Set(duplicates)].join(', '));
if (missingFiles.length) console.error('Bundle references missing files:', [...new Set(missingFiles)].join(', '));
if (unbundled.length) {
  console.error('Numbered SQL files not represented in the bundle (review; do not auto-append):');
  for (const file of unbundled) console.error(`  - ${file}`);
}
if (timestamped.length) {
  console.log('Timestamped migrations are intentionally not merged into the legacy bundle:');
  for (const file of timestamped) console.log(`  - ${file}`);
}

if (duplicates.length || missingFiles.length || unbundled.length) {
  console.error('Migration audit requires human reconciliation before a fresh-environment bundle can be trusted.');
  process.exitCode = 1;
} else {
  console.log('Migration source inventory matches the explicit bundle.');
}
