---
status: accepted
---

# `AUTH_PROVIDER=simple`: static email/password accounts for cloud mode

## Context

Cloud auth was Supabase-only. Operators who only want a login gate in front of their own Postgres still had to create a Supabase project, run Docker locally, and configure Auth redirects.

## Decision

`AUTH_PROVIDER` selects the cloud auth backend: `supabase` (default) or `simple`.

`simple` uses one env var, `AUTH_USERS`, a comma-separated `email:password` list. There is no sign-up UI and no users table. Each email is still a separate Owner: a matching login sets a signed session cookie (`src/lib/simple-auth/session.ts`, HMAC via Web Crypto for Edge middleware) whose Owner id is a deterministic UUID v5 of the lowercased email (`deriveOwnerId()`). That satisfies the same `getCurrentOwnerId()` contract as Supabase.

`middleware.ts`, `current-owner.ts`, login, and sign-out branch on `getAuthProvider()`. Unset `AUTH_PROVIDER` keeps the previous Supabase behavior.

## Alternatives considered

- One shared password and one synthetic Owner — rejected; everyone with the password would share one dataset.
- Store raw email as `owner_id` (change columns to `text`) — rejected; large schema change for no gain over UUID v5 derivation.
- Users table for accounts — rejected; the point of this provider is env-only config with no migrations.
- Auto-detect provider from which env vars are set — rejected; a missing Supabase var would silently switch backends.
- `node:crypto` for HMAC — rejected; middleware runs on Edge, which has no `node:crypto`. Web Crypto works in Node and Edge.
- Separate `AUTH_SESSION_SECRET` — rejected; the cookie HMAC is keyed by that email’s current password in `AUTH_USERS`, so editing the list revokes sessions without an extra secret.

## Consequences

- Cloud auth without Supabase: `DEPLOYMENT_MODE=cloud`, `AUTH_PROVIDER=simple`, `AUTH_USERS=…`, plus Postgres (`POSTGRES_URL`).
- Each email is an isolated Owner. No audit trail, sign-up, password reset, or session expiry. Change `AUTH_USERS` and redeploy to add, remove, or rotate accounts (and invalidate cookies for that email).
- Passwords must not contain `,` or `:`.
- Signed-in email is available for both providers in the cloud Owner controls.
