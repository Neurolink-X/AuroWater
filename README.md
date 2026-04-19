# AuroWater

Next.js app for booking water and related home services. Metadata and marketing copy reference **India / UP**; all geography is product copy unless you configure regions in data.

---

## Roles & entry URLs

| Role | Primary UI | Access check |
|------|------------|----------------|
| **Customer** | `/customer/home`, `/customer/history`, `/customer/addresses`, `/customer/track/[id]` | Middleware: `aw_session` + `aw_role` cookie; APIs use Supabase **Bearer** JWT (`requireRole('customer')`). |
| **Admin** | `/admin/dashboard`, `/admin/orders`, `/admin/users`, `/admin/finance`, `/admin/settings` | Same cookies + `AdminShell` calls `verifyToken()` and requires `ADMIN`. |
| **Supplier** | `/supplier/dashboard` | Cookie + supplier APIs. |
| **Technician** | `/technician/dashboard` | Cookie + technician APIs. |

- **`/dashboard`** → redirects to **`/customer/home`** (legacy URL).
- **`/dashboard/orders/[id]`** → redirects to **`/customer/track/[id]`**.

---

## Customer flow (code path)

1. **Auth:** `POST /api/auth/login` (Supabase password). Client stores access token and syncs **`aw_session` / `aw_role`** cookies (see `useAuth`). Middleware blocks `/customer/*` without those cookies → redirect to **`/auth/login?returnTo=…`**. Note: middleware allows **multiple** roles into `/customer/*` (e.g. admin); **`/api/customer/*`** still requires a **customer** profile on each request.
2. **Book:** `/book` → `BookingWizard` → **`POST /api/customer/orders`** with server-side total validation (`order-pricing-server`). Requires an authenticated **customer** profile.
3. **Home:** `api.customer.orders.list`, `api.customer.stats`, `api.customer.notifications.list` (`src/app/customer/home/page.tsx`).
4. **Track:** `customerOrderGet` + **Supabase Realtime** subscription on the order row (`src/app/customer/track/[id]/page.tsx`). Cancel → **`PUT /api/customer/orders/[id]/cancel`**.
5. **History / addresses:** `api.customer.orders.list` and `api.customer.addresses` CRUD (`history`, `addresses` pages).
6. **Reviews:** **`POST /api/customer/reviews`** — after **COMPLETED**, **`/customer/track/[id]`** opens **`ReviewModal`** (stars + optional comment) unless `localStorage` already has `reviewed_<orderId>`.

**Public (no login):** marketing pages, **`GET /api/settings`**, **`GET /api/services`**, `/book` UI (submit still needs customer auth). **`WhatsAppFAB`** (in `RootChrome`) reads **`whatsapp_enabled`** and the WhatsApp number from **`useSettings()`** / public settings.

---

## Admin flow (code path)

1. **Sign-in:** **`/auth/login`** for all roles. Admin access is determined by the Supabase profile **`role`** (`admin` in DB → **`ADMIN`** in `verifyToken()` / `User`). **`/admin`** redirects to **`/admin/dashboard`**. Safe internal **`?returnTo=`** under **`/admin`** is applied after login (`auth/login/page.tsx`).
2. **Session gate:** `AdminShell` verifies Bearer token + admin role; failures → **`/auth/login`** with `returnTo`. **`middleware.ts`** requires **`aw_session` + `aw_role`** for **`/admin/*`**. Routes **`/admin/login`** and **`/admin/register`** exist only as **stubs that redirect to `/`** — use **`/auth/login`**, not those URLs.
3. **Dashboard:** **`/api/admin/dashboard`** (`admin/dashboard/page.tsx`).
4. **Orders:** **`/api/admin/orders`** + **`GET/PUT /api/admin/orders/[id]`** (drawer, status, cancel + note). Assign tech → **`PUT /api/admin/technicians/[id]/assign`**; technician pick list → **`GET /api/admin/technicians`**. CSV export paginates the list API.
5. **Users:** **`/api/admin/users`**
6. **Finance:** **`GET /api/admin/finance?range=…`** — **completed** orders only; gross / collected / pending totals.
7. **Settings:** **`GET/PUT /api/admin/settings`**. Successful save clears **`aw_settings_v3`** cache keys (see `admin/settings/page.tsx`).

