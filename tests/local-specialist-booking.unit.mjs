import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('professional booking fails closed before order and financial creation when no local approved specialist',()=>{
 const orders=read('../src/app/api/customer/orders/route.ts');
 const lookup=read('../src/lib/booking/local-specialist-readiness.ts');
 const position=orders.indexOf('await checkLocalSpecialistBooking(');
 const payment=orders.indexOf('const settingsResult = await settingsMap(');
 assert.ok(position>0 && payment>position, 'Readiness must run before price and order writes');
 assert.match(orders,/NO_LOCAL_SPECIALIST/);
 assert.match(lookup,/\.eq\('service_key',service\)\.eq\('status','approved'\)/);
 assert.match(lookup,/canonical\(p.city\)===city/);
 assert.match(lookup,/profiles/);
 assert.doesNotMatch(lookup,/\.from\('orders'\)\.insert/);
});
test('booking offers customer alternatives instead of false confirmation',()=>{
 const wizard=read('../src/components/booking/BookingWizard.tsx');
 assert.match(wizard,/NO_LOCAL_SPECIALIST/);
 assert.match(wizard,/Change service address/);
 assert.match(wizard,/Check coverage/);
 assert.match(wizard,/Contact support/);
});
test('customer and professional registered email displayed only in authenticated account APIs',()=>{
 const customer=read('../src/app/api/customer/profile/route.ts');
 const technician=read('../src/app/api/technician/specializations/route.ts');
 assert.match(customer,/auth\.ctx\.user\.email/);
 assert.match(technician,/auth\.ctx\.user\.email/);
 assert.match(technician,/requireRole\(auth.ctx, 'technician'\)/);
});
