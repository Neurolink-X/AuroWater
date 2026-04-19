# AuroWater — agent context

## Supabase & env

- Public URL + anon/publishable key: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (alias for anon in v2 dashboards), `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server only: `SUPABASE_SERVICE_ROLE_KEY` (never expose to the client).
- Apply SQL: `sql/ALL_MIGRATIONS_ORDERED.sql` via Supabase SQL Editor; refresh PostgREST after DDL: `SELECT pg_notify('pgrst', 'reload schema');`
- Operational doc: `SUPABASE_SETUP.md`.

## API client

- App API base: `NEXT_PUBLIC_API_URL` (defaults to same-origin `/api`).
- Bearer JWT in `Authorization` for authenticated routes; `credentials: 'include'` for cookie gates.

## Roles

- Profiles use `profiles.role`: `customer` | `technician` | `supplier` | `admin`.
- Middleware uses `aw_session` / `aw_role` cookies set after login.
