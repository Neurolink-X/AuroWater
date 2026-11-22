import { getSupabaseServiceRoleKey, serviceRoleSetupHint } from '@/lib/env/supabase-service-role';

/**
 * Next.js instrumentation — runs once on server startup (Node runtime).
 * Validates Supabase env so misconfiguration is obvious in logs.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon =
    (
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )?.trim() ?? '';

  if (!url || !anon) {
    console.error(
      '[AuroWater] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY / PUBLISHABLE_KEY. Auth and DB API routes will return 503 until set.'
    );
  }

  if (!getSupabaseServiceRoleKey()) {
    console.error(serviceRoleSetupHint());
  }

  if (process.env.AUROWATER_LOG_SUPABASE_DX === '1') {
    console.info(
      "[AuroWater] PostgREST PGRST205 after migrations? Run sql/reload_postgrest_schema.sql (NOTIFY pgrst, 'reload schema')."
    );
  }
}

/** Unhandled server/API/render exceptions; never store raw exception content. */
export const onRequestError: import('next').Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { classifyPlatformError, safeErrorPath, errorGroup } = await import('@/lib/observability/platform-errors');
  const { recordPlatformError } = await import('@/lib/observability/platform-errors.server');
  const path = safeErrorPath(context.routePath || request.path);
  await recordPlatformError({ code: classifyPlatformError(error), path, group: errorGroup(path), source: 'server', status: 500 });
};
