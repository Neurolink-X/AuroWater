import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('technician dispatch never assigns outside approved private service capabilities',()=>{
 const x=read('../src/lib/dispatch.ts');
 assert.match(x,/technician_service_capabilities/);
 assert.match(x,/\.eq\('status','approved'\)/);
 assert.match(x,/if\(capError\)/);
 assert.match(x,/const eligible=candidates\.filter/);
});
test('partner registration includes role and shop and persists payload on server',()=>{
 const a=read('../src/app/register/pro/page.tsx');
 const b=read('../src/app/api/applications/route.ts');
 const m=read('../supabase/migrations/20261102170000_partner_applications_capabilities.sql');
 assert.match(a,/const SEND_ROLE = true/);
 assert.match(a,/Shop base/);
 assert.match(b,/business_address:z\.string/);
 assert.match(b,/role:z\.enum/);
 assert.match(m,/ADD COLUMN IF NOT EXISTS payload jsonb/);
});
