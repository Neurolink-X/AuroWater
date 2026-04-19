/**
 * Validates required server env for local development.
 * Run: node scripts/verify-env.mjs
 * Loads .env.local then .env (same order as Next.js).
 */
import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (existsSync(resolve(root, '.env.local'))) {
  config({ path: resolve(root, '.env.local') });
}
config({ path: resolve(root, '.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon =
  (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim() ?? '';
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim() || '';

let failed = false;
if (!url || !anon) {
  console.error('[verify-env] Missing NEXT_PUBLIC_SUPABASE_URL or anon/publishable key.');
  failed = true;
}
if (!service) {
  const host = url?.replace(/^https?:\/\//, '') ?? '';
  const ref = host.split('.')[0] || '<project-ref>';
  console.error(
    '[verify-env] SUPABASE_SERVICE_ROLE_KEY is empty.\n' +
      `  Paste the service_role secret from: https://supabase.com/dashboard/project/${ref}/settings/api\n` +
      '  into .env.local, then restart the dev server.\n'
  );
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log('[verify-env] Supabase env OK (URL, anon, service role present).');
process.exit(0);
