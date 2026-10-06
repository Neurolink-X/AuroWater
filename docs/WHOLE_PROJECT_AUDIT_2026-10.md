# AuroWater — Whole-Project Production Audit & Upgrade Plan

Audit basis: current `main` application architecture reviewed on 2026-10-06, then used as the baseline for the `worldclass-supplier-platform` upgrade branch.

## Executive verdict

AuroWater has a strong technical foundation: Next.js App Router, Supabase, role-based APIs, serviceability checks, server-side price validation, supplier dispatch, subscriptions, notifications and realtime refresh.

The main gap is not missing screens. It is inconsistent business state across UI, APIs and database.

Production-critical risks:
1. Supplier online/offline state is not clearly operated from the real supplier workspace.
2. Supplier assignment has an accept/reject backend but the dashboard starts delivery directly.
3. There are two supplier status endpoints with different guarantees.
4. Dispatch timeout/retry is partly lazy instead of globally scheduled.
5. Inventory is only deducted at completion and was not atomically reserved.
6. Supplier fleet/profile/documents/pricing screens use localStorage/demo data rather than the operational database.
7. Supplier earnings are derived from fields that are not reliably populated.
8. Payout request has a success endpoint that does not persist a payout transaction.
9. The payouts table previously treated new rows as paid because `paid_at` defaulted immediately.
10. SEO sitemap/proxy contained URLs whose page implementations were not present in the public route tree.

## Target architecture

Customer → PENDING → dispatch → ASSIGNED → supplier ACCEPT/REJECT or timeout → IN_PROGRESS → COMPLETED.

At ACCEPT:
- reserve required water stock atomically;
- persist accepted_at;
- persist dispatch response;
- notify customer.

At COMPLETED:
- consume reserved stock atomically;
- persist completed_at;
- retain the immutable supplier payout amount;
- notify customer;
- update supplier milestones.

Payouts become a separate ledger:
- pending → processing → paid/rejected;
- supplier cannot create overlapping pending/processing requests;
- payout amount is capped by actual pending supplier earnings.

Dispatch must be driven by a scheduled worker/cron in addition to on-demand triggers.

## World-class product principles

Supplier:
- clear ONLINE/OFFLINE control;
- real-time incoming assignment;
- explicit Accept / Reject;
- response deadline;
- stock available/reserved view;
- operational delivery state;
- real earnings and payout ledger;
- database-backed settings;
- no misleading demo controls.

Customer:
- serviceability before payment/confirmation;
- transparent price;
- supplier status timeline;
- delivery tracking;
- subscription reliability;
- clear failure/retry handling.

Admin:
- dispatch exceptions;
- supplier availability;
- inventory risk;
- payout approvals;
- operational audit trail;
- zone/capacity management.

SEO:
- every indexable service URL resolves to a real page;
- unique title/description/canonical;
- useful visible local content;
- Service + BreadcrumbList + FAQPage structured data where appropriate;
- sitemap contains only real canonical URLs;
- no fabricated ratings, addresses or performance claims.

## Upgrade order

P0: supplier availability, assignment lifecycle, stock reservation, payout ledger, dispatch worker.

P1: database-backed supplier fleet/profile/documents, AuroTap direct-routing, capacity/vehicle matching, admin operations.

P2: route optimization, richer tracking, queue infrastructure, advanced supplier scoring, analytics and automated exception handling.

## Important implementation rule

The database is the source of truth. LocalStorage may only hold UI preferences/drafts, never supplier operational state, pricing, documents, inventory, payout balance or fleet availability.
