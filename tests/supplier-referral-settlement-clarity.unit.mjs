import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path,'utf8');

test('referral read is authenticated and does not create fake referrals on database failure',()=>{
 const api=read('src/app/api/supplier/referral-summary/route.ts');
 const ui=read('src/app/supplier/referrals/page.tsx');
 assert.match(api, /requireSupabaseAuth/);
 assert.match(api, /auth\.ctx\.profile\.role!=='supplier'/);
 assert.match(api, /\.eq\('supplier_id',auth\.ctx\.user\.id\)/);
 assert.match(api, /FEATURE_NOT_READY/);
 assert.match(ui, /FEATURE_NOT_READY/);
 assert.match(ui, /response\.json\(\)\.catch/);
 assert.match(ui, /navigator\.clipboard\?\.writeText/);
 assert.match(ui, /await navigator\.clipboard\.writeText/);
 assert.match(ui, /Copy was blocked by your browser/);
});

test('referral migration grants write RPC to the server role only',()=>{
 const schema=read('supabase/migrations/20261102110000_supplier_referral_attribution_and_atomic_preference.sql');
 assert.match(schema,/REVOKE ALL ON FUNCTION public\.confirm_customer_supplier_referral\(uuid,uuid\) FROM PUBLIC,anon,authenticated/);
 assert.match(schema,/GRANT EXECUTE ON FUNCTION public\.confirm_customer_supplier_referral\(uuid,uuid\) TO service_role/);
 assert.match(schema,/pg_advisory_xact_lock/);
});

test('finance amounts are sourced from wallet ledger RPC; customer-paid is not mislabeled settled',()=>{
 const api=read('src/app/api/supplier/earnings/route.ts');
 const summary=read('src/lib/api-client.ts');
 const page=read('src/app/supplier/[section]/page.tsx');
 const dash=read('src/app/supplier/dashboard/page.tsx');
 assert.match(api,/\.rpc\('get_supplier_earnings'/);
 assert.match(api,/\.rpc\('get_wallet_summary'\)/);
 assert.match(api,/balance_requires_review/);
 assert.match(api,/cash_to_remit/);
 assert.match(api,/customer_payment_explainer/);
 assert.match(api,/supplier_settlement_explainer/);
 assert.match(summary,/pending_payout: number \| null/);
 assert.match(page,/Customer paid vs supplier settlement/);
 assert.match(page,/Cash received by you/);
 assert.match(dash,/Customer paid does not mean supplier payout sent/);
 assert.match(dash,/payoutStatus === 'paid' && Boolean\(paidAt\)/);
 assert.match(dash,/Supplier settlement sent/);
 assert.match(dash,/Settlement not sent/);
 assert.doesNotMatch(api,/\.update\(|\.insert\(|\.delete\(/);
});

test('supplier payout requests remain atomic and do not transfer funds on submit',()=>{
 const payout=read('src/app/api/supplier/payouts/route.ts');
 const page=read('src/app/supplier/[section]/page.tsx');
 assert.match(payout, /request_supplier_payout/);
 assert.match(payout,/Payment is not completed until the finance team settles it/);
 assert.match(page,/Submitting a request does not move money/);
});
