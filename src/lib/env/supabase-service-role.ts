/**
 * Server-only. Resolves the Supabase service_role JWT used for admin API access.
 * Supports a single alternate name used in some hosting templates.
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  const raw =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    '';
  return raw || undefined;
}

/** Project ref from NEXT_PUBLIC_SUPABASE_URL host (e.g. mwfcwhxdlnqldciigicl). */
export function getSupabaseProjectRefFromUrl(): string {
  const host = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, '') ?? '';
  return host.split('.')[0] || '<project-ref>';
}

export function serviceRoleSetupHint(): string {
  const ref = getSupabaseProjectRefFromUrl();
  return (
    '\n[AuroWater] ❌ SUPABASE_SERVICE_ROLE_KEY is missing.\n' +
    `   Get it from: https://supabase.com/dashboard/project/${ref}/settings/api\n` +
    '   Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>\n' +
    '   Then restart: npm run dev\n'
  );
}
