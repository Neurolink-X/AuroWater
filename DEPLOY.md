# AuroWater — Deployment Guide

## Vercel (recommended)

### 1. Connect repo

In the Vercel dashboard: New Project → import from GitHub.

### 2. Environment variables

Set in the Vercel project (**Production** and **Preview** as needed). Match **`.env.example`** — copy values from your local **`.env.local`** (never commit secrets).

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (same as publishable in current Supabase UI) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional if `ANON_KEY` is set (same value) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — never expose to the client |
| `NEXT_PUBLIC_APP_URL` | Canonical URL, e.g. `https://aurowater.in` |
| `NEXT_PUBLIC_API_URL` | Same-origin API base, e.g. `https://aurowater.in/api` |
| `NEXT_PUBLIC_APP_NAME` | e.g. `AuroWater` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | 10-digit India fallback for WhatsApp links |
| `JWT_SECRET` | If you use legacy JWT helpers |
| `DATABASE_URL` | Optional — direct Postgres for scripts; app uses Supabase API |
| `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_INVITE_CODE` | As needed |
| `SUPPORT_EMAIL`, `SUPPORT_PHONE` | As needed |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | If maps are enabled |

After saving env vars, **Redeploy** so the build picks them up.

### 3. Build settings

- **Build command:** `npm run build`
- **Output:** Next.js default (`.next`)
- **Node:** 20.x LTS

### 4. Supabase

1. Run SQL in order: `sql/001_core_schema.sql` … `sql/005_notifications_dedup.sql` (see **README**).
2. Enable **Realtime** on `orders` and `notifications` if dashboards rely on live updates.
3. In Supabase **Auth → URL configuration**, add your Vercel preview and production domains.

### 5. Custom domain

Add the domain under Vercel → Domains and point DNS (A/CNAME) as instructed.

### 6. Post-deploy checklist

- [ ] `GET /api/settings` returns 200 with JSON
- [ ] `/auth/login` works and sets gate cookies + Bearer token as designed
- [ ] `/book` completes a test order and row appears in Supabase `orders`
- [ ] `/customer/home` lists orders for a test customer
- [ ] `/admin/dashboard` loads for an admin user
- [ ] Order status / Realtime updates where enabled
- [ ] WhatsApp FAB reads phone / enable flag from settings
- [ ] `/sitemap.xml` and `/robots.txt` respond 200
- [ ] `/og-image.png` returns 200 (Open Graph)

### 7. Caching

API routes that mutate data use `Cache-Control: private, no-store` where implemented. Public `GET /api/settings` may be cached in the app via `useSettings` localStorage; admins clearing keys after save is documented on the Admin Settings page.