---

## Supplier & technician (code path)

- **Supplier dashboard:** `supplierOrdersList`, `supplierEarningsSummary`, payout helpers from `@/lib/api-client` (API-driven).
- **Technician dashboard:** `technicianJobsList`, accept / status update APIs (API-driven).

---

## Notifications

- Server inserts: **`src/lib/notifications.ts`** (service role), used from customer order create/cancel, supplier/technician status routes, admin assign.
- Inserts may include **`dedup_key`**. Apply **`sql/005_notifications_dedup.sql`** so the column and unique index exist; otherwise those inserts can fail at runtime.

---

## Stack

Next.js **16** (App Router) · React **19** · TypeScript · Supabase JS · Tailwind **4** · Framer Motion · Recharts · Sonner · Zod · React Hook Form · Deprecated **`/api/customers/*`** and **`/api/orders/*`** return **410 Gone** (use **`/api/customer/*`**).

---

## Database

Apply migrations **in the Supabase Dashboard → SQL Editor** (run each file in order, confirm no errors before the next). Do **not** rely on `supabase db push` / CLI migrations unless you maintain `supabase_migrations` — this repo expects direct SQL execution.

1. `sql/001_core_schema.sql`
2. `sql/002_rls_policies.sql`
3. `sql/003_seed_settings.sql`
4. `sql/004_functions.sql` — auth → `profiles` trigger
5. `sql/005_notifications_dedup.sql` — **needed** for notification inserts that send `dedup_key`.

Then: **Authentication → Settings** — for phone/password UX, turn **email confirmations OFF** (avoids expired confirmation links in dev). Paste **`SUPABASE_SERVICE_ROLE_KEY`** from **Project Settings → API** into `.env.local` and restart the dev server.

Enable Supabase **Realtime** (Database → Replication) on **`orders`** and **`notifications`** for live track / dashboards.

Optional: `sql/admin_seed.sql` after creating the admin user in Auth — promotes that user’s `profiles.role` to `admin`.

---

## Environment

Minimum for Supabase flows: **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**, **`SUPABASE_SERVICE_ROLE_KEY`**.

Also used: **`NEXT_PUBLIC_APP_URL`** (Open Graph `metadataBase` in `src/app/layout.tsx`), **`NEXT_PUBLIC_API_URL`** (API client base; same-origin default), **`JWT_SECRET`** / **`DATABASE_URL`** for legacy routes and scripts.

See **`.env.example`**.

---

## Run & smoke

```bash
npm install
npm run dev
```

```bash
BASE_URL=http://localhost:3000 npm run smoke
```

(On Windows PowerShell: `$env:BASE_URL="http://localhost:3000"; npm run smoke`.)

---

## Deploy & legacy API

- **Deploy:** **[DEPLOY.md](./DEPLOY.md)**  
- **Deprecated:** **`/api/customers/*`**, **`/api/orders/*`** — marked in source; use **`/api/customer/*`** for new work.

---

## Repo map

| Path | Purpose |
|------|---------|
| `src/middleware.ts` | Cookie + role gate for `/admin`, `/customer`, `/supplier`, `/technician`. |
| `src/app/api/auth/*` | Login/register/me/refresh/logout. |
| `src/app/api/customer/*` | Customer orders, addresses, notifications, stats, reviews. |
| `src/app/api/admin/*` | Admin dashboard, orders, users, finance, settings, technicians assign. |
| `src/lib/api-client.ts` | `fetch` helpers, `api.*` facade, `getToken` / admin helpers. |
| `src/lib/notifications.ts` | Order lifecycle notification inserts. |
