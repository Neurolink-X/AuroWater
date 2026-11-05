# AuroTap cross-role quality policy — enforceable release gates

## Goal and the 99.99% target
We target **99.99% successful critical user journeys** in real production
(the monthly error budget is roughly 4.32 minutes for an always-on service,
if measuring availability rather than per-journey completion). **99.99% is a
target, NOT a proven accuracy claim or zero-bug guarantee**. Track the
actual numerator/denominator for each workflow, report time window, volume,
and confidence; do not call unit-test pass percentage real-world accuracy.

For a claim that the underlying per-journey failure probability is below
0.01%, zero failures in only 100 runs is not meaningful. Roughly **30,000
independent representative successful trials with zero failures** are
needed for a one-sided 95% upper bound near 0.01%. Production conditions
are not perfectly independent, so measure across roles, device types,
network states, locations and release cohorts rather than one fixture.

## Platform architecture
**Layer A — every PR (CI, fail closed)**:
- Static contracts: 10 domains, 12 sensitive APIs, critical links and
  page existence. Explicit ownership/purpose rather than detached assertions.
- Executable positive/negative/mutation-style policy tests:
  `tests/platform-quality-contract.unit.mjs`.
- Git-diff impact gate: changed high-risk source files are associated with
  domains, including **downstream actor dependencies**. Each impacted domain
  must have a modified domain-specific test file in the PR. An unrelated
  test file does NOT satisfy evidence. Unknown source modules fail closed
  and require adding ownership to the contract.
- Existing lint, unit, regression, production build, CodeQL and bundle audit.
- Tests that merely inspect a string count as static evidence only and
  cannot be cited as actual authenticated end-to-end behavior.

**Layer B — protected staging (real APIs, independent project)**:
- Manually dispatch CI input `run_platform_stage_role_matrix=true` on
  the candidate branch. This launches a **read-only** HTTP role matrix:
  Customer, Supplier, Technician, Admin; four protected GET endpoints.
- Verify anonymous = 401/403, rightful role = 200 and every other role =
  401/403. A 500/503 fails the gate rather than being treated as "secure".
- Configure `staging-e2e` with **separate** Supabase project URL and
  publishable key, `PLATFORM_STAGE_DB_ISOLATED=yes`, the protected
  `PLATFORM_STAGE_URL` preview, and credentials for 4 isolated fixtures:
  `PLATFORM_STAGE_<ROLE>_EMAIL` and `PLATFORM_STAGE_<ROLE>_PASSWORD`.
- Staging script never performs POST/PUT/PATCH/DELETE and rejects production
  hostnames / the known production Supabase project ID.
- Technician write-based approval end-to-end tests remain their separately
  protected staging job; customer order, payouts and subscription
  write-based E2E need dedicated isolated test data before being promoted
  to hard release gates. Do NOT run destructive workflows in production.

**Layer C — production canary and monitoring (not yet automated here)**:
- Capture role+journey success rate, error code, API p95/p99, stale-data
  incidents, and DB migration errors. Avoid user PII in logs.
- Roll out progressively, watch the journey health for a bounded window,
  and roll back on error-budget burn, unauthorized spike, duplicate payout
  or data integrity violation.
- If an external dependency (SMS/UPI/push/location) cannot be tested in
  staging, explicitly mark the scenario UNVERIFIED and block high-risk
  deployment or grant a documented human-reviewed exception, never mark PASS.

## Context → roles → execution → assertions

| Journey | Initiator → next actor | Core transitions and negative cases |
|---|---|---|
| Signup/login | Visitor → Customer/Supplier/Technician/Admin | credential, OTP/session validity, role isolation, logout vs 401, return URL |
| Booking/address | Customer → Supplier or Technician → Admin | selected address pinned, 6-digit PIN/serviceability, server total, one order, fallback, other-city denial |
| Supply | Supplier → Customer | availability, stock, accept/reject, ownership, cancellation, missing coordinates |
| Technician/Plumber | Technician → Admin → Customer | document KYC, service capability approval, no wrong-role shortcut, job OTP/complete |
| Dispatch | Customer booking → eligible partner | zone, distance, capacity, retries, idempotency, race/conflicting dispatch |
| Pricing | Admin → Customer → Finance | publish, cache invalidation, surcharges, total recomputation and ledger |
| Subscription | Customer → Supplier → Payments | pause/resume, recurring generation, no duplicate, correct entitlement |
| Finance | Supplier/Technician → Admin | append-only ledger, payout state, double-payment and reversal safety |
| Notification | Any role → device/web | in-app default, consented push, unread/read, retention, role isolation |
| Admin recovery | Customer/Supplier/Technician → Admin | verified identity, approved action, audit, notification, no fake request |

## PR rejection rules
1. Runtime file unmapped → FAIL; add explicit domain in code.
2. Domain changed with no relevant test update → FAIL.
3. Deleted/moved critical route or role-check → FAIL.
4. Build/TypeScript, unit, regression, CodeQL or deployment check fails → DO NOT MERGE.
5. Database migration unreviewed/unapplied prerequisite → DO NOT CLAIM LIVE.
6. Stage role matrix or write-lifecycle tests skipped → **UNVERIFIED**,
   even when static CI passes. They are not automatically run on PRs without
   isolated secrets, because this could mutate the live database.

## Running locally
```sh
npm run test:unit
npm run test:platform:contract
PLATFORM_DIFF_BASE="$(git merge-base HEAD origin/main)" npm run test:platform:contract
npm run test:regression
npm run lint
npm run build
```

Update `scripts/platform-quality-contract.mjs` whenever a new role,
financially critical endpoint, or dependency appears. Update the linked
domain test cases and release policy in the same PR.
