# AuroWater Authentication System

Production-oriented authentication state management for the AuroWater platform.

AuroWater is a role-based water delivery and home-service marketplace with four primary roles:

- **Customer**
- **Supplier**
- **Technician**
- **Admin**

This authentication module provides a consistent client-side authentication experience while keeping the actual security boundary on the server, API, Supabase Auth, and database Row Level Security (RLS).

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Roles](#roles)
- [Account Lifecycle](#account-lifecycle)
- [Operational Access](#operational-access)
- [Permissions](#permissions)
- [File Responsibilities](#file-responsibilities)
- [Installation](#installation)
- [Provider Setup](#provider-setup)
- [Basic Usage](#basic-usage)
- [Role Protection](#role-protection)
- [Permission Protection](#permission-protection)
- [Supplier and Technician Gating](#supplier-and-technician-gating)
- [Session Management](#session-management)
- [Cross-Tab Synchronization](#cross-tab-synchronization)
- [Session Expiry](#session-expiry)
- [Security Model](#security-model)
- [Server-Side Requirements](#server-side-requirements)
- [Supabase RLS Requirements](#supabase-rls-requirements)
- [Login Flow](#login-flow)
- [Logout Flow](#logout-flow)
- [Migration Notes](#migration-notes)
- [Production Checklist](#production-checklist)
- [Recommended Future Architecture](#recommended-future-architecture)
- [Troubleshooting](#troubleshooting)
- [Design Principles](#design-principles)

---

# Overview

The AuroWater authentication layer is designed around one principle:

> **Client authentication state improves UX; server-side authorization provides security.**

The `useAuth` hook manages:

- Client authentication state
- Hydration
- Session expiry
- Cross-tab synchronization
- Role information
- Account status
- Supplier/technician verification state
- Operational state
- UI permission checks
- Central logout
- Dashboard routing
- Backward-compatible session utilities

It must **never** be used as the only security mechanism.

---

# Architecture

## High-Level Flow

```text
                 ┌─────────────────────────┐
                 │      Supabase Auth      │
                 │   Authentication Layer  │
                 └────────────┬────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │    public.profiles      │
                 │                         │
                 │ role                    │
                 │ account status           │
                 │ verification status      │
                 └────────────┬────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │ Server / API / RLS       │
                 │ Authorization Boundary   │
                 └────────────┬────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │       useAuth()         │
                 │    Client UI State      │
                 └────────────┬────────────┘
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
         Customer          Supplier        Technician
             │                │                │
             ▼                ▼                ▼
          Customer       Approval gate     Verification
          workspace      + operational     + operational
                              gate              gate
```

Admin access follows the same server-authorized model with elevated permissions.

---

# Core Concepts

## 1. Authentication

Authentication answers:

> "Who is this user?"

This should be established by the trusted authentication provider/server.

The browser must not be allowed to decide that it is an authenticated user merely by modifying local storage.

---

## 2. Authorization

Authorization answers:

> "What is this authenticated user allowed to do?"

AuroWater uses multiple authorization dimensions:

```text
Identity
  +
Role
  +
Account Status
  +
Verification Status
  +
Operational State
  +
Resource Ownership
  +
Permission
```

For sensitive actions, all relevant checks should happen server-side.

---

## 3. Role

The platform supports:

```ts
type AuthRole =
  | 'customer'
  | 'technician'
  | 'supplier'
  | 'admin';
```

Role determines the user's general platform responsibilities.

---

## 4. Account Status

Account lifecycle is represented by:

```ts
type AccountStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'banned'
  | 'rejected';
```

A role alone does not mean that an account is operational.

For example:

```text
role = supplier
status = pending
```

does **not** mean the supplier can receive production orders.

---

## 5. Verification Status

Supplier and technician operational access can additionally depend on:

```ts
type VerificationStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected';
```

This separates:

- Account existence
- Admin approval
- Verification
- Operational eligibility

---

# Roles

## Customer

Typical capabilities:

- Browse available services
- Create orders
- View own orders
- Cancel eligible orders
- Manage customer-side account information

Customer order/resource ownership must be enforced server-side.

---

## Supplier

Typical capabilities:

- Access supplier workspace
- Manage eligible supplier orders
- View supplier earnings
- Request payouts

Recommended lifecycle:

```text
Registration
    ↓
Pending
    ↓
Admin Review
    ↓
Approved
    ↓
Service Area Configured
    ↓
Inventory / Business Setup
    ↓
Active
    ↓
Operational
```

Suspended, banned, rejected, or otherwise ineligible suppliers must not receive operational work.

---

## Technician

Typical capabilities:

- Access technician workspace
- Accept eligible jobs
- Update job status
- View technician earnings

Recommended lifecycle:

```text
Application
    ↓
Pending Review
    ↓
Admin Approval
    ↓
Document Verification
    ↓
Active
    ↓
Operational
```

A technician who is not operational must not receive or execute production jobs.

---

## Admin

Admin has elevated platform permissions including:

- User management
- Order management
- Finance management
- Settings
- Supplier oversight
- Technician oversight
- Operational administration

Admin authorization must always be verified server-side.

---

# Account Lifecycle

AuroWater should treat account state as a state machine rather than a single boolean.

```text
                    ┌──────────────┐
                    │    PENDING   │
                    └──────┬───────┘
                           │
                     Admin review
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
         ┌─────────┐              ┌──────────┐
         │ ACTIVE  │              │ REJECTED │
         └────┬────┘              └──────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
 SUSPENDED         BANNED
```

The exact workflow can differ by role, but the important principle is:

> **Registration and operational eligibility are different states.**

---

# Operational Access

`isOperational` is intentionally stricter than `isLoggedIn`.

Conceptually:

```text
Logged in
   ↓
Active account?
   ↓
Role-specific verification?
   ↓
Operational
```

For suppliers:

```text
logged in
+ accountStatus = active
+ verificationStatus = approved
= operational
```

For technicians:

```text
logged in
+ accountStatus = active
+ verificationStatus = approved
= operational
```

For customers/admins, operational eligibility is based on an active account according to the platform authorization policy.

---

# Permissions

Permissions are represented using explicit action keys.

Examples:

```ts
'view:admin_dashboard'
'view:supplier_dashboard'
'view:technician_dashboard'
'view:customer_dashboard'

'manage:settings'
'manage:users'
'manage:orders'
'manage:finance'

'create:order'
'cancel:order'

'view:earnings'
'request:payout'

'accept:job'
'update:job_status'
```

The `can()` helper is intended primarily for **UI gating**.

Example:

```tsx
const { can } = useAuthContext();

{can('create:order') && (
  <button>Create Order</button>
)}
```

This improves UX but does not secure the API.

---

# Operational Permissions

These permissions require an operational account:

```text
manage:orders
request:payout
accept:job
update:job_status
```

For example:

```ts
can('accept:job')
```

returns false for a technician who is:

- Pending
- Suspended
- Banned
- Rejected
- Not verified

---

# File Responsibilities

## `src/hooks/useAuth.ts`

Responsible for client-side:

- Auth state
- Session cache
- Hydration
- Expiry
- Role helpers
- Status helpers
- Permission helpers
- Redirect helpers
- Logout
- Context provider

It is **not** the server security boundary.

---

## Authentication Provider

The authentication provider should be responsible for:

- Identity
- Credentials
- Authentication sessions
- Token lifecycle
- Sign-in
- Sign-out
- Refresh

For AuroWater, Supabase Auth is the preferred source of authentication truth.

---

## `public.profiles`

The profile layer should contain trusted application-level identity information such as:

```text
user_id
role
account_status
verification_status
full_name
phone
avatar_url
created_at
updated_at
```

Sensitive authorization decisions should use trusted server/database values.

---

## API Routes

API routes must independently verify:

```text
authenticated user
+
role
+
account status
+
verification status
+
permission
+
resource ownership
```

---

# Installation

The hook is designed for a Next.js App Router application.

Place the file at:

```text
src/hooks/useAuth.ts
```

Required project dependencies/imports include:

```text
next/navigation
react
sonner
@/lib/api-client
@/lib/auth/client-gate-cookies
@/lib/storage
```

These project utilities must exist and retain compatible APIs.

---

# Provider Setup

Wrap the appropriate application layout with `AuthProvider`.

```tsx
import { AuthProvider } from '@/hooks/useAuth';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
```

Then consume the shared state:

```tsx
import { useAuthContext } from '@/hooks/useAuth';

export default function DashboardHeader() {
  const {
    fullName,
    role,
    isLoggedIn,
    isOperational,
  } = useAuthContext();

  return (
    <header>
      <span>{fullName}</span>
      <span>{role}</span>

      {isOperational && (
        <span>Operational</span>
      )}
    </header>
  );
}
```

---

# Basic Usage

```tsx
const {
  session,
  loading,
  hydrated,
  isLoggedIn,
  role,
  isSupplier,
  isTechnician,
  isOperational,
} = useAuthContext();
```

Recommended rendering pattern:

```tsx
if (loading || !hydrated) {
  return <LoadingState />;
}

if (!isLoggedIn) {
  return <LoginRequired />;
}

return <Dashboard />;
```

---

# Role Protection

Use:

```tsx
const { requireRole } = useAuthContext();

const allowed = requireRole('supplier', {
  unauthorizedPath: '/',
});

if (!allowed) {
  return null;
}
```

Multiple roles:

```tsx
requireRole(['supplier', 'admin']);
```

Remember:

> This is a client navigation/UX guard.

The server must still enforce the role.

---

# Permission Protection

Use:

```tsx
const { requirePermission } = useAuthContext();

if (
  !requirePermission('manage:orders', {
    unauthorizedPath: '/',
  })
) {
  return null;
}
```

For UI:

```tsx
const { can } = useAuthContext();

if (can('request:payout')) {
  // Show payout action
}
```

---

# Supplier and Technician Gating

A supplier should not be treated as fully operational simply because:

```ts
role === 'supplier'
```

Instead:

```tsx
const {
  isSupplier,
  isApproved,
  isOperational,
} = useAuthContext();
```

Example:

```tsx
if (isSupplier && !isOperational) {
  return <SupplierApprovalState />;
}
```

Technician:

```tsx
if (isTechnician && !isOperational) {
  return <TechnicianVerificationState />;
}
```

Recommended supplier states:

```text
Pending approval
Under review
Approved
Configure service area
Configure inventory
Active
Suspended
Rejected
Banned
```

Recommended technician states:

```text
Application submitted
Under review
Approved
Documents pending
Documents verified
Active
Suspended
Rejected
Banned
```

---

# Session Management

## Write Session

After a trusted login response:

```ts
import { writeSession } from '@/hooks/useAuth';

writeSession({
  name: profile.full_name,
  email: user.email,
  role: profile.role,
  userId: user.id,
  accountStatus: profile.account_status,
  verificationStatus: profile.verification_status,
  accessToken,
});
```

The role and status should come from trusted server/database data.

Do not allow the browser to choose its own role.

---

## Update Session

For non-authentication profile changes:

```ts
const { updateSession } = useAuthContext();

updateSession({
  name: 'Updated Name',
  avatarUrl: '/avatar.webp',
});
```

Do not use client-side session updates to grant permissions.

For example, this must **not** be used as an authorization mechanism:

```ts
updateSession({
  role: 'admin',
});
```

Real role changes must happen through an authorized server/admin workflow.

---

# Logout

Use:

```ts
const { logout } = useAuthContext();

logout();
```

Silent logout:

```ts
logout({
  silent: true,
});
```

Custom destination:

```ts
logout({
  redirectTo: '/auth/login',
});
```

For complete production logout, the authentication provider should also invalidate the server-side/auth-provider session where applicable.

---

# Cross-Tab Synchronization

The authentication module listens for changes to:

```text
aurowater_session
```

When another browser tab changes or removes the session, the current tab updates its local authentication state.

This prevents situations such as:

```text
Tab A → user logs out
Tab B → still shows authenticated UI
```

The browser storage mechanism remains a synchronization mechanism, not a security boundary.

---

# Session Expiry

Default client cache TTL:

```text
7 days
```

It can be customized:

```tsx
<AuthProvider ttlMs={24 * 60 * 60 * 1000}>
  {children}
</AuthProvider>
```

When the local session expires:

1. Client session is cleared.
2. API token cache is cleared.
3. Auth gate cookies are cleared.
4. The user is redirected to login where appropriate.

Server authentication/session expiry must still be handled independently.

---

# Security Model

## Never Trust localStorage for Authorization

This is unsafe:

```ts
const session = JSON.parse(
  localStorage.getItem('aurowater_session')!
);

if (session.role === 'admin') {
  // Sensitive operation
}
```

A user can modify browser storage.

Correct approach:

```text
Browser
   ↓
Request
   ↓
Server verifies authentication
   ↓
Server loads trusted profile
   ↓
Server checks role/status/permission
   ↓
Server checks ownership
   ↓
Operation
```

---

# Server-Side Requirements

Every sensitive API endpoint should follow this structure:

```text
1. Authenticate request
2. Identify authenticated user
3. Load trusted profile
4. Validate account status
5. Validate role
6. Validate verification/operational state
7. Validate permission
8. Validate resource ownership
9. Perform operation
10. Write audit event where appropriate
```

Example:

```text
POST /api/supplier/orders/:id/accept
```

should verify:

```text
authenticated user
       +
role = supplier
       +
accountStatus = active
       +
verificationStatus = approved
       +
supplier owns/is assigned to order
       +
order is still acceptable
```

The client hook cannot safely perform these checks alone.

---

# Supabase RLS Requirements

Supabase RLS should protect database access independently of React.

Ownership concepts:

```text
Customer
  → can access own customer records

Supplier
  → can access authorized supplier records

Technician
  → can access assigned/authorized jobs

Admin
  → elevated access through trusted server/admin policy
```

Do not rely on:

```text
customer_id supplied by browser
supplier_id supplied by browser
technician_id supplied by browser
role supplied by browser
```

as proof of authorization.

The database/API must derive or validate ownership.

---

# Login Flow

Recommended production flow:

```text
User submits credentials
        ↓
Authentication provider
        ↓
Authenticated identity
        ↓
Load trusted profile
        ↓
Read role/status/verification
        ↓
Create client auth state
        ↓
Redirect to role dashboard
```

Dashboard mapping:

```text
Customer
    → /customer

Supplier
    → /supplier

Technician
    → /technician

Admin
    → /admin
```

A supplier or technician who is not yet operational should see the appropriate approval/verification workspace rather than receiving production work.

---

# Logout Flow

Recommended:

```text
User clicks Logout
        ↓
Authentication provider sign-out
        ↓
Clear local session cache
        ↓
Clear API token cache
        ↓
Clear auth gate state
        ↓
Clear client auth state
        ↓
Redirect
```

Do not rely only on:

```ts
localStorage.removeItem(...)
```

for production authentication invalidation.

---

# Migration Notes

The upgraded hook maintains compatibility with existing imports.

Existing helpers remain available:

```ts
saveSession()
removeSession()
useAuthLegacy()
```

They are retained so existing AuroWater screens do not need to be migrated simultaneously.

New code should use:

```ts
writeSession()
clearSession()
useAuth()
useAuthContext()
```

instead.

---

# Important Migration: Account Status

Existing login flows may currently create sessions containing only:

```ts
{
  name,
  email,
  role
}
```

The upgraded architecture supports:

```ts
{
  name,
  email,
  role,
  userId,
  accountStatus,
  verificationStatus
}
```

For production supplier/technician authorization, login/profile loading should provide trusted values for:

```text
accountStatus
verificationStatus
```

Otherwise the client cannot correctly represent operational state.

---

# Important Migration: Refresh Tokens

The custom `Session` interface retains `refreshToken` only for compatibility with existing code.

New authentication code should **not** introduce or persist refresh tokens in the custom localStorage session.

Prefer the authentication provider's secure session/token lifecycle.

---

# Recommended Data Model

AuroWater's profile layer should conceptually support:

```text
profiles
├── id
├── role
├── account_status
├── verification_status
├── full_name
├── phone
├── avatar_url
├── created_at
└── updated_at
```

Role-specific operational information should remain in dedicated tables where appropriate.

For example:

```text
supplier_settings
supplier_stock
supplier_milestones

applications
technician-specific verification data

orders
payouts
reviews
audit_logs
fraud_flags
```

Avoid putting every business attribute into the authentication session.

The session should remain lightweight.

---

# Recommended Future Architecture

The strongest long-term architecture is:

```text
                 ┌─────────────────────┐
                 │    Supabase Auth     │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │  Trusted Profile    │
                 │  Role + Status      │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Authorization Layer │
                 │ Policy / Server     │
                 └──────────┬──────────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
             API / RSC               RLS
                 │                     │
                 └──────────┬──────────┘
                            ▼
                     Client useAuth
                            │
                            ▼
                           UI
```

The client should become a **projection of trusted authentication state**, not the owner of authorization.

---

# Production Checklist

## Authentication

- [ ] Supabase Auth/session is the authentication source of truth.
- [ ] Login response derives role from trusted profile data.
- [ ] Client cannot self-upgrade its role.
- [ ] Logout invalidates the real authentication session.
- [ ] Session expiry is handled.
- [ ] Cross-tab logout works.

## Authorization

- [ ] Every sensitive API route authenticates the request.
- [ ] Role is validated server-side.
- [ ] Account status is validated server-side.
- [ ] Supplier approval is validated server-side.
- [ ] Technician verification is validated server-side.
- [ ] Resource ownership is validated server-side.
- [ ] Financial actions have independent authorization.
- [ ] Admin routes have independent authorization.

## Database

- [ ] RLS is enabled on sensitive tables.
- [ ] Customer ownership policies are tested.
- [ ] Supplier ownership/assignment policies are tested.
- [ ] Technician assignment policies are tested.
- [ ] Admin access is explicitly controlled.
- [ ] Service-role credentials are never exposed to the browser.

## UX

- [ ] No authentication flicker.
- [ ] Loading state exists.
- [ ] Unauthorized state exists.
- [ ] Supplier pending state exists.
- [ ] Technician verification state exists.
- [ ] Suspended account state exists.
- [ ] Expired session redirects cleanly.
- [ ] No sensitive error details are exposed.

## Engineering

- [ ] TypeScript build passes.
- [ ] ESLint passes.
- [ ] No hydration errors.
- [ ] No browser console errors.
- [ ] No secret/token logging.
- [ ] API 401/403 responses are handled consistently.
- [ ] Authentication events have appropriate telemetry.
- [ ] Critical authorization paths have automated tests.

---

# Troubleshooting

## `useAuthContext must be called inside <AuthProvider>`

Wrap the relevant layout:

```tsx
<AuthProvider>
  {children}
</AuthProvider>
```

Or use:

```ts
useAuth()
```

directly in a component that does not need shared context.

---

## User appears logged in but API returns 401

Check:

1. Authentication provider session.
2. API Authorization header.
3. Token expiry.
4. Server-side auth verification.
5. Supabase session/cookie configuration.
6. API client token handling.

Do not solve a 401 by simply trusting localStorage.

---

## Supplier is logged in but cannot receive orders

Check:

```text
role
accountStatus
verificationStatus
```

Expected:

```text
role = supplier
accountStatus = active
verificationStatus = approved
```

Then verify the server/API has the same operational policy.

---

## Technician cannot accept a job

Check:

```text
role = technician
accountStatus = active
verificationStatus = approved
```

Then verify:

```text
job is assigned/eligible
job status allows transition
technician owns/has authority over the job
```

The client permission helper is not enough.

---

## Hydration mismatch

Authentication state intentionally begins in a neutral client state and hydrates after mount.

Use:

```tsx
if (loading || !hydrated) {
  return <LoadingState />;
}
```

Avoid rendering storage-dependent authentication data during SSR.

---

# Design Principles

## 1. Security over convenience

A browser-controlled value is never trusted for authorization.

## 2. Role is not status

```text
supplier ≠ approved supplier
technician ≠ verified technician
```

## 3. Authentication is not authorization

Being logged in does not mean the user can perform every operation.

## 4. Client guards are UX

They improve navigation and UI behavior.

Server/API/RLS controls actual access.

## 5. Keep sessions small

Authentication sessions should not become a dumping ground for business data.

## 6. Fail closed

If authorization information is missing or ambiguous, operational access should not be granted.

## 7. Backward compatibility matters

Existing AuroWater pages should be migrated progressively rather than breaking the entire application.

## 8. Business lifecycle belongs in the domain model

Supplier approval, technician verification, serviceability, inventory, assignments, payouts, and order transitions should be represented by trusted domain data—not browser flags.

---

# Final Architecture Principle

AuroWater should follow this rule everywhere:

```text
┌─────────────────────────────────────────────┐
│                USER ACTION                  │
└──────────────────────┬──────────────────────┘
                       ↓
              Client UI / useAuth
                       ↓
               API / Server Action
                       ↓
             Authenticate identity
                       ↓
                 Check role
                       ↓
              Check account status
                       ↓
          Check verification/approval
                       ↓
              Check permission
                       ↓
             Check ownership/state
                       ↓
                 Database/RLS
                       ↓
                  Operation
                       ↓
               Audit / telemetry
```

> **The UI can hide an action.  
> The server must prevent the action.  
> The database must enforce the data boundary.**

This is the foundation for a production-grade AuroWater marketplace.
