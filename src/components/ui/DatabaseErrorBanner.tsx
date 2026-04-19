'use client';

/**
 * Friendly banner when APIs return DB_NOT_READY / PGRST205-style failures.
 */

export function DatabaseErrorBanner({
  message,
}: {
  message: string;
}) {
  const isSetup =
    /\b(PGRST205|DB_NOT_READY|schema cache|Database not ready|ALL_MIGRATIONS_ORDERED|MISCONFIG_ENV|SERVICE_ROLE_MISSING)\b/i.test(
      message
    );

  return (
    <div
      role="alert"
      className={
        isSetup
          ? 'rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950'
          : 'rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900'
      }
    >
      <div className="text-sm font-extrabold mb-1">
        {isSetup ? 'Database setup required' : 'Unable to load data'}
      </div>
      <p className="text-sm leading-relaxed opacity-95">{message}</p>
      {isSetup ? (
        <p className="mt-2 text-xs font-semibold text-amber-900/90">
          Run <code className="rounded bg-white/80 px-1.5 py-0.5">sql/ALL_MIGRATIONS_ORDERED.sql</code> in the
          Supabase SQL Editor, then execute{' '}
          <code className="rounded bg-white/80 px-1.5 py-0.5">
            SELECT pg_notify(&apos;pgrst&apos;, &apos;reload schema&apos;);
          </code>
        </p>
      ) : null}
    </div>
  );
}
