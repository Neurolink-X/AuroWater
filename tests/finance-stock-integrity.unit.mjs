import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/inspect-supabase-readiness.mjs', import.meta.url), 'utf8');
assert.match(source, /BEGIN READ ONLY/);
assert.match(source, /paid_missing_earning/);
assert.match(source, /payout_paid_without_earning/);
assert.match(source, /noncompleted_with_earning/);
assert.match(source, /reservations_exceed_stock/);
assert.match(source, /finance_integrity: financeIntegrity.rows\[0\]/);
assert.match(source, /stock_integrity: stockIntegrity.rows\[0\]/);
assert.doesNotMatch(source, /(?:INSERT INTO|UPDATE public|DELETE FROM|ALTER TABLE|CREATE TABLE|DROP TABLE)/i);
console.log('Finance and stock audit remains read-only.');
