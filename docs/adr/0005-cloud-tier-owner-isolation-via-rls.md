---
status: superseded by ADR-0006 (owner isolation is now app-layer `owner_id` filtering, not RLS)
---

# Cloud-hosted tier isolates Owners via Postgres RLS, not separate databases or app-layer filtering alone

## Context

Open Money is adding a cloud-hosted tier (Supabase Postgres + Supabase Auth) alongside the existing self-hosted SQLite tier. The cloud tier is offered as an in-app switch inside the same Electron app plus a browser-only deployment. All customers on the cloud tier share one Supabase project.

## Decision

Postgres Row-Level Security isolates Owners, in addition to repository-layer filtering. Not one Supabase project per customer, and not application-layer filtering alone.

Every table in the cloud schema carries an `owner_id`. RLS policies scope all reads and writes to `auth.uid()`. A single missed `WHERE owner_id = …` in a repository method would otherwise leak one customer’s bank data to another; RLS makes that failure mode structurally impossible.

Self-hosted mode is unaffected: zero auth and a single implicit Owner, as before.

## Alternatives considered

- App-layer filtering only, no RLS — rejected: a missing filter clause becomes a cross-tenant leak with no second line of defense.
- One Supabase project per customer — rejected: provisioning, migrations, and billing all multiply per customer.
- Multi-user shared datasets (household / joint accounts) — rejected for v1: adds membership modeling with no current requirement. One Owner per dataset is the simplest cardinality that satisfies “isolated per customer” and can extend later without a rewrite.
- Separate app or codebase for the cloud tier — rejected: the repository-layer design already supports a driver swap; a second codebase would duplicate every screen.

## Consequences

- Superseded by ADR-0006: owner isolation is now app-layer `owner_id` filtering, not RLS.
