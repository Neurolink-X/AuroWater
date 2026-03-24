import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __auro_pool__: Pool | undefined;
}

const pool =
  globalThis.__auro_pool__ ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
  });

if (!globalThis.__auro_pool__) {
  globalThis.__auro_pool__ = pool;
}

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (error) {
    // Keep error logs minimal to avoid noisy consoles on public marketing runs.
    if (process.env.DB_LOGS === '1') {
      console.error('DB Query Error:', error, { text, params });
    }
    throw error;
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function transaction<T>(
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('DB ROLLBACK Error:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export default pool;

