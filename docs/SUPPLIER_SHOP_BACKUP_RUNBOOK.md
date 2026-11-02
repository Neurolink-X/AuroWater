# Supplier shop approval and recovery

Remote supplier onboarding is allowed. GPS is chosen for the shop, independently of current mobile-device location. Admin review of address/PIN/city/coordinates must be atomic.

Database migration is required before application rollout. RPC review locks pending request and commits profile + settings + history + audit in one transaction. On error, original shop GPS and address remain intact. Never silently replace approved location on a transient failure.

A genuine database backup requires platform-level PITR, encrypted offsite snapshots and tested restores, none of which this PR provisions. Existing payments, order assignments, ledger and stock controls must not be replayed automatically: use idempotency keys, fail closed for writes and manual recovery where necessary.

Verification: unit/regression/build, migration preflight, application submission, pending/rejected/approved requests, two competing admin reviewers, wrong PIN/city, absent migration, supplier dispatch continuity, payment/stock no-duplicate checks, preview smoke, live mobile verification.
