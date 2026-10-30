import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runner = readFileSync(new URL('../scripts/test-dispatch-concurrency.mjs', import.meta.url), 'utf8');
assert.match(runner, /AUROWATER_ALLOW_DISPATCH_TESTS !== '1'/);
assert.match(runner, /AUROWATER_TEST_DATABASE_URL/);
assert.match(runner, /\/test\|staging\|branch\//);
assert.match(runner, /TEST-DISPATCH-/);
assert.match(runner, /try_assign_supplier_with_stock/);
assert.match(runner, /try_assign_technician/);
assert.match(runner, /exactly one winner/);
assert.match(runner, /two orders \/ one supplier stock pool/);

const inspector = readFileSync(new URL('../scripts/inspect-supabase-readiness.mjs', import.meta.url), 'utf8');
assert.match(inspector, /BEGIN READ ONLY/);
assert.match(inspector, /ROLLBACK/);
assert.doesNotMatch(inspector, /\b(?:INSERT INTO|UPDATE public|DELETE FROM|ALTER TABLE|CREATE TABLE|DROP TABLE)\b/i);

const migrationAudit = readFileSync(new URL('../scripts/audit-supabase-migrations.mjs', import.meta.url), 'utf8');
assert.match(migrationAudit, /existsSync\(join\(sqlDir, file\)\)/);
console.log('Database safety harness regression checks passed.');
