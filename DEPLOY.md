# AuroWater Deployment, Supabase, and Migration Runbook

This is the central operational guide for AuroTap (AuroWater), covering local development, Supabase configuration, database migrations, Vercel deployment, security, performance, testing, monitoring, and production recovery.

**Primary goals:**
- Preserve existing working functionality.
- Protect production data and financial transactions.
- Prevent unsafe or duplicate database migrations.
- Maintain secure role-based access.
- Detect deployment failures before production release.
- Support reliable booking, dispatch, subscriptions, and notifications.
- Avoid unnecessary database load and repeated API requests.

**Golden Rule:** Never commit `.env.local`, passwords, database connection strings, access tokens, or service-role credentials.

---

## 1. Configure a Project

Use the intended AuroWater Supabase project:

`mwfcwhxdlnqldciigicl`

### Local environment setup

1. Copy `.env.example` to `.env.local`, or create the file manually.
2. Open Supabase Dashboard → Project Settings → API Keys.
3. Copy the project URL, publishable/anon key, and required server-side secret.
4. Run `npm run verify:env`.
5. Confirm all required environment variables exist before starting development.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mwfcwhxdlnqldciigicl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If the application supports the newer Supabase publishable key, configure `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` according to the existing environment helper. Do not remove the legacy key until compatibility is confirmed.

### Security requirements

- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only.
- Never prefix private secrets with `NEXT_PUBLIC_`.
- Never include secrets in browser bundles or console logs.
- Never commit `.env.local`.
- Never expose database passwords through client-side requests.
- Use separate credentials for development and production where possible.
- Rotate compromised credentials immediately.
- Verify environment variables without printing their values.

**Important:** `npm run verify:env` validates only what the existing script actually checks. It must not be assumed to verify database connectivity or authorization without inspecting its implementation.

---

## 2. Local Development

Use a compatible Node.js runtime and install dependencies from the committed lockfile.

The current project uses Next.js 16, React 19, TypeScript, and Supabase.

### Verify runtime

```bash
node --version
npm --version
```

Use Node.js 22.x for a consistent deployment target, provided the project and dependencies are verified against it.

The current `package.json` declares Node.js `>=22.6.0`, which also allows newer majors. If strict Node 22 consistency is required, explicitly pin `22.x` in the runtime configuration after reviewing deployment compatibility.

### Install dependencies

```bash
npm ci
```

Use `npm install` when intentionally updating dependencies or the lockfile.

### Start development

```bash
npm run dev
```

Open:

`http://localhost:3000`

### Verify environment

```bash
npm run verify:env
```

### Production build verification

```bash
npm run build
```

### Optional clean build

```bash
npm run clean
npm run build
```

Do not repeatedly clear production caches or delete working build artifacts without identifying the actual problem.

---

## 3. Supabase Database and Migration Safety

### Critical migration policy

Never blindly rerun the complete historical migration bundle against an existing production database.

Existing AuroWater databases may already contain:

- Customers and profiles
- Supplier accounts
- Technician and plumber accounts
- Orders and dispatch assignments
- Subscriptions
- Wallet and payout records
- Notifications
- Verification documents
- Row Level Security policies
- Triggers and database functions

These records and database structures must be preserved.

### Step 1 — Audit existing migrations

```bash
npm run db:audit-migrations
npm run db:audit-indexes
```

If the Supabase CLI is configured, verify its current syntax and inspect migration history:

```bash
supabase --version
supabase migration list --help
supabase migration list --remote
```

Check for:

- Duplicate migration identifiers
- Missing migrations
- Applied migrations absent from source control
- Conflicting schema definitions
- Repeated indexes
- Unexpected destructive SQL
- Migration history mismatches

### Step 2 — Generate migration bundle

```bash
npm run db:bundle-sql
```

This project command generates:

`sql/ALL_MIGRATIONS_ORDERED.sql`

**Important:** Generating the bundle does not mean it is safe to execute against production.

Use the bundle only after reviewing its contents and confirming the target database state.

### Step 3 — Apply only verified pending migrations

Preferred workflow:

1. Identify the exact pending migration.
2. Review its SQL.
3. Test it against a development or staging database.
4. Confirm data and schema compatibility.
5. Verify the rollback or forward-recovery plan.
6. Obtain production deployment approval.
7. Apply the approved migration.
8. Confirm successful execution.
9. Record deployment results.

