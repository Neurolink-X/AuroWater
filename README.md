# AuroTap

On-demand water delivery + plumber booking platform for Delhi & UP (India).
Built with Next.js 16, React 19, Supabase, TypeScript, Tailwind 4.

## Quick start

```bash
cp .env.example .env.local   # fill in the 3 required Supabase keys
npm install
npm run dev                  # http://localhost:3000
```

## Required environment variables

| Variable | Where to get it |
|----------|----------------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase Dashboard → Settings → API → Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Settings → API → anon/publishable key |
| SUPABASE_SERVICE_ROLE_KEY | Settings → API → service_role (server-only, never expose) |
| NEXT_PUBLIC_APP_URL | https://aurotap.in (or http://localhost:3000 for dev) |
| NEXT_PUBLIC_API_URL | https://aurotap.in/api (or http://localhost:3000/api) |
| ADMIN_INVITE_CODE | Secret invite code for admin registration |

See `.env.example` for all optional variables.

### Troubleshooting: `SUPABASE_SERVICE_ROLE_KEY` / 503 `SERVICE_ROLE_MISSING`

The service role key is **only** available from Supabase (it cannot be derived from the anon key).

1. Open **Project → Settings → API** and copy the **service_role** secret (not the anon key).
2. Set `SUPABASE_SERVICE_ROLE_KEY=<paste>` in `.env.local` (or `SUPABASE_SERVICE_KEY` as an alias on some hosts).
3. Restart `npm run dev`. For Vercel/production, add the same variable in the hosting dashboard.

Check locally:

```bash
npm run verify:env   # exits 0 only when URL, anon, and service role are non-empty
```

### Email confirmation / “redirects home” / login errors

- **Recommended for dev:** Authentication → **disable “Confirm email”** so users can sign in immediately after register.
- If confirmation is **on** (or OAuth is used): add these under **Authentication → URL configuration** → *Redirect URLs*:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/**`
  - `https://aurotap.in/auth/callback` (production)
  - `https://aurotap.in/**` (production)
- Set **Site URL** to your app origin (`http://localhost:3000` or production). The app forwards `?code=` from the home page to `/auth/callback` automatically (`AuthPkceBridge`).
- If login says the email is not confirmed, use **Resend confirmation email** on the login page (calls `POST /api/auth/resend-confirmation`).

## Database setup (one-time, Supabase SQL Editor only)

Run in order — **do not** use Supabase CLI / `supabase db push`:

1. `sql/001_core_schema.sql`
2. `sql/002_rls_policies.sql`
3. `sql/003_seed_settings.sql`
4. `sql/004_functions.sql` — creates auth trigger for profiles
5. `sql/005_notifications_dedup.sql`

Then in Supabase Dashboard:

- **Authentication → Settings** — disable email confirmations
- **Database → Replication** — enable Realtime on: `orders`, `notifications`, `founding_members`

Verify: `GET /api/settings` → `{ success: true, data: { ... } }`

## User registration — what gets created

| Role | Auth table | profiles | Extra tables |
|------|------------|----------|----------------|
| Customer | `auth.users` row | `profiles` row (role=customer) | — |
| Supplier | `auth.users` row | `profiles` row (role=supplier) | `supplier_settings`, `supplier_stock` |
| Technician | `auth.users` row | `profiles` row (role=technician) | — (applications on apply) |
| Admin | `auth.users` row | `profiles` row (role=admin) | Requires `ADMIN_INVITE_CODE` |

## Roles & URLs

| Role | Home URL | Access |
|------|----------|--------|
| Customer | `/customer/home` | `aw_session=1` + any role |
| Supplier | `/supplier/dashboard` | `aw_session=1` + role=supplier \| admin |
| Technician | `/technician/dashboard` | `aw_session=1` + role=technician \| admin |
| Admin | `/admin/dashboard` | `aw_session=1` + role=admin |

Auth: `/auth/login` (all roles). Email confirm OFF. Password auth only.

## Auth flow

1. `POST /api/auth/register` → Supabase creates `auth.users` row
2. `ensureProfileForUser()` creates `public.profiles` row
3. Client calls `writeSession()` → stores Bearer token + calls `setAuthGateCookies()`
4. `setAuthGateCookies()` sets `aw_session=1` and `aw_role=<role>` (client-side)
5. `src/proxy.ts` (Edge) reads `aw_session` + `aw_role` for routing only
6. API routes use Bearer JWT via `requireSupabaseAuth()` for real auth

## Stack

Next.js 16 · React 19 · TypeScript strict · Supabase JS v2
Tailwind 4 · Framer Motion · Sonner · Zod · React Hook Form · Recharts

## Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run verify:env   # fail fast if Supabase env incomplete
npm run smoke        # API smoke tests (needs dev server running)
npx tsc --noEmit     # type check only
```

## Deprecated

`/api/customers/*` and `/api/orders/*` → return **410 Gone**. Use `/api/customer/*`.

## Project structure

| Path | Purpose |
|------|---------|
| `src/proxy.ts` | Edge routing gate (cookie check only, no JWT) |
| `src/app/api/auth/*` | Login, register, me, refresh, logout |
| `src/app/api/customer/*` | Orders, addresses, notifications, stats, reviews |
| `src/app/api/supplier/*` | Orders, settings, stock, earnings, payouts |
| `src/app/api/technician/*` | Jobs, payouts |
| `src/app/api/admin/*` | Dashboard, orders, users, finance, settings |
| `src/lib/api-client.ts` | Typed fetch helpers + `api.*` facade |
| `src/lib/notifications.ts` | Order lifecycle notification inserts |
| `src/lib/auth/ensure-profile.ts` | Upserts profiles row after auth |
| `src/lib/auth/client-gate-cookies.ts` | Sets `aw_session=1` + `aw_role` |
