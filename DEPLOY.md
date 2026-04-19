# AuroWater — Deployment Guide

## Vercel (recommended)

### 1. Connect repo

In the Vercel dashboard: New Project → import from GitHub.

### 2. Environment variables

Set in the Vercel project (Production + Preview as needed):

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; never expose to the client |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL, e.g. `https://aurowater.in` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | 10-digit business number |
| `RESEND_API_KEY` | If using Resend for email |
| `CONTACT_FORM_EMAIL` | Inbound support address |
| `JWT_SECRET` | Legacy JWT paths |
| `DATABASE_URL` | Legacy Postgres (if still used) |

See `.env.example` for any additional keys used locally.

### 3. Build settings

- **Build command:** `npm run build`
- **Output:** Next.js default (`.next`)
- **Node:** 20.x LTS

### 4. Supabase

1. Run SQL in order: `sql/001_core_schema.sql` → `sql/004_functions.sql`, then `sql/005_notifications_dedup.sql` for notification deduplication.
2. Enable **Realtime** on `orders` and `notifications` if dashboards rely on live updates.
3. In Supabase Auth → URL configuration, add your Vercel preview and production domains.

### 5. Custom domain

Add the domain under Vercel → Domains and point DNS (A/CNAME) as instructed.

### 6. Post-deploy checklist

- [ ] `GET /api/settings` returns 200 with JSON
- [ ] `/auth/login` works and sets session cookies / tokens as designed
- [ ] `/book` completes a test order and row appears in Supabase `orders`
- [ ] `/customer/home` lists orders for a test customer
- [ ] `/admin/dashboard` loads KPIs for an admin user
- [ ] Order status change emits Realtime updates where enabled
- [ ] WhatsApp FAB reads phone / enable flag from settings
- [ ] `/sitemap.xml` and `/robots.txt` respond 200
- [ ] `/og-image.png` returns 200 (Open Graph)

### 7. Caching

API routes that mutate data use `Cache-Control: private, no-store` where implemented. Public `GET /api/settings` may be cached in the app via `useSettings` localStorage; admins clearing keys after save is documented on the Admin Settings page.
