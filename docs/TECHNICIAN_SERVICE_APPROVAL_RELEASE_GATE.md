# Technician service approval — executable release contract

## Problem and expected outcome
**Observed:** A signed-in plumber with 3/3 approved identity documents clicks
**Apply for service approval**. The previous button opened `/register/pro`,
which defaults to **water can supplier** and reports a role conflict.

**Expected:** An existing technician never registers a second account.
Clicking **Request service approval** opens `/technician/services/apply`,
collects only the selected service, experience, locality and PIN,
creates a pending request in **Admin → Users → Pending approval**, and
shows a reference. Only a verified admin can grant the exact requested
service after checking work evidence.

KYC approval, technician profile activation and individual service
capability approval are **three distinct states**. No client-only checkbox,
Auth user metadata, submitted form or old file can grant job permissions.

## States, purpose, roles, and executable contracts

| Scenario | Actor | Initial state | Action | Required server result | What must NOT happen |
|---|---|---|---|---|---|
| T1 | Technician | Existing account, docs approved | Tap dashboard CTA | Technician-only form; no re-registration | Water-can tab or supplier role conflict |
| T2 | Technician | Missing/expired login | Open application | Authenticated API returns 401; sign-in link | Other user's form/data |
| T3 | Supplier/customer/admin | Wrong role | POST service request | 403 role-only enforcement | Technician application created |
| T4 | Technician | Suspended/inactive | POST | 403/409, no write | Bypass restrictions |
| T5 | Technician | Missing/latest rejected Aadhaar or photo | POST | 409 and document instructions | Accept old approved replacement |
| T6 | Technician | KYC approved, active | Request plumbing | One pending application with correct role and skill | New auth user or active service |
| T7 | Technician | Two concurrent identical POSTs | Submit both | Same application reference, one DB row | Duplicate applications |
| T8 | Technician | Another service pending | Request RO | 409, existing pending visible | Silent overwrite |
| T9 | Admin | Pending plumbing request | Review evidence and approve | Atomic application, account and exact capability update | Unreviewed broad privileges |
| T10 | Admin | Pending RO, insufficient evidence | Reject | Rejected record; service still unavailable | Job dispatch enabled |
| T11 | Technician | Already approved plumbing | Request plumbing again | 409 Already approved | Duplicate capability change |
| T12 | Technician | New service already approved | Open form | Choose first unapproved service | Disabled default form |
| T13 | All | Change browser language | Open status/form | Plain Hindi or English, complete links | New registration wizard |
| T14 | Admin | Latest KYC image rejected | Review pending request | Approval disabled; RPC also rejects | Using old approved image |
| T15 | Any | Reload/open another tab | GET status | Server state, no stale device flag | Fake approval from localStorage |
| T16 | CI | Any application or API change | Run unit/build/security checks | Failing policy/routing breaks CI | Regex-only smoke treated as E2E proof |

## Tests and enforcement
1. `npm run test:unit` executes the pure state-machine cases in
   `tests/technician-service-approval-flow.unit.mjs`. These import and
   **execute** `src/lib/technician-service-approval.ts`, checking roles,
   skill mappings, documents, duplicate requests, and conflicts.
2. `npm run lint`, `npm run test:regression`, `npm run build` and
   CodeQL must pass on each PR commit. This confirms compilation and
   static/regression behavior, **not** real browser/server compatibility.
3. `npm run test:technician:stage` makes **real HTTP calls** against an
   isolated staging Supabase project. This flow checks: authenticated GET,
   invalid POST, simultaneous duplicate submissions, real admin pending
   list, actual admin approval, capability readback, blocked duplicate,
   rejection, and verification that rejected service is not approved.
4. Run the protected GitHub workflow:
   `Technician service application - authenticated staging E2E`
   on the candidate PR branch. Configure the **staging-e2e** environment
   with variables `TECHNICIAN_STAGE_URL`,
   `TECHNICIAN_STAGE_DB_ISOLATED=yes`,
   `TECHNICIAN_STAGE_SUPABASE_URL` (a separate project),
   `TECHNICIAN_STAGE_SUPABASE_ANON_KEY`; secrets
   `TECHNICIAN_STAGE_EMAIL`, `TECHNICIAN_STAGE_PASSWORD`,
   `ADMIN_STAGE_EMAIL`, `ADMIN_STAGE_PASSWORD`
   (plus optional `VERCEL_AUTOMATION_BYPASS`).
   Require review of this environment and add its job as a release gate.
   **Never** point it at production; the script rejects production hostnames
   but operators must also confirm the staging DB credentials are isolated.
5. Stage fixture technician must be active, identity front/back/photo approved,
   with no pending technician request or approved plumbing capability.
   The script intentionally changes only that staging fixture and cannot
   be safely repeated without resetting it.
6. Do a mobile-browser smoke run at 375px and 768px: dashboard link,
   Hindi/English, required fields, offline/reconnection, back navigation,
   admin decision, error toast, notifications, and old-session handling.

## Database deployment gate
Production migration history was checked on 2026-11-05:
`20261105123000` and `20261105160000` were **not recorded** as applied.
Deploy them in the reviewed order before
`20261105183000_technician_service_request_flow.sql`.
The latter supplies the atomic request RPC, idempotent pending index and
latest-KYC-aware admin review RPC. Inspect with Supabase advisors, test in
staging, verify `pg_get_functiondef`, and confirm the actual schema and
applying account are correct. **Do not use privileged SQL to approve a
customer or technician manually.**

## Release decision
Do not merge/deploy while any required CI or live staging check is failing,
skipped due to missing credentials, or unverified. Normal unit and build
success alone must **never** be reported as complete end-to-end proof.
