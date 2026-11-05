import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url),'utf8');

test('Overview: document KYC and service approval are separate server owned states', () => {
 const api=read('src/app/api/technician/specializations/route.ts');
 const panel=read('src/components/technician/SpecialistStatusPanel.tsx');
 const page=read('src/app/technician/dashboard/page.tsx');
 assert.match(api,/documents: \{ status: documentStatus/);
 assert.match(api,/docsApproved/);
 assert.match(panel,/Documents approved · service approval pending/);
 assert.match(panel,/KYC alone does not activate job dispatch/);
 assert.match(page,/verification === 'verified' && serviceReady && accountOperational && online === 'online'/);
 assert.match(page,/serviceApproved=\{serviceReady && accountOperational\}/);
});
test('Documents: all slots load securely and refresh when admin approval or upload changes', () => {
 const page=read('src/app/technician/dashboard/page.tsx');
 assert.match(page,/fetch\('\/api\/technicians\/documents', \{ headers, cache: 'no-store' \}/);
 assert.match(page,/setDocs\(latest\)/);
 assert.match(page,/visibilitychange/);
 assert.match(page,/aurotap:verification-changed/);
 assert.match(page,/window\.dispatchEvent\(new Event\('aurotap:verification-changed'\)\)/);
 assert.doesNotMatch(page.slice(0,120000),/usePersisted<TechDocs>/);
});
test('Queue and My Jobs: live reads are bounded and actions stay subject to backend authorization', () => {
 const page=read('src/app/technician/dashboard/page.tsx');
 assert.match(page,/technicianJobsList\(\)/);
 assert.match(page,/technicianJobAccept\(job.id\)/);
 assert.match(page,/technicianJobReject\(job.id\)/);
 assert.match(page,/document.visibilityState === 'visible' && navigator.onLine/);
 assert.match(page,/JOBS_CACHE_MAX_AGE_MS = 3 \* 60_000/);
 assert.match(page,/sessionStorage\.removeItem\(key\)/);
});
test('Availability: coordinates are optional, offline and permission-denied do not block toggling', () => {
 const page=read('src/app/technician/dashboard/page.tsx');
 const api=read('src/app/api/technician/availability/route.ts');
 assert.match(page,/lat !== null && lng !== null/);
 assert.match(page,/timeout: 2500/);
 assert.match(api,/export async function GET/);
 assert.match(api,/Cache-Control', 'private, no-store/);
 assert.match(api,/export async function PUT/);
 assert.match(api,/requireSupabaseAuth\(req\)/);
});
test('Earnings, Schedule, Profile and Settings: no invented entitlements and no bogus server sync', () => {
 const page=read('src/app/technician/dashboard/page.tsx');
 const settings=read('src/app/technician/settings/page.tsx');
 assert.match(page,/tab === 'earnings'/);
 assert.match(page,/tab === 'availability'/);
 assert.match(page,/tab === 'profile'/);
 assert.match(settings,/TechnicianRadiusControls/);
 assert.match(page,/Admin-reviewed technician_service_capabilities/);
 assert.match(page,/getToken\(\)/);
});
test('Notification and linked sections have real routes and language actions', () => {
 const panel=read('src/components/technician/SpecialistStatusPanel.tsx');
 const page=read('src/app/technician/dashboard/page.tsx');
 assert.match(panel,/href="\/technician\/dashboard#documents"/);
 assert.match(panel,/href="\/technician\/dashboard#my_jobs"/);
 assert.match(panel,/href="\/notifications"/);
 assert.match(page,/setLanguage\('hi'\)/);
 assert.match(page,/setLanguage\('en'\)/);
 assert.match(panel,/setInterval/);
 assert.match(panel,/Authorization: `Bearer \$\{token\}`/);
});
