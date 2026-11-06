# AuroTap database schema recovery — controlled, no unattended production DDL

## Why this is safer than automatically creating missing tables
The live schema contains foreign keys, RLS policies, triggers, functions, payment/wallet constraints and migration history. Creating a missing table independently (or replaying the legacy bootstrap SQL) can break access control or corrupt compatibility. The readiness command always runs a read-only transaction and **never** creates, alters or drops production objects.

## Live baseline observed on 6 November 2026
The authenticated Supabase read-only catalog check found **16/16** expected application tables present (5 essential + 11 additional) and the official `supabase_migrations.schema_migrations` tracker present. No schema recovery was necessary at that time. The current database must be checked again for any subsequent incident.

## Safe response when a table is missing
1. Run `npm run db:setup` using a **read-only database credential**. Optionally set `DB_READINESS_REPORT_PATH=artifacts/db-readiness/latest.json` to generate a JSON summary with missing *table names only*. Never commit credentials, connection strings or the report.
2. Run `npm run db:audit-migrations` and `npm run db:inspect-live` (read-only). Inspect the Supabase migration-history table through an authorized administrator. **Do not infer applied versions from filenames**, because this repository contains a legacy numbered `sql/` stream and a separate timestamped `supabase/migrations/` stream.
3. Determine *why* the table is missing: incomplete migration, drift, incorrect project/environment, permissions or an incident. Review dependent functions, triggers, RLS policies, grants, constraints and backfill requirements. Missing relations cannot be repaired safely by a generic `CREATE TABLE IF NOT EXISTS` because that cannot verify existing schemas.
4. Recover from a **versioned, reviewed migration** specific to the identified gap. Verify expected migrations against the remote history, and obtain a second approval. Ensure a recent restorable backup and a tested rollback/roll-forward plan.
5. Apply first to an isolated staging database, validate schema diffs, RLS and privilege advisors, check order/payments/dispatch regression tests, then use an approved migration deployment window for production. Do not run `supabase db reset`, the historical all-in-one SQL bundle or a legacy bootstrap script against production.
6. Repeat `npm run db:setup`; confirm all essential tables exist and the relevant application flows function correctly. Capture the migration ID and change approval in the incident record.

## Important guardrails
- **No self-healing production schema changes.** The recovery process is intentionally operator-approved. Production writes should use official migration tooling with synchronized history, not an untracked one-off SQL command.
- `DB_READINESS_REPORT_PATH` accepts only `artifacts/db-readiness/[A-Za-z0-9_-]+.json`. The folder is ignored by Git; reports contain no customer records or secrets.
- The presence of a table alone does **not** establish the correctness of its columns, RLS, permissions, triggers or indexes. Inspect these on staging before deployment.
- If migrations fail, keep booking/finance paths in safe incident mode rather than creating replacement tables automatically.

Supabase documentation: https://supabase.com/docs/guides/deployment/database-migrations