For projects already using properly synchronized Supabase CLI migration history, inspect the migration plan before deployment:

```bash
supabase db push --help
supabase db push --dry-run
```

Run actual migration deployment only after confirming the linked target project and approving the pending changes.

Do not switch an existing custom migration system to CLI migration deployment without reconciling the two histories first.

### Step 4 — Reload PostgREST schema when necessary

After successful DDL changes, if PostgREST has not recognized the updated schema:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

This refreshes PostgREST's schema cache. It does not create missing tables or repair failed migrations.

### Step 5 — Verify database state

Confirm relevant tables, functions, policies and triggers exist and match expected versions.

Important application tables include:

- `profiles`
- `addresses`
- `service_types`
- `orders`
- `settings`
- `supplier_settings`
- `supplier_stock`
- `order_dispatch`
- `wallet_ledger`
- `payouts`
- `notifications`
- `water_subscriptions`
- `referral_credits`

Actual schema names and fields must be verified before writing corrective SQL.

---

## 4. Database Error Recovery

### PGRST205 — Missing relation in schema cache

When an API returns `PGRST205`:

1. Identify the exact missing relation.
2. Verify the table or view actually exists.
3. Check its schema and Data API exposure.
4. Verify grants and RLS policies.
5. Check migration history.
6. Reload PostgREST if the schema exists but its cache is stale.
7. Retest the affected API.

Do not rerun every migration automatically.

### DB_NOT_READY — Database not ready

When `DB_NOT_READY` appears:

1. Inspect server logs.
2. Check required environment variables.
3. Verify Supabase connectivity.
4. Check the referenced tables and functions.
5. Confirm the latest intended migration was applied.
6. Review database connection limits and timeouts.
7. Resolve the actual root cause.
8. Retest the affected functionality.

### HTTP 503 — Service unavailable

Check:

- Supabase connectivity
- Missing server-side secrets
- API route exceptions
- Database connection exhaustion
- Timeout errors
- Database schema or permission failures
- Vercel function logs

Use bounded retries only for transient errors.

Never endlessly retry requests that are failing because of incorrect configuration, permissions or schema.

---

## 5. Database Security and RLS

Every exposed table containing customer, supplier, technician, or financial information must have appropriate Row Level Security policies.

### Required protections

- Customers access only authorized customer records.
- Suppliers access only authorized jobs and data.
- Technicians and plumbers access only their permitted assignments.
- Admin-only operations require verified server-side authorization.
- Financial and payout information is protected.
- Service-role credentials never reach the browser.
- KYC documents use private storage with appropriate access policies.
- Sensitive operations maintain audit records.

### Additional checks

- Never trust client-supplied role information.
- Never use user-editable metadata for authorization.
- Review privileged `SECURITY DEFINER` functions.
- Validate `USING` and `WITH CHECK` policies where applicable.
- Restrict access to sensitive database functions.
- Review storage upload and download permissions.
- Avoid exposing private views through the Data API.

**Rule:** Authentication alone is not authorization. Every sensitive operation must also verify resource ownership or permitted access.

---

## 6. Deploy to Vercel

### Production environment

Set the appropriate environment variables in Vercel:

- Development
- Preview
- Production

Use the correct Supabase project for each environment.

