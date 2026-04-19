# Supabase setup (required for auth, orders, and dashboards)

## One-time database setup

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL** → **New query**.
2. From this repo, open **`sql/ALL_MIGRATIONS_ORDERED.sql`** (or run **`npm run db:bundle-sql`** to regenerate it).
3. Paste the entire file → **Run**.
4. Confirm the script completes without errors. The bundle ends with a table list query — you should see **8** core public tables (`profiles`, `orders`, …).
5. If you applied files manually, also run **`sql/reload_postgrest_schema.sql`** once after DDL (fixes **PGRST205** stale cache):

   ```sql
   SELECT pg_notify('pgrst', 'reload schema');
   ```

## Required environment variables

Copy **`.env.example`** to **`.env.local`** and set:

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project **Settings → API → Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Settings → API → anon / publishable** |
| `SUPABASE_SERVICE_ROLE_KEY` | **Settings → API → service_role** (server only — never expose to the browser) |

## Verify

- **GET** `/api/settings` → `{ "success": true, "data": { ... } }`
- **POST** `/api/auth/login` → `200` after user exists and migrations are applied.

If the API returns **503** with code **`DB_NOT_READY`**, run migrations again and reload PostgREST:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

## PostgREST **PGRST205** (schema cache)

The table may exist in Postgres but PostgREST has not refreshed its cache. Run the `NOTIFY` above in the SQL Editor, then retry the app.
