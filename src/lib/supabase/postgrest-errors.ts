/**
 * PostgREST / Supabase JS error classification for API routes.
 * See: https://postgrest.org/en/stable/references/errors.html
 */

export type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

/** PostgreSQL permission denied */
export function isRlsOrPermissionDeniedError(err: PostgrestErrorLike | null | undefined): boolean {
  if (!err) return false;
  const c = String(err.code ?? '');
  return c === '42501';
}

/** PGRST205 — object exists in Postgres but not in PostgREST schema cache (reload fixes). */
export function isPostgrestSchemaStaleError(err: PostgrestErrorLike | null | undefined): boolean {
  return String(err?.code ?? '') === 'PGRST205';
}

/** SQLSTATE 42P01 — undefined_table */
export function isPostgresUndefinedTableError(err: PostgrestErrorLike | null | undefined): boolean {
  return String(err?.code ?? '') === '42P01';
}

/**
 * Table/relation not queryable via PostgREST: stale cache, missing relation, or similar.
 * Used for profiles and other public tables.
 */
export function isPostgrestTableUnavailableError(err: PostgrestErrorLike | null | undefined): boolean {
  if (!err?.message && !err?.code) return false;
  const code = String(err.code ?? '');
  if (code === 'PGRST205' || code === '42P01') return true;
  const m = (err.message ?? '').toLowerCase();
  return (
    m.includes('schema cache') ||
    m.includes('could not find the table') ||
    (m.includes('relation') && m.includes('does not exist'))
  );
}

/** @deprecated alias — same as {@link isPostgrestTableUnavailableError} */
export const isProfilesSchemaMissingError = isPostgrestTableUnavailableError;

/**
 * User-facing 503 when {@link isPostgrestTableUnavailableError} is true.
 * @param resource — e.g. "public.profiles", "service_types"
 */
export function postgrestTableUnavailableUserMessage(
  err: PostgrestErrorLike,
  resource = 'the database'
): string {
  const code = String(err.code ?? '');
  if (code === 'PGRST205') {
    return (
      `PostgREST cannot see ${resource} yet (PGRST205: schema cache). If migrations already ran, ` +
      "execute in Supabase SQL Editor: NOTIFY pgrst, 'reload schema'; then retry. " +
      'Otherwise run sql/ALL_MIGRATIONS_ORDERED.sql (001–006).'
    );
  }
  return (
    `Required data is not available (${resource}, ${code || 'unknown'}). ` +
      'Run sql/ALL_MIGRATIONS_ORDERED.sql (001–006), then NOTIFY pgrst, \'reload schema\';'
  );
}

/** Profiles SELECT — legacy copy used by auth routes */
export function profileTableUnavailableMessage(err: PostgrestErrorLike): string {
  if (isPostgrestSchemaStaleError(err)) {
    return postgrestTableUnavailableUserMessage(err, 'public.profiles');
  }
  return (
    'Database not ready: run sql/001_core_schema.sql through sql/006_schema_compat.sql (or ALL_MIGRATIONS_ORDERED.sql) in the Supabase SQL Editor, then retry.'
  );
}

export type ClassifiedPostgrestError =
  | { kind: 'rls_denied' }
  | { kind: 'schema_stale' }
  | { kind: 'table_missing' }
  | { kind: 'unavailable' }
  | { kind: 'unknown' };

export function classifyPostgrestError(err: PostgrestErrorLike | null | undefined): ClassifiedPostgrestError {
  if (!err?.message && !err?.code) return { kind: 'unknown' };
  if (isRlsOrPermissionDeniedError(err)) return { kind: 'rls_denied' };
  if (isPostgrestSchemaStaleError(err)) return { kind: 'schema_stale' };
  if (isPostgresUndefinedTableError(err)) return { kind: 'table_missing' };
  if (isPostgrestTableUnavailableError(err)) return { kind: 'unavailable' };
  return { kind: 'unknown' };
}
