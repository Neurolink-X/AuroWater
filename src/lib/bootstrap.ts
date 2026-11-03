import { queryOne, query } from '@/lib/db/connection';

let bootstrapRun = false;

export async function runBootstrapOnce() {
  if (bootstrapRun) return;
  bootstrapRun = true;

  await ensureDefaultAdmin();
  await ensureDefaultAppSettings();
}

/**
 * Never seed an admin account using a source-controlled fixed password.
 * Administrator creation must use the approved Supabase Auth/invitation flow
 * and be explicitly authorized by an operator.
 *
 * This is legacy bootstrap code (no active imports found in the repository).
 * Keeping this function as a no-op preserves the exported bootstrap signature
 * without creating a privileged account through a known credential.
 */
async function ensureDefaultAdmin(): Promise<void> {
  // Deliberately disabled: no implicit privileged user creation.
}

async function ensureDefaultAppSettings() {
  const existing = await queryOne('SELECT id FROM app_settings ORDER BY updated_at DESC LIMIT 1');
  if (existing) return;

  await query(
    `INSERT INTO app_settings (support_email, secondary_email, phone_primary, office_address, working_hours)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'support.aurotap@gmail.com',
      null,
      '9889305803',
      'Auro Water / AuroTap',
      '09:00–21:00 IST',
    ]
  );
}

