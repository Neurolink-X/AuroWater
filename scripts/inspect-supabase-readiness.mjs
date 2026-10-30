#!/usr/bin/env node
/**
 * Read-only Supabase production/staging readiness inspection.
 * This script never applies migrations or changes data/schema.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://..." npm run db:inspect-live
 * Prefer a read-only database role. Output excludes connection details and row data.
 */
import pg from 'pg';

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set SUPABASE_DB_URL (preferred) or DATABASE_URL. Never paste database credentials into chat.');
  process.exit(2);
}

const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 10_000,
  query_timeout: 15_000,
  statement_timeout: 12_000,
  application_name: 'aurotap-readonly-readiness-audit',
});

const expectedTables = [
  'city_waitlist',
  'orders',
  'supplier_stock',
  'order_dispatch',
  'technician_job_dispatch',
  'profiles',
  'supplier_settings',
];

try {
  await client.connect();
  await client.query('BEGIN READ ONLY');

  const identity = await client.query(`
    SELECT current_database() AS database_name,
           current_user AS database_role,
           current_setting('server_version') AS postgres_version
  `);

  const tables = await client.query(`
    SELECT n.nspname AS schema_name, c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p')
      AND c.relname = ANY($1::text[])
    ORDER BY c.relname
  `, [expectedTables]);

  const columns = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [expectedTables]);

  const policies = await client.query(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY($1::text[])
    ORDER BY tablename, policyname
  `, [expectedTables]);

  const indexes = await client.query(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = ANY($1::text[])
    ORDER BY tablename, indexname
  `, [expectedTables]);

  const migrationTables = await client.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog','information_schema')
      AND (table_schema ILIKE '%migration%' OR table_name ILIKE '%migration%')
    ORDER BY table_schema, table_name
  `);

  const rpcFunctions = await client.query(`
    SELECT p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY($1::text[])
    ORDER BY p.proname, arguments
  `, [
    'try_assign_supplier_with_stock',
    'try_assign_technician',
    'accept_technician_job',
    'release_technician_assignment',
  ]);

  await client.query('COMMIT');
  console.log(JSON.stringify({
    audit: 'read-only',
    inspected_at: new Date().toISOString(),
    database: identity.rows[0],
    expected_tables: expectedTables,
    tables: tables.rows,
    columns: columns.rows,
    rls_policies: policies.rows,
    indexes: indexes.rows,
    migration_tracking_candidates: migrationTables.rows,
    dispatch_rpc_privileges: rpcFunctions.rows,
    notes: [
      'No application migration ledger is assumed; inspect the returned candidates.',
      'RLS enabled does not by itself prove policies are correct; review each policy and grants.',
      'A missing RPC or table must be reconciled with the deployed migration history before applying SQL.',
    ],
  }, null, 2));
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('Read-only database inspection failed:', error instanceof Error ? error.message : 'Unknown database error');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
