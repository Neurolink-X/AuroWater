# AuroWater (aurotap.in)

On-demand water can delivery and plumber booking for Uttar Pradesh. Live cities: **Gorakhpur, Kanpur, Lucknow**. Other cities join a waitlist so we can expand.

Stack: **Next.js 16** (App Router) · React 19 · TypeScript · Supabase project `mwfcwhxdlnqldciigicl` · Tailwind.

## Quick start

```bash
cp .env.example .env.local   # URL must be https://mwfcwhxdlnqldciigicl.supabase.co
npm install
npm run verify:env
npm run dev                  # http://localhost:3000
```

Browser APIs are same-origin `/api`. Do not use `NEXT_PUBLIC_API_URL` in production.

## Environment

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Must be `https://mwfcwhxdlnqldciigicl.supabase.co` (not any other project ref) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Alias: `SUPABASE_SERVICE_KEY` |
| `NEXT_PUBLIC_APP_URL` | `https://aurotap.in` or `http://localhost:3000` |
| `ADMIN_INVITE_CODE` | Admin registration |

`src/lib/env.ts` remaps the old wrong ref `nozizhfliljitspkgjix` if it still appears in env — still update Vercel keys to the live project.

### Auth dashboard (do this once)

1. Authentication → disable **Confirm email** (register also confirms via service role when the key is set).
2. Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/update-password`, `https://aurotap.in/auth/callback`, `https://aurotap.in/auth/update-password`.
3. For forgot-password emails: Authentication → SMTP (Resend / SendGrid / Supabase default).

## Database (SQL Editor)

Run in order, or paste `sql/ALL_MIGRATIONS_ORDERED.sql`. Rebuild that file with `node scripts/build-supabase-migrations.mjs`.

1. `001`–`006` core + RLS + settings  
2. `007_geo_payments_waitlist.sql`  
3. `008_auth_approval.sql`  
4. `009_cities_waitlist.sql`  
5. **`010_auth_trigger_dedup.sql`** — one `handle_new_user` trigger + public technician directory policy  

Then: `SELECT pg_notify('pgrst', 'reload schema');`

## What is done

- Same-origin `/api`, settings route 5s timeout + defaults (no 502 hang).
- Auth: `/login`, `/register`, `/register/pending`. Phone users: `{10digits}@users.aurotap.in`.
- Login API returns `{ success, data: { access_token, refresh_token, profile } }` and sets `aw_session` / `aw_role`.
- Register uses service-role `createUser` (email confirmed) then password sign-in; profiles row + city/pincode stored.
- Forgot password: `POST /api/auth/forgot-password` → `resetPasswordForEmail` with redirect `/auth/update-password` (PKCE `code` or hash session).
- Booking schedule uses local calendar dates and the next future 30-minute slot. Address step is live cities only (no GPS “use my location”); unserved cities use waitlist.
- PWA: `/manifest.json` and `/manifest.webmanifest` are static JSON (not HTML). Proxy does not gate those paths.
- Cities + waitlist: `/api/cities`, `/api/waitlist`, admin `/admin/dashboard/waitlist`. Out-of-city users are captured here — not as fake accounts.
- Booking wizard writes **`orders`** (water cans and plumber/RO jobs). That is the live booking table.
- Technicians page loads `GET /api/technicians` from `profiles` (`role = technician`). Empty state if none are approved yet.
- Geolocation allowed: `Permissions-Policy: geolocation=(self)` in `next.config.ts` and `src/proxy.ts` (booking no longer depends on GPS).
- Header city picker from `/api/cities`; customer / technician / supplier icons restored on desktop.

## What you still do in dashboards (cannot be done in git)

- Apply SQL **010** (and 009 if not applied) on the live project.
- Confirm Vercel env URL + anon + service role match **mwfcwhxdlnqldciigicl**.
- Enable SMTP if reset emails must arrive in production.
- Approve seller/agent rows in `/admin/dashboard/users` so they can sign in.

## Pending / product follow-ups

- Live click-through of every flow on HTTPS (OTP SMS still needs a Supabase phone provider).
- Optional `plumber_bookings` table is **not** used; bookings persist in `orders`.
- Email confirmation should stay **off** unless you want the resend-confirmation path as the default.

## Auth and roles

UI **seller** = DB `supplier`. UI **agent** = DB `technician`.

| Role | Home |
|------|------|
| customer | `/customer/home` |
| supplier | `/supplier/dashboard` |
| technician | `/technician/dashboard` |
| admin | `/admin/dashboard` |

## Cities and waitlist

Unserved city → waitlist (`city_waitlist`), no account. Demand view: `/admin/dashboard/waitlist`.

Payments: QR + cash only.

## Scripts

```bash
npm run dev
npm run build
npm run verify:env
npx tsc --noEmit
node scripts/build-supabase-migrations.mjs
```

## Deprecated

`/api/customers/*` and `/api/orders/*` → **410**. Use `/api/customer/*`.
`NEXT_PUBLIC_API_URL` unused.
