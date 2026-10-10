# Role-by-Role Production Audit — 2026-10-10

Scope: source inspection of the current `main` branch. This is a static audit; no live accounts, browser sessions, production database, or Vercel deployment were accessed.

## Supplier

### Already present
- Authenticated supplier order listing, assignment acceptance endpoint, and status update endpoints.
- Supabase Realtime subscription code in the supplier dashboard.
- Stock/inventory endpoint and atomic stock reservation/dispatch SQL migration.
- Supplier settings fields for online state, price, UPI, bank account, IFSC, auto-accept and service radius.
- Earnings RPC endpoint and payout-request endpoint.
- Customer notifications are written from several order lifecycle handlers.

### Gaps / risks requiring fixes or live verification
1. **Payout method validation is incorrect.** `src/app/api/supplier/payouts/route.ts` requires `upi_id` and sets `method` to `'upi'` whenever that required value exists; therefore the bank-only path cannot be selected. It also stores UPI and bank details together in a free-form notes field. Refactor to an explicit `method: 'upi' | 'bank'` discriminated schema, validate only the selected method, avoid returning full bank details in general payout responses, and confirm the payout table schema before migration.
2. **Payout request is not proof of payment.** No payment-provider or bank transfer execution was found in the inspected handler. UI must describe this as a payout request/pending payout unless an authorised admin/payment integration actually completes it.
3. **Order rescheduling/rejection needs a canonical transition.** The inspected supplier status endpoints primarily allow `IN_PROGRESS` and `COMPLETED`; a single authoritative, atomic endpoint for reject/reschedule with reason, proposed time, state guard, and customer notification was not confirmed. Avoid adding a competing route until existing dispatch/recovery paths are reconciled.
4. **Realtime must be verified against actual Realtime publication, RLS, and event filters.** A channel in the UI alone does not prove that newly assigned orders arrive in production.
5. Verify online/offline and service-radius settings actually affect dispatch eligibility, not just dashboard display.
6. Confirm notification center supports supplier read/unread state and actionable deep links; the existence of a notification type alone does not establish this.

## Customer

### Already present
- Customer-only order history API, authenticated order creation, server-side pricing checks, address ownership checks, and serviceability validation.
- Customer notification listing API and order tracking subscription code.
- Customer cancellation route notifies the supplier.

### Gaps / risks requiring verification
- Test order creation to supplier assignment to notification delivery, including no-supplier and timeout/recovery cases.
- Confirm cancellation/refund rules are state-aware and idempotent; cancellation must not leave reserved stock locked.
- Test address/serviceability failures, final price mismatch, duplicate submit/retry, subscriptions, and emergency orders.
- Verify tracking and notification RLS prevent one customer reading another customer's order or events.

## Technician

### Already present
- Technician jobs API enforces technician role and rejects accounts that are not active/approved.
- Technician order enrichment helper and dispatch migration exist.

### Gaps / risks requiring verification
- The inspected `src/app/technician/dashboard/page.tsx` content appears heavily commented out at its beginning. Confirm whether the live route renders the intended current dashboard or a placeholder/empty page; do not replace it without inspecting the full route and current UI.
- Verify job accept/start/complete actions are persisted through APIs and not only localStorage.
- Verify verification documents use private storage, signed access, upload limits, and admin-only review.
- Verify technicians cannot view jobs assigned to other technicians or see unnecessary customer data.

## Cross-role release gates
- Run `npm run lint`, `npm run test:regression`, and `npm run build` against the PR head.
- Run authenticated smoke tests with one test account per role and test forbidden cross-role requests.
- Verify browser console and network failures on mobile and desktop.
- Verify database migrations on a staging Supabase project and compare required schema/RPCs with deployed schema before production.
- Test two suppliers competing for one order, duplicate API retries, cancellation vs acceptance races, and inventory reservation/release.
- Confirm monitoring/alerts, backups, rollback plan, and credential rotation.

## Explicitly not claimed
No live production workflow has been certified by this static review. “Zero console errors” is an acceptance criterion to test, not a result established by repository inspection.
