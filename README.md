# AuroWater (aurotap.in)

On-demand water can delivery and plumber booking for Uttar Pradesh. Live cities today: **Gorakhpur, Kanpur, Lucknow**. Other cities collect demand via waitlist.

Stack: **Next.js 16** (App Router) · React 19 · TypeScript · Supabase · Tailwind.

## Quick start

```bash
cp .env.example .env.local
npm install
npm run dev                  # http://localhost:3000
```

APIs are same-origin `/api`. Do not set `NEXT_PUBLIC_API_URL` in production.

## Environment

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser / RLS key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Never expose to the client. Alias: `SUPABASE_SERVICE_KEY` |
| `NEXT_PUBLIC_APP_URL` | `https://aurotap.in` or `http://localhost:3000` |
| `ADMIN_INVITE_CODE` | Required for admin registration |

`npm run verify:env` exits 0 only when URL, anon, and service role are set.

### Service role 503

Copy **service_role** from Supabase → Settings → API (not the anon key). Restart `npm run dev` after changing `.env.local`.

### Auth dashboard

Disable **Confirm email** so phone/email + password accounts can sign in immediately. Sellers and agents still wait for **admin approval** (`pending_approval` on `profiles`).

Redirect URLs (if you ever re-enable email links): `http://localhost:3000/auth/callback`, `https://aurotap.in/auth/callback`.

## Database (SQL Editor only)

Run in order. Do not use `supabase db push`.

1. `sql/001_core_schema.sql`
2. `sql/002_rls_policies.sql`
3. `sql/003_seed_settings.sql`
4. `sql/004_functions.sql`
5. `sql/005_notifications_dedup.sql`
6. `sql/006_schema_compat.sql` and `sql/006_production_readiness.sql`
7. `sql/007_geo_payments_waitlist.sql`
8. `sql/008_auth_approval.sql`
9. `sql/009_cities_waitlist.sql` — `cities` catalogue + `city_waitlist`

Or paste the concatenated file: `sql/ALL_MIGRATIONS_ORDERED.sql` (rebuild with `node scripts/build-supabase-migrations.mjs`).

After DDL: `SELECT pg_notify('pgrst', 'reload schema');`

Realtime (optional): `orders`, `notifications`.

`GET /api/settings` should return `{ success: true, data: { ... } }` within ~5s (never hangs; falls back to defaults).

## Auth and roles

UI labels: **seller** = DB `supplier`, **agent** = DB `technician`.

| Role | Home | Notes |
|------|------|--------|
| customer | `/customer/home` | Register at `/register` if city is **active** |
| supplier | `/supplier/dashboard` | Also `/seller/dashboard`. Needs admin approve |
| technician | `/technician/dashboard` | Also `/agent/dashboard`. Needs admin approve |
| admin | `/admin/dashboard` | Approvals + waitlist demand |

Login: **`/login`** (phone or email + password). Pending sellers/agents go to `/register/pending`.

Phone auth emails are `{10digits}@users.aurotap.in`.

Cookies `aw_session` / `aw_role` are set after login for `src/proxy.ts` (Next 16 edge gate). APIs use Bearer JWT via `requireSupabaseAuth()`.

## Cities and waitlist

- `GET /api/cities` — public list (5s timeout, 5 min cache, hardcoded fallback if DB is down).
- `POST /api/waitlist` — public join (phone or email).
- `GET /api/waitlist` — **admin only**. Demand dashboard: `/admin/dashboard/waitlist`.

Register blocks account create when the city is not `active`. Users join waitlist instead.

Payments: QR + cash only (no card gateway).

## Scripts

```bash
npm run dev
npm run build
npm run verify:env
npx tsc --noEmit
node scripts/build-supabase-migrations.mjs
node scripts/generate-pwa-icons.mjs
```

PWA icons live in `public/icons/`; manifest at `public/manifest.json`.

## Project structure

| Path | Purpose |
|------|---------|
| `src/proxy.ts` | Edge routing (cookies only) |
| `src/app/api/*` | Same-origin API |
| `src/lib/cities.ts` | City types + fallback list |
| `src/lib/storage.ts` | SSR-safe `localStorage` / `sessionStorage` |
| `src/lib/auth/ensure-profile.ts` | Profile upsert after register |
| `src/components/ui/CitySelector.tsx` | Searchable city picker |
| `src/components/ui/WaitlistPanel.tsx` | Demand capture form |

## Deprecated

`/api/customers/*` and `/api/orders/*` → **410**. Use `/api/customer/*`.
`NEXT_PUBLIC_API_URL` is unused; keep traffic on `/api`.
