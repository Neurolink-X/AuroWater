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

-
