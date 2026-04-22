// import { Pool } from 'pg';

// declare global {
//   // eslint-disable-next-line no-var
//   var __auro_pool__: Pool | undefined;
// }

// const pool =
//   globalThis.__auro_pool__ ??
//   new Pool({
//     connectionString: process.env.DATABASE_URL,
//     ssl: { rejectUnauthorized: false },
//     max: 1,
//     allowExitOnIdle: true,
//     idleTimeoutMillis: 10000,
//     connectionTimeoutMillis: 15000,
//   });

// if (!globalThis.__auro_pool__) {
//   globalThis.__auro_pool__ = pool;
// }

// pool.on('error', (err) => {
//   console.error('Unexpected DB error:', err);
// });

// export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
//   try {
//     const result = await pool.query(text, params);
//     return result.rows;
//   } catch (error) {
//     // Keep error logs minimal to avoid noisy consoles on public marketing runs.
//     if (process.env.DB_LOGS === '1') {
//       console.error('DB Query Error:', error, { text, params });
//     }
//     throw error;
//   }
// }

// export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
//   const rows = await query<T>(text, params);
//   return rows[0] || null;
// }

// export async function transaction<T>(
//   fn: (client: import('pg').PoolClient) => Promise<T>
// ): Promise<T> {
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const result = await fn(client);
//     await client.query('COMMIT');
//     return result;
//   } catch (error) {
//     try {
//       await client.query('ROLLBACK');
//     } catch (rollbackError) {
//       console.error('DB ROLLBACK Error:', rollbackError);
//     }
//     throw error;
//   } finally {
//     client.release();
//   }
// }

// export default pool;

/**
 * src/lib/db.ts
 *
 * Legacy `pg` Pool — used only by deprecated /api/customers/* and /api/orders/* routes.
 * All new routes use Supabase JS (src/lib/supabase.ts).
 *
 * The DATABASE_URL points at Supabase's Transaction Pooler (PgBouncer in transaction mode).
 * Implications:
 *   - Prepared statements are disabled by PgBouncer — never use `prepare` mode.
 *   - `max: 1` is intentional for serverless / Edge-adjacent environments.
 *   - `ROLLBACK` in transaction() is best-effort; PgBouncer resets state automatically.
 */



import { Pool, type PoolClient, type QueryResultRow } from 'pg';

/* ── Dev guard ────────────────────────────────────────────────────────── */
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[AuroWater] DATABASE_URL is not set — legacy pg routes will fail. ' +
      'Set it in .env.local (see .env.example).',
  );
}

/* ── Hot-reload singleton (Next.js dev) ───────────────────────────────── */
declare global {
  // eslint-disable-next-line no-var
  var __auro_pg_pool__: Pool | undefined;
}

/* ── Pool factory ─────────────────────────────────────────────────────── */
function createPool(): Pool {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    max: 1,               // serverless / PgBouncer transaction mode
    allowExitOnIdle: true,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000, // kill runaway queries
    query_timeout: 30_000,
  });

  p.on('error', (err) => {
    console.error('[pg] Unexpected pool error:', err.message);
  });

  return p;
}

const pool: Pool = globalThis.__auro_pg_pool__ ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__auro_pg_pool__ = pool;
}

/* ── Internal log helper ──────────────────────────────────────────────── */
const LOG = process.env.DB_LOGS === '1';

function logQuery(ms: number, rowCount: number | null, text: string) {
  if (LOG) console.debug(`[pg] ${ms}ms | rows=${rowCount ?? 0} | ${text.slice(0, 120)}`);
}

function logError(text: string, params: unknown[] | undefined, err: unknown) {
  if (LOG) console.error('[pg] Query error:', { text: text.slice(0, 200), params, err });
}

/* ══════════════════════════════════════════════════════════════════════
   PUBLIC HELPERS
══════════════════════════════════════════════════════════════════════ */

/**
 * Execute a parameterised query and return all rows.
 *
 * THE FIX: `queryOne` previously used an unconstrained `T = Record<string, unknown>`
 * default and passed it to `query<T>`, which requires `T extends Record<string, unknown>`.
 * TypeScript couldn't prove the unconstrained T satisfied that bound.
 *
 * Solution: use the shared `PgRow` alias (= `QueryResultRow` = `Record<string, unknown>`)
 * as the constraint on EVERY generic in this file so they all agree.
 *
 * @example
 * const users = await query<ProfileRow>('SELECT * FROM profiles WHERE role = $1', ['admin']);
 */

// Single source-of-truth constraint — matches pg's QueryResultRow exactly.
type PgRow = QueryResultRow; // Record<string, unknown>

export async function query<T extends PgRow = PgRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    logQuery(Date.now() - start, result.rowCount, text);
    return result.rows;
  } catch (err) {
    logError(text, params, err);
    throw err;
  }
}

/**
 * Return the first row, or `null` when there are no results.
 *
 * FIX: `T` now carries the same `extends PgRow` bound so it can be
 * forwarded to `query<T>` without a type error.
 *
 * @example
 * const profile = await queryOne<ProfileRow>(
 *   'SELECT * FROM profiles WHERE id = $1',
 *   [userId],
 * );
 */
export async function queryOne<T extends PgRow = PgRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Wrap multiple queries in a single BEGIN … COMMIT transaction.
 * Auto-rolls back on any thrown error and always releases the client.
 *
 * @example
 * const result = await transaction(async (client) => {
 *   await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, from]);
 *   await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, to]);
 *   return { ok: true };
 * });
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[pg] ROLLBACK failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Lightweight DB health-check — returns true if the pool can reach Postgres.
 * Use in /api/health or readiness probes.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export { pool };
export default pool;