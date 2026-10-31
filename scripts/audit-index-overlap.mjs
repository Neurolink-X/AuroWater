#!/usr/bin/env node
/**
 * Read-only Postgres index-size/overlap audit. No DROP INDEX or planner changes.
 * Metadata-only; bounded result set and O(n) bucket grouping by signature.
 */
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Supply a DB connection in SUPABASE_DB_URL. No credentials printed.');
  process.exit(2);
}
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000,
  statement_timeout: 12000, query_timeout: 15000,
  application_name: 'aurotap-index-overlap-readonly' });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const result = await client.query(`
    SELECT t.relname AS table_name, x.relname AS index_name, i.indisunique,
      i.indisprimary, pg_get_indexdef(i.indexrelid) AS definition,
      pg_get_expr(i.indpred, i.indrelid) AS predicate,
      pg_get_expr(i.indexprs, i.indrelid) AS expression,
      i.indkey::text AS key_ids, i.indclass::text AS opclasses,
      i.indcollation::text AS collations, i.indoption::text AS options,
      i.indnkeyatts AS key_columns, i.indnatts AS all_columns,
      am.amname AS access_method, pg_relation_size(x.oid) AS bytes,
      coalesce(stat.idx_scan, 0) AS scans
    FROM pg_index i
    JOIN pg_class x ON x.oid=i.indexrelid
    JOIN pg_class t ON t.oid=i.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_am am ON am.oid=x.relam
    LEFT JOIN pg_stat_user_indexes stat ON stat.indexrelid=x.oid
    WHERE n.nspname='public' AND t.relkind IN ('r','p')
    ORDER BY t.relname, x.relname
    LIMIT 1500
  `);
  await client.query('COMMIT');
  const buckets = new Map();
  for (const idx of result.rows) {
    const signature = JSON.stringify([idx.table_name,idx.access_method,idx.key_ids,idx.opclasses,
      idx.collations,idx.options,idx.predicate,idx.expression,idx.key_columns,idx.all_columns]);
    const group = buckets.get(signature) || [];
    group.push({ name: idx.index_name, bytes: Number(idx.bytes), scans: Number(idx.scans),
      unique: idx.indisunique, primary: idx.indisprimary, sql: idx.definition });
    buckets.set(signature, group);
  }
  const groups = [...buckets.values()].filter(group => group.length > 1);
  console.log(JSON.stringify({
    mode: 'READ_ONLY',
    index_count: result.rowCount,
    possible_overlapping_groups: groups.length,
    groups,
    note: 'Similar definitions are NOT proof that an index is safe to drop. Check FK support, constraints, EXPLAIN, locks and workload before manual removal. This script never mutates the database.',
  }, null, 2));
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Index audit unavailable:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
