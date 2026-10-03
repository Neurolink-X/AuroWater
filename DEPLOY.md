# AuroWater deployment, Supabase, and migration runbook

This is the single operational guide for local development, Supabase migrations, Vercel deployment, and verification. Do not commit `.env.local` or service-role credentials.

## 1. Configure a project

Use the intended AuroWater Supabase project: `mwfcwhxdlnqldciigicl`.

1. Copy `.env.example` to `.env.local` (or create `.env.local` with the variables below).
2. In Supabase **Settings → API**, copy the project URL, the anon/publishable key, and the service-role secret.
3. Run `npm run verify:env`. It verifies presence only and never prints secrets.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mwfcwhxdlnqldciigicl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never put it in a `NEXT_PUBLIC_*` variable, browser code, source control, or a client-side test.

## 2. Apply migrations

1. Run `npm run db:bundle-sql` to regenerate `sql/ALL_MIGRATIONS_ORDERED.sql` when migration sources change.
2. In Supabase SQL Editor, run `sql/ALL_MIGRATIONS_ORDERED.sql` as one transaction-aware bundle.
3. Reload PostgREST after DDL:

   ```sql
   SELECT pg_notify('pgrst', 'reload schema');
   ```

4. Confirm the core tables exist and enable Realtime on `orders` and `notifications` when dashboard live updates are required.

If an API returns `PGRST205` or `DB_NOT_READY`, rerun the bundle and reload PostgREST before changing application code.

## 3. Deploy to Vercel

Set the same variables for the applicable Preview and Production environments, then redeploy. Use Node 20.x LTS, `npm run build`, and Next.js default output (`.next`). Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS domain in production. Add that domain plus preview URLs in **Supabase Auth → URL Configuration**.

Additional optional server configuration: `JWT_SECRET`, `ADMIN_INVITE_CODE`, `ADMIN_EMAIL`, `ADMIN_PHONE`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`, and `DATABASE_URL`. `NEXT_PUBLIC_API_URL` is deprecated; browser requests must stay same-origin under `/api`.

## 4. Production checklist

- [ ] `npm run lint`, `npm run test:regression`, and `npm run build` pass.
- [ ] `GET /api/settings`, `/sitemap.xml`, `/robots.txt`, and `/og-image.png` return successful responses.
- [ ] `/auth/login` works and redirects each role to its own dashboard.
- [ ] A customer can save an address, select it, schedule a service, and see the order under `/customer/home`.
- [ ] Supplier, technician, and admin routes reject unauthenticated and incorrect-role users.
- [ ] No service-role key is present in client bundles or committed files.

## 5. Safe authenticated smoke test

Create a dedicated **development-project** customer account with no production data. Start the app, then run:

```bash
BASE_URL=http://localhost:3000 \
SMOKE_TEST_EMAIL=dev-smoke@example.test \
SMOKE_TEST_PASSWORD='<password>' \
SMOKE_EXPECTED_ROLE=customer \
npm run smoke:auth
```

The test logs in, reads the profile and addresses, and sends an intentionally invalid order payload. It must receive `400`, so it verifies authentication and customer authorization without creating an order or modifying data. Do not point it at production.
