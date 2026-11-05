import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('private technician verification requests carry a fresh bearer token', () => {
  const page = read('src/app/technician/dashboard/page.tsx');
  const server = read('src/app/api/technicians/documents/route.ts');
  assert.match(page, /async function technicianAuthHeaders/);
  assert.match(page, /const token = await getToken\(\)/);
  assert.match(page, /headers, body: form/);
  assert.match(page, /headers: \{ \.\.\.headers, 'Content-Type': 'application\/json' \}/);
  assert.match(page, /fetch\('\/api\/technicians\/documents', \{ headers, cache: 'no-store' \}/);
  assert.match(server, /requireSupabaseAuth\(req\)/);
  assert.match(page, /response\.status === 401/);
});

test('valid Supabase session is not signed out after a single API 401', () => {
  const client = read('src/lib/api-client.ts');
  assert.match(client, /single endpoint's 401 is not proof/);
  assert.match(client, /stateError && !state\.session/);
  assert.doesNotMatch(client.slice(client.indexOf('async function apiFetchAuth'), client.indexOf('export type LoginResult')), /auth\.signOut\(/);
});

test('registration keeps technician skill and city selections compact and persists unverified preferences', () => {
  const page = read('src/app/auth/register/RegisterClient.tsx');
  const api = read('src/app/api/auth/register/route.ts');
  assert.match(page, /function MultiChoicePicker/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /requested_skills: skills/);
  assert.match(page, /requested_service_cities:/);
  assert.match(api, /requested_skills: role === 'technician'/);
  assert.match(api, /requested_service_cities: role === 'technician'/);
  assert.match(api, /service capabilities granted separately/);
});

test('technician profile preferences are isolated per user and role authorizations remain server-side', () => {
  const page = read('src/app/technician/dashboard/page.tsx');
  assert.match(page, /\$\{KEYS\.PROFILE\}:\$\{storageOwner\}/);
  assert.match(page, /createClient\(\)\.auth\.getUser\(\)/);
  assert.match(page, /createClient\(\)\.auth\.updateUser/);
  assert.match(page, /Admin-reviewed technician_service_capabilities/);
  assert.match(page, /href="\/notifications"/);
  assert.match(page, /जॉब अलर्ट/);
});

test('device push needs explicit permission and in-app notifications remain accessible', () => {
  const notifications = read('src/app/notifications/page.tsx');
  const route = read('src/app/api/notifications/push/route.ts');
  assert.match(notifications, /Notification\.requestPermission\(\)/);
  assert.match(notifications, /New orders and job updates remain available in the app even if push is disabled/);
  assert.match(route, /parsed\.action === 'disable'/);
  assert.match(route, /push_enabled: true/);
});
