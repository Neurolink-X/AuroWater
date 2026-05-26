/**
 * src/lib/supabase/postgrest-errors.ts
 *
 * PostgREST / Supabase JS error classification for AuroWater API routes.
 * Server-only — never import in client components.
 *
 * References:
 *   https://postgrest.org/en/stable/references/errors.html
 *   https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PostgrestErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export type ClassifiedPostgrestError =
  | { kind: 'rls_denied';       httpStatus: 403; retryable: false }
  | { kind: 'jwt_expired';      httpStatus: 401; retryable: false }
  | { kind: 'jwt_invalid';      httpStatus: 401; retryable: false }
  | { kind: 'schema_stale';     httpStatus: 503; retryable: true  }
  | { kind: 'table_missing';    httpStatus: 503; retryable: false }
  | { kind: 'unavailable';      httpStatus: 503; retryable: true  }
  | { kind: 'unique_violation'; httpStatus: 409; retryable: false }
  | { kind: 'fk_violation';     httpStatus: 409; retryable: false }
  | { kind: 'check_violation';  httpStatus: 422; retryable: false }
  | { kind: 'not_found';        httpStatus: 404; retryable: false }
  | { kind: 'unknown';          httpStatus: 500; retryable: false };

// ─── SQLSTATE / PGRST code checkers ──────────────────────────────────────────

/** 42501 — PostgreSQL permission denied / RLS policy blocked */
export function isRlsOrPermissionDeniedError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === '42501';
}

/** PGRST301 — JWT has expired */
export function isJwtExpiredError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === 'PGRST301';
}

/** PGRST302 — JWT is invalid / malformed */
export function isJwtInvalidError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === 'PGRST302';
}

/** PGRST205 — relation exists in Postgres but NOT in PostgREST schema cache */
export function isPostgrestSchemaStaleError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === 'PGRST205';
}

/** 42P01 — undefined_table (relation does not exist at all) */
export function isPostgresUndefinedTableError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === '42P01';
}

/** 23505 — unique_violation (duplicate key) */
export function isUniqueViolationError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === '23505';
}

/** 23503 — foreign_key_violation */
export function isForeignKeyViolationError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === '23503';
}

/** 23514 — check_violation (constraint failed) */
export function isCheckViolationError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === '23514';
}

/** PGRST116 — row not found (single() returned 0 rows) */
export function isNotFoundError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  return String(err?.code ?? '') === 'PGRST116';
}

/**
 * Broad check: table/relation not queryable via PostgREST.
 * Covers stale schema cache, missing relation, or similar infra issues.
 */
