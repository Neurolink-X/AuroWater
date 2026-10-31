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

  const tableGrants = await client.query(`
    SELECT table_name, grantee, privilege_type, is_grantable
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
      AND grantee IN ('PUBLIC','anon','authenticated','service_role')
    ORDER BY table_name, grantee, privilege_type
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

  const pgStatExtension = await client.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS enabled");
  let slowQueries = [];
  if (pgStatExtension.rows[0]?.enabled) {
    try {
      const slow = await client.query(`
        SELECT queryid, calls, round(mean_exec_time::numeric, 2) AS mean_ms,
               round(max_exec_time::numeric, 2) AS max_ms,
               round(total_exec_time::numeric, 2) AS total_ms,
               rows, shared_blks_hit, shared_blks_read,
               left(query, 500) AS normalized_query
        FROM pg_stat_statements
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        ORDER BY mean_exec_time DESC
        LIMIT 20
      `);
      slowQueries = slow.rows;
    } catch (error) {
      slowQueries = [{ unavailable: error instanceof Error ? error.message : 'insufficient privileges' }];
    }
  }

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
   `, [[
    'try_assign_supplier_with_stock',
    'try_assign_technician',
    'accept_technician_job',
    'release_technician_assignment',
  ]]);

  // Keep security visibility independent of Supabase Dashboard access.
  // This is read-only: no impersonation, row data, or authorization mutations.
  const criticalRpcNames = [
    'try_assign_supplier_with_stock', 'try_assign_technician',
    'accept_technician_job', 'adjust_supplier_stock', 'set_supplier_stock',
    'get_customer_stats', 'create_service_otp', 'verify_service_otp',
    'start_technician_job', 'release_technician_assignment',
  ];
  const privilegedRpcs = await client.query(`
    SELECT p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous_allowed,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_allowed,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_allowed,
           p.prosecdef AS security_definer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])
    ORDER BY p.proname
  `, [criticalRpcNames]);
  const viewSecurity = await client.query(`
    SELECT c.relname AS view_name,
           COALESCE(c.reloptions @> ARRAY['security_invoker=true'], false) AS security_invoker,
           COALESCE(c.reloptions @> ARRAY['security_barrier=true'], false) AS security_barrier
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
      AND c.relname IN ('supplier_orders_masked','technician_orders_masked')
    ORDER BY c.relname
  `);
  const failures = [
    ...criticalRpcNames.filter((name) =>
      !privilegedRpcs.rows.some((row) => row.function_name === name)
    ).map((name) => `missing privileged RPC: ${name}`),
    ...privilegedRpcs.rows.filter((row) => row.anonymous_allowed)
      .map((row) => `anonymous EXECUTE: ${row.function_name}`),
    ...['try_assign_supplier_with_stock','try_assign_technician']
      .filter((name) => privilegedRpcs.rows.some((row) =>
        row.function_name === name && row.authenticated_allowed
      )).map((name) => `signed-in user can assign arbitrary order: ${name}`),
    ...['supplier_orders_masked','technician_orders_masked']
      .filter((name) => !viewSecurity.rows.some((row) =>
        row.view_name === name && row.security_invoker && row.security_barrier
      )).map((name) => `masked view missing security_invoker/barrier: ${name}`),
  ];

  // Aggregate-only financial integrity diagnostics. Historical completed
  // orders may predate the ledger; do not invent missing earnings or rewrite
  // a paid payout without an audited reconciliation.
  const financeIntegrity = await client.query(`
    SELECT count(*) FILTER (WHERE o.status='COMPLETED' AND lower(o.payment_status)='paid') AS completed_paid,
           count(*) FILTER (WHERE o.status='COMPLETED'
             AND lower(o.payment_status)='paid'
             AND o.supplier_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.wallet_ledger l
               WHERE l.order_id=o.id AND l.entry_type='ORDER_EARNING')) AS paid_missing_earning,
           count(*) FILTER (WHERE o.status='COMPLETED'
             AND lower(o.payment_status)='paid'
             AND o.supplier_id IS NOT NULL
             AND o.payout_status='paid'
             AND NOT EXISTS (SELECT 1 FROM public.wallet_ledger l
               WHERE l.order_id=o.id AND l.entry_type='ORDER_EARNING')) AS payout_paid_without_earning,
           count(*) FILTER (WHERE o.status<>'COMPLETED'
             AND EXISTS (SELECT 1 FROM public.wallet_ledger l
               WHERE l.order_id=o.id AND l.entry_type='ORDER_EARNING')) AS noncompleted_with_earning
    FROM public.orders o
  `);
  const stockIntegrity = await client.query(`
    SELECT count(*) FILTER (WHERE cans_available<0) AS negative_stock,
           count(*) FILTER (WHERE reserved_cans<0) AS negative_reserved,
           count(*) FILTER (WHERE reserved_cans>cans_available) AS reservations_exceed_stock
    FROM public.supplier_stock
  `);

  await client.query('COMMIT');
  console.log(JSON.stringify({
    audit: 'read-only',
    inspected_at: new Date().toISOString(),
    database: identity.rows[0],
    expected_tables: expectedTables,
    tables: tables.rows,
    columns: columns.rows,
    rls_policies: policies.rows,
    table_grants: tableGrants.rows,
    indexes: indexes.rows,
    migration_tracking_candidates: migrationTables.rows,
    dispatch_rpc_privileges: rpcFunctions.rows,
    finance_integrity: financeIntegrity.rows[0],
    stock_integrity: stockIntegrity.rows[0],
    hardened_security: {
      status: failures.length ? 'FAIL' : 'PASS',
      findings: failures,
      privileged_rpcs: privilegedRpcs.rows,
      masked_views: viewSecurity.rows,
    },
    pg_stat_statements_enabled: pgStatExtension.rows[0]?.enabled ?? false,
    slow_query_samples: slowQueries,
    notes: [
      'Finance/stock metrics are aggregates only. Historical gaps require manual reconciliation, never silent backfills.',
      'Security PASS checks metadata permissions, not application end-to-end authorization. Test customer contact after acceptance separately.',
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