Production configuration:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mwfcwhxdlnqldciigicl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
NEXT_PUBLIC_APP_URL=https://www.aurotap.in
```

Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS domain actually used by the deployed application.

### Build configuration

Use:

```bash
npm run build
```

Expected framework:

`Next.js`

Expected build output:

`.next`

### Node.js version

Configure Node.js 22.x where appropriate and verify the actual Vercel build/runtime version.

Keep `package.json`, the deployment runtime, and CI consistent.

### Supabase Auth URLs

In Supabase Authentication → URL Configuration, configure:

- Canonical production URL
- Approved authentication callback URLs
- Required staging or preview redirect URLs

Avoid unnecessarily broad redirect patterns.

### Optional server configuration

Depending on application usage:

```dotenv
JWT_SECRET=<secret>
ADMIN_INVITE_CODE=<secret>
ADMIN_EMAIL=<configured-email>
ADMIN_PHONE=<configured-phone>
SUPPORT_EMAIL=<configured-email>
SUPPORT_PHONE=<configured-phone>
DATABASE_URL=<private-database-url>
```

Only configure variables required by the application. Do not expose server-only values.

`NEXT_PUBLIC_API_URL` is deprecated for this project. Browser requests should normally use same-origin `/api` endpoints.

---

## 7. Code Quality and CI Verification

Before production deployment, run the available project checks.

### Standard validation

```bash
npm run lint:check
npm run typecheck
npm run test:regression
npm run build
```

### Additional verification

```bash
npm run test:unit
npm run test:platform:contract
npm run db:audit-migrations
npm run db:audit-indexes
```

### Automatic lint fixes

```bash
npm run lint:fix
```

Automatic fixes must be reviewed before committing.

ESLint cannot automatically solve booking, payment, dispatch, or database logic errors.

### CI deployment rules

- Never claim tests passed without executing them.
- Block merging when mandatory CI checks fail.
- Do not automatically rewrite business logic merely to satisfy lint.
- Preserve existing lint suppressions until source issues are fixed.
- Keep strict lint optional until legacy warnings are resolved.
- Review all generated changes before merging.
- Verify the production build before deployment.

### Recommended rollout

Initially keep existing CI gates unchanged.

Introduce new TypeScript and strict checks gradually after the current codebase passes.

---

## 8. Production Verification Checklist

### Platform

- [ ] Production build succeeds.
- [ ] Required environment variables are configured.
- [ ] No secrets appear in client bundles.
- [ ] Supabase connectivity works.
- [ ] Production deployment reports healthy status.
- [ ] Browser console has no unexplained critical errors.

### Public pages and SEO

- [ ] Homepage loads correctly.
- [ ] `/api/settings` responds as expected.
- [ ] `/sitemap.xml` is accessible.
- [ ] `/robots.txt` is accessible.
- [ ] `/og-image.png` works if implemented as a public route.
- [ ] Mobile and desktop layouts render correctly.
- [ ] Fonts, images, buttons, and navigation work.

### Authentication

- [ ] `/auth/login` works.
- [ ] Customer login redirects correctly.
- [ ] Supplier login redirects correctly.
- [ ] Technician/plumber login redirects correctly.
- [ ] Admin login redirects correctly.
- [ ] Unauthorized users cannot access protected routes.
- [ ] Logout and session expiry behave correctly.

### Customer booking

- [ ] Customer can select a service.
- [ ] Selected delivery address is preserved.
- [ ] Pincode and city validation work.
- [ ] Delivery slots are valid.
- [ ] Latest published pricing is used.
- [ ] Server recalculates order totals.
- [ ] Duplicate submissions are prevented.
- [ ] Maintenance mode correctly blocks new orders when enabled.
- [ ] Confirmed order appears in customer history.
- [ ] Customer can track order status.

### Suppliers and technicians

- [ ] Supplier onboarding applications are saved.
- [ ] Admin sees pending applications.
- [ ] Document verification works.
- [ ] Approved professionals can access authorized dashboards.
- [ ] Eligible suppliers receive orders.
- [ ] Supplier coverage and capacity rules work.
- [ ] Technician job acceptance and completion work.
- [ ] Orders are not assigned to ineligible providers.

### Payments and finance

- [ ] Customer amount matches the confirmed order.
- [ ] Existing paid orders retain their agreed amounts.
- [ ] Payment status updates correctly.
- [ ] Wallet ledger does not duplicate earnings.
- [ ] Payout calculations are correct.
- [ ] Refund records are traceable.
- [ ] Financial records remain auditable.

### Notifications and subscriptions

- [ ] Customer notifications work.
- [ ] Supplier notifications work.
- [ ] Technician notifications work.
- [ ] Realtime updates function where enabled.
- [ ] Subscription creation works.
- [ ] Pause and resume work.
- [ ] Recurring orders are not duplicated.
- [ ] Notification retention policies are respected.

---

## 9. Safe Authenticated Smoke Test

Create a dedicated customer account in a development or isolated staging Supabase project.

Never use actual production customer credentials.

Start the local application:

```bash
npm run dev
```

Then run:

```bash
BASE_URL=http://localhost:3000 \
SMOKE_TEST_EMAIL=dev-smoke@example.test \
SMOKE_TEST_PASSWORD='<password>' \
SMOKE_EXPECTED_ROLE=customer \
npm run smoke:auth
```

The intended smoke-test behavior is:

1. Authenticate a test customer.
2. Read the authorized customer profile.
3. Verify address access.
4. Submit an intentionally invalid order payload.
5. Confirm the expected HTTP `400` response.
6. Confirm no order was created.

**Safety:** Inspect the smoke-test implementation before execution. Confirm it has no other write operations or cleanup side effects.

Do not run this test against production.

On Windows, use the equivalent PowerShell environment-variable syntax.

---

## 10. Performance and Reliability Monitoring

Monitor real performance instead of assuming configuration changes automatically improve speed.

### Target service objectives

| Metric | Target |
|---|---|
| Largest Contentful Paint | ≤ 2.5 seconds |
| Interaction to Next Paint | ≤ 200 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| Customer API | ≤ 600 ms |
| Supplier/Technician API | ≤ 800 ms |
| Admin API | ≤ 1 second |

These are engineering targets, not verified current results.

### Monitoring priorities

- Slow database queries
- Repeated API requests
- Database connection exhaustion
- Failed supplier dispatch
- Stuck or unassigned orders
- Duplicate subscription processing
- Realtime connection errors
- Payment reconciliation mismatches
- Unexpected pricing inconsistencies
- Failed background jobs
- High client JavaScript usage
- Slow mobile navigation

### Existing project commands

```bash
npm run quality:slo-report
npm run perf:bundle-report
npm run smoke:health
npm run seo:audit-public
```

Check whether these scripts require network access, production credentials, or a running application before executing them.

### Recovery rules

- Retry only safe transient operations.
- Use exponential backoff where appropriate.
- Prevent duplicate financial transactions.
- Avoid unnecessary database writes.
- Do not restart or redeploy repeatedly without identifying root causes.
- Record important incidents and corrective actions.

---

## 11. Production Rollback and Incident Recovery

### When rollback may be required

- Booking stops working.
- Payments are calculated incorrectly.
- Authentication fails for multiple roles.
- Supplier dispatch becomes unavailable.
- Critical database queries fail.
- A deployment exposes sensitive data.
- Production error rates increase significantly.

### Recommended response

1. Identify the failing release.
2. Inspect Vercel deployment logs.
3. Check Supabase errors and connectivity.
4. Determine whether the failure is application code, environment configuration, or database schema.
5. Stop unsafe operations if necessary.
6. Restore the last known-good application deployment when appropriate.
7. Apply a reviewed forward-fix for database issues when safer than rollback.
8. Verify critical workflows.
9. Record the root cause and prevention actions.

**Important:** Reverting a Vercel deployment does not revert database migrations.

Never assume application rollback will automatically restore the previous database schema or data.

Destructive migration rollback requires a separately reviewed recovery procedure.

---

## 12. Deployment Approval Rules

A production release must not proceed merely because the build succeeds.

Before approval, confirm:

- Required CI checks pass.
- Database migration status is understood.
- Critical security checks pass.
- Preview deployment works.
- Customer booking is verified.
- Supplier and technician workflows are verified.
- Payment-related changes have appropriate tests.
- No unresolved critical regression remains.
- Rollback or recovery procedures are available.

For database, authentication, finance, or destructive schema changes, require explicit production approval.

Do not automatically apply destructive SQL, delete customer records, rewrite payout history, or run historical migration bundles.

---

## 13. Final Operating Principles

1. **Data safety first:** Never sacrifice existing production data for a quick fix.
2. **Security by default:** Protect credentials, customer information, and financial records.
3. **No blind migrations:** Diagnose schema state before applying SQL.
4. **Preserve working features:** Avoid unnecessary changes to booking, dispatch, pricing, and authentication.
5. **Measure performance:** Verify speed and reliability through actual metrics.
6. **Safe automation:** Automate repeatable validation, not uncontrolled production changes.
7. **Reliable deployment:** Test, review, approve, deploy, and verify.
8. **Transparent reporting:** Record what changed, what was tested, and what remains unresolved.

**Final Rule:** AuroWater production changes are complete only after the relevant functionality, security, database state, and deployment health have been verified. Never claim success based solely on successful code compilation.