export function isPostgrestTableUnavailableError(
  err: PostgrestErrorLike | null | undefined
): boolean {
  if (!err?.message && !err?.code) return false;
  const code = String(err.code ?? '');
  if (code === 'PGRST205' || code === '42P01') return true;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

// ─── Classifier ───────────────────────────────────────────────────────────────

/**
 * Classify any PostgREST error into a typed object with HTTP status and
 * retryability. Use this in API routes instead of individual checkers.
 *
 * @example
 * const { kind, httpStatus } = classifyPostgrestError(error);
 * if (kind === 'rls_denied') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 */
export function classifyPostgrestError(
  err: PostgrestErrorLike | null | undefined
): ClassifiedPostgrestError {
  if (!err?.message && !err?.code) {
    return { kind: 'unknown', httpStatus: 500, retryable: false };
  }
  if (isRlsOrPermissionDeniedError(err))     return { kind: 'rls_denied',       httpStatus: 403, retryable: false };
  if (isJwtExpiredError(err))                return { kind: 'jwt_expired',       httpStatus: 401, retryable: false };
  if (isJwtInvalidError(err))                return { kind: 'jwt_invalid',       httpStatus: 401, retryable: false };
  if (isPostgrestSchemaStaleError(err))      return { kind: 'schema_stale',      httpStatus: 503, retryable: true  };
  if (isPostgresUndefinedTableError(err))    return { kind: 'table_missing',     httpStatus: 503, retryable: false };
  if (isUniqueViolationError(err))           return { kind: 'unique_violation',  httpStatus: 409, retryable: false };
  if (isForeignKeyViolationError(err))       return { kind: 'fk_violation',      httpStatus: 409, retryable: false };
  if (isCheckViolationError(err))            return { kind: 'check_violation',   httpStatus: 422, retryable: false };
  if (isNotFoundError(err))                  return { kind: 'not_found',         httpStatus: 404, retryable: false };
  if (isPostgrestTableUnavailableError(err)) return { kind: 'unavailable',       httpStatus: 503, retryable: true  };
  return { kind: 'unknown', httpStatus: 500, retryable: false };
}

// ─── User-facing messages ─────────────────────────────────────────────────────

/**
 * Safe user-facing message for any classified error.
 * Never leaks internal DB details to the client.
 */
export function getUserFacingErrorMessage(
  classified: ClassifiedPostgrestError
): string {
  switch (classified.kind) {
    case 'rls_denied':       return 'You do not have permission to perform this action.';
    case 'jwt_expired':      return 'Your session has expired. Please log in again.';
    case 'jwt_invalid':      return 'Authentication failed. Please log in again.';
    case 'schema_stale':     return 'Service is temporarily unavailable. Please try again in a moment.';
    case 'table_missing':    return 'A required database resource is missing. Please contact support.';
    case 'unavailable':      return 'Database is temporarily unavailable. Please try again shortly.';
    case 'unique_violation': return 'This record already exists. Please check your input.';
    case 'fk_violation':     return 'This action references a resource that does not exist.';
    case 'check_violation':  return 'One or more values are invalid. Please check your input.';
    case 'not_found':        return 'The requested resource was not found.';
    case 'unknown':
    default:                 return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Detailed internal message for server logs.
 * Never send this to the client.
 */
export function getInternalErrorMessage(
  err: PostgrestErrorLike,
  classified: ClassifiedPostgrestError,
  context?: string
): string {
  const prefix = context ? `[AuroWater:${context}]` : '[AuroWater]';
  return (
    `${prefix} PostgREST error — kind: ${classified.kind} | ` +
    `code: ${err.code ?? 'none'} | ` +
    `message: ${err.message ?? 'none'} | ` +
    `details: ${err.details ?? 'none'} | ` +
    `hint: ${err.hint ?? 'none'} | ` +
    `httpStatus: ${classified.httpStatus} | ` +
    `retryable: ${classified.retryable}`
  );
}

// ─── Ops hints ────────────────────────────────────────────────────────────────

/**
 * Ops-facing hint when PostgREST schema cache is stale (PGRST205).
 * Log server-side only — never expose to end users.
 */
export function getSchemaReloadHint(resource = 'the relation'): string {
  return (
    `[AuroWater] PostgREST schema cache is stale for ${resource}.\n` +
    `  Fix: run in Supabase SQL Editor:\n` +
    `    NOTIFY pgrst, 'reload schema';\n` +
    `  If the table is missing entirely, re-run migrations via:\n` +
    `    Supabase MCP → apply_migration (see DEPLOY.md)`
  );
}

/**
 * User-facing 503 message when a table/relation is unavailable via PostgREST.
 * Used by API routes to return a consistent error payload.
 *
 * @param err      — the raw PostgREST error
 * @param resource — e.g. "public.profiles", "public.settings"
 */
export function postgrestTableUnavailableUserMessage(
  err: PostgrestErrorLike,
  resource = 'the database'
): string {
  const code = String(err.code ?? '');
  if (code === 'PGRST205') {
    return (
      `PostgREST cannot see ${resource} yet (PGRST205: schema cache stale). ` +
      `Run in Supabase SQL Editor: NOTIFY pgrst, 'reload schema'; then retry.`
    );
  }
  return (
    `Required data is not available (${resource}, code: ${code || 'unknown'}). ` +
    `Re-run migrations via Supabase MCP → apply_migration, then retry.`
  );
}

/**
 * User-facing message specifically for public.profiles SELECT failures.
 * Used by auth routes (/api/auth/login, /api/auth/me, etc.).
 */
export function profileTableUnavailableMessage(
  err: PostgrestErrorLike
): string {
  if (isPostgrestSchemaStaleError(err)) {
    return postgrestTableUnavailableUserMessage(err, 'public.profiles');
  }
  return (
    'Database not ready: re-run migrations via Supabase MCP → apply_migration, then retry.'
  );
}

// ─── Deprecated aliases (kept for backward compatibility) ────────────────────

/**
 * @deprecated Use isPostgrestTableUnavailableError instead.
 * Kept because auth routes import this name from this module.
 */
export const isProfilesSchemaMissingError = isPostgrestTableUnavailableError;

// ─── One-liner for API route catch blocks ────────────────────────────────────

/**
 * Full pipeline: classify → log internally → return safe user message + status.
 *
 * @example
 * const { message, httpStatus } = handlePostgrestError(error, 'customer/orders');
 * return NextResponse.json({ error: message }, { status: httpStatus });
 */
export function handlePostgrestError(
  err: PostgrestErrorLike,
  context?: string
): { message: string; httpStatus: number; retryable: boolean; kind: string } {
  const classified = classifyPostgrestError(err);
  const internal   = getInternalErrorMessage(err, classified, context);

  console.error(internal);

  if (classified.kind === 'schema_stale' || classified.kind === 'table_missing') {
    console.error(getSchemaReloadHint(context));
  }

  return {
    message:    getUserFacingErrorMessage(classified),
    httpStatus: classified.httpStatus,
    retryable:  classified.retryable,
    kind:       classified.kind,
  };
}
