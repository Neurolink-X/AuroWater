import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('parallel offers are opt-in only and never fall back while active',()=>{
 const s=read('src/lib/dispatch.ts').split('export async function dispatchOrder(')[1]?.split('export async function diagnoseOrderDispatch(')[0]??'';
 assert.match(s,/PARALLEL_OFFERS_OPT_IN/);
 assert.match(s,/parallel_supplier_offers_enabled/);
 assert.match(s,/issue_parallel_water_offers/);
 assert.match(s,/openOffers/);
 assert.match(s,/if\(\(openOffers\?\?\[\]\)\.length>0\) return/);
});
test('one winner with order locking and stock reservation only when claiming',()=>{
 const sql=read('supabase/migrations/20261103120000_safe_parallel_supplier_offers.sql');
 assert.match(sql,/FROM public.orders WHERE id=v_offer.order_id FOR UPDATE/);
 assert.match(sql,/try_assign_supplier_with_stock/);
 assert.match(sql,/UPDATE public.order_supplier_offers SET status='LOST'/);
 assert.match(sql,/parallel_supplier_offers_enabled/);
 assert.match(sql,/supplier_active_order_limit_valid/);
});
test('supplier offer and demand endpoints do not leak customer details',()=>{
 const offer=read('src/app/api/supplier/nearby-offers/route.ts');
 const demand=read('src/app/api/supplier/local-demand/route.ts');
 assert.match(offer,/requireRole\(auth.ctx,'supplier'\)/);
 assert.match(demand,/x.customers.size<5/);
 assert.match(demand,/orders\?\.length\?\?0\)>2000/);
 assert.doesNotMatch(demand,/\.select\('.*address_snapshot/);
});
