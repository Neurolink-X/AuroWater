import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Supabase refresh is single-flight across concurrent API callers', () => {
  const source = read('../../src/lib/api-client.ts');
  assert.match(source, /let refreshInFlight:/);
  assert.match(source, /if \(refreshInFlight\) return refreshInFlight/);
  assert.match(source, /refreshInFlight = \(async \(\) =>/);
  assert.match(source, /finally \{\s*refreshInFlight = null/);
  assert.ok((source.match(/refreshSessionSingleFlight\(\)/g) ?? []).length >= 3);
  assert.match(source, /inFlightGetRequests = new Map/);
  assert.match(source, /method !== 'GET' \|\| init.signal/);
});

test('verification document downloads use the existing owner/admin signed URL route', () => {
  const client = read('../../src/lib/private-file-client.ts');
  const route = read('../../src/app/api/files/[id]/route.ts');
  const adminPage = read('../../src/app/admin/verification/page.tsx');
  assert.match(client, /\/api\/files\/\$\{encodeURIComponent\(id\)\}\?disposition=\$\{disposition\}/);
  assert.match(route, /export async function GET/);
  assert.match(route, /createSignedUrl/);
  assert.match(route, /if \(!isOwner && !isAdmin\)/);
  assert.match(route, /SIGNED_URL_SECONDS = 60/);
  assert.match(adminPage, /getSignedFileUrl\(f\.id, 'attachment'\)/);
  assert.match(adminPage, /Download/);
});

test('verification storage migration keeps the bucket private and metadata inaccessible to browser roles', () => {
  const migration = read('../../supabase/migrations/202610300002_private_file_storage.sql');
  assert.match(migration, /'private-user-files',[\s\S]*?false/);
  assert.match(migration, /alter table public\.user_files enable row level security/i);
  assert.match(migration, /revoke all on public\.user_files from anon, authenticated/i);
  assert.match(migration, /grant all on public\.user_files to service_role/i);
  assert.doesNotMatch(migration, /create policy[\s\S]*?on storage\.objects/i);
});

test('waitlist endpoint does not log raw submitted contact details', () => {
  const route = read('../../src/app/api/waitlist/route.ts');
  assert.doesNotMatch(route, /console\\.(?:log|info|debug)\\([^\\n]*(phone|email|name|body)/i);
});
