import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('specialist profile uses private registered email and existing responsive service photos',()=>{
 const panel=read('../src/components/technician/SpecialistStatusPanel.tsx');
 const api=read('../src/app/api/technician/specializations/route.ts');
 const settings=read('../src/app/technician/settings/page.tsx');
 assert.match(api,/auth\.ctx\.user\.email/);
 assert.match(api,/requireRole\(auth.ctx, 'technician'\)/);
 for (const image of ['plumbing.webp','borewell.webp','tank_cleaning.webp','ro_service.webp','motor_pump.webp']) {
  assert.ok(panel.includes(image), 'Missing service image: '+image);
  assert.ok(settings.includes(image), 'Missing settings image: '+image);
 }
 assert.match(panel,/Registered email/);
 assert.match(settings,/SpecialistStatusPanel/);
 assert.match(settings,/LanguageToggle/);
});
test('specialist verification is bounded, deduplicated, auth-scoped and not persisted',()=>{
 const panel=read('../src/components/technician/SpecialistStatusPanel.tsx');
 assert.match(panel,/AbortSignal\.timeout\(REQUEST_MS\)/);
 assert.match(panel,/const pending = new Map/);
 assert.match(panel,/cached\.get\(userId\)/);
 assert.match(panel,/const data = enabled && userId === record\?\.userId/);
 assert.match(panel,/setRecord\(null\)/);
 assert.doesNotMatch(panel,/localStorage|sessionStorage/);
});
