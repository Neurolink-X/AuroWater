import { queryOne, query } from '@/lib/db/connection';
import { hashPassword } from '@/lib/auth/jwt';

let bootstrapRun = false;

export async function runBootstrapOnce() {
  if (bootstrapRun) return;
  bootstrapRun = true;

  await ensureDefaultAdmin();
  await ensureDefaultAppSettings();
}

async function ensureDefaultAdmin() {
  const phone = '9889305803';
  const email = 'Arjunchaurasiya1254@gmail.com';
  const full_name = 'Admin';
  const password = '@India#23';

  const existing = await queryOne('SELECT id FROM users WHERE phone = $1 OR email = $2', [
    phone,
    email,
  ]);
  if (existing) return;

  const password_hash = await hashPassword(password);
  const user = await queryOne(
    `INSERT INTO users (phone, email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, $4, 'ADMIN', true)
     RETURNING id`,
    [phone, email, password_hash, full_name]
  );

  if (!user) {
    // If this fails, we just log and continue; normal auth errors will surface.
    console.error('Failed to create default admin user');
  }
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

