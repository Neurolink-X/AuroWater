// /**
//  * Server-only. Resolves the Supabase service_role JWT used for admin API access.
//  * Supports a single alternate name used in some hosting templates.
//  */
// export function getSupabaseServiceRoleKey(): string | undefined {
//   const raw =
//     process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
//     process.env.SUPABASE_SERVICE_KEY?.trim() ||
//     '';
//   return raw || undefined;
// }

// /** Project ref from NEXT_PUBLIC_SUPABASE_URL host (e.g. mwfcwhxdlnqldciigicl). */
// export function getSupabaseProjectRefFromUrl(): string {
//   const host = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '') ?? '';
//   return host.split('.')[0] || '<project-ref>';
// }

// export function serviceRoleSetupHint(): string {
//   const ref = getSupabaseProjectRefFromUrl();
//   return (
//     '\n[AuroWater] ❌ SUPABASE_SERVICE_ROLE_KEY is missing.\n' +
//     `   Get it from: https://supabase.com/dashboard/project/${ref}/settings/api\n` +
//     '   Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>\n' +
//     '   Then restart: npm run dev\n'
//   );
// }



/**
 * src/lib/env/supabase-service-role.ts
 * Server-only. Never import this in client components.
 *
 * Resolves and validates the Supabase service_role JWT.
 * Supports alternate env var names used in some hosting templates.
 */

const SERVICE_ROLE_ENV_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',       // Vercel Supabase integration alias
  'SUPABASE_SECRET_KEY',        // some third-party templates
] as const;

// ─── Helpers ────────────────────────────────────────────────

/** Extract Supabase project ref from NEXT_PUBLIC_SUPABASE_URL */
export function getSupabaseProjectRefFromUrl(): string {
  const host =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '') ?? '';
  return host.split('.')[0] || '<project-ref>';
}

/** Check if a string looks like a valid JWT (3 base64 segments) */
function isValidJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/** Which env var name was resolved (for error messages) */
function resolveRaw(): { value: string; source: string } | null {
  for (const name of SERVICE_ROLE_ENV_NAMES) {
    const val = process.env[name]?.trim();
    if (val) return { value: val, source: name };
  }
  return null;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Returns the service role key if present and structurally valid.
 * Returns undefined if missing. Throws if present but malformed.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  const resolved = resolveRaw();
  if (!resolved) return undefined;

  if (!isValidJwt(resolved.value)) {
    throw new Error(
      `[AuroWater] ${resolved.source} is set but does not look like a valid JWT.\n` +
        `  Value starts with: "${resolved.value.slice(0, 20)}..."\n` +
        `  Expected format: eyJ...<header>.<payload>.<signature>\n` +
        `  Re-copy it from: https://supabase.com/dashboard/project/${getSupabaseProjectRefFromUrl()}/settings/api`
    );
  }

  return resolved.value;
}

/**
 * Like getSupabaseServiceRoleKey() but throws immediately if missing.
 * Use this in API routes that strictly require admin access.
 */
export function requireSupabaseServiceRoleKey(): string {
  const key = getSupabaseServiceRoleKey();
  if (!key) {
    throw new Error(serviceRoleSetupHint());
  }
  return key;
}

/**
 * Returns true if the service role key is present and valid.
 * Safe to call anywhere — never throws.
 */
export function hasSupabaseServiceRoleKey(): boolean {
  try {
    return getSupabaseServiceRoleKey() !== undefined;
  } catch {
    return false;
  }
}

/**
 * Human-readable setup hint for when the key is missing.
 * Used in logs and error responses.
 */
export function serviceRoleSetupHint(): string {
  const ref = getSupabaseProjectRefFromUrl();
  const tried = SERVICE_ROLE_ENV_NAMES.join(', ');
  return (
    `\n[AuroWater] ❌ Supabase service role key not found.\n` +
    `   Checked env vars: ${tried}\n` +
    `   Get it from: https://supabase.com/dashboard/project/${ref}/settings/api\n` +
    `   Then add ONE of these to your environment:\n` +
    `     SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>   ← preferred\n` +
    `   For Vercel: Dashboard → auro-water → Environment Variables\n` +
    `   For local:  .env.local (never commit this file)\n` +
    `   Then restart: npm run dev\n`
  );
}

/**
 * Diagnostic summary — safe to log at startup, never leaks key value.
 */
export function getServiceRoleStatus(): {
  present: boolean;
  valid: boolean;
  source: string | null;
  hint: string | null;
} {
  const resolved = resolveRaw();

  if (!resolved) {
    return {
      present: false,
      valid: false,
      source: null,
      hint: serviceRoleSetupHint(),
    };
  }

  const valid = isValidJwt(resolved.value);
  return {
    present: true,
    valid,
    source: resolved.source,
    hint: valid
      ? null
      : `${resolved.source} is set but is not a valid JWT. Re-copy from Supabase dashboard.`,
  };
}
