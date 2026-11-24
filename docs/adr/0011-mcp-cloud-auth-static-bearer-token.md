---
status: accepted
---

# Cloud MCP access uses a static per-Owner bearer token

## Context

ADR-0010 left MCP statement import out of cloud scope. Cloud deployments now need the same MCP tools against Postgres.

Local mode trusts loopback via `isLoopbackHost()`. A hosted deployment has no “same machine,” so cloud requests need an Owner identity check before tools run.

## Decision

Owners generate an MCP access token from Settings (`/settings/mcp`). Only the SHA-256 hash is stored (`mcp_access_tokens`, one row per Owner). The plaintext is shown once.

Clients send `Authorization: Bearer <token>`. Claude Code, Cursor, and Claude Desktop custom connectors already support a static header, so no client OAuth is required. `src/app/api/mcp/cloud-auth.ts` hashes the presented token and resolves the Owner (`resolveOwnerIdByTokenHash` — a cross-Owner lookup, same pattern as the email-sync cron credential list). Missing or non-matching tokens return 401.

Token generation is gated by the existing cloud sign-in session. This does not implement ADR-0008’s OAuth server for clients that cannot send a static header (for example ChatGPT).

## Alternatives considered

- Reuse the short-lived Supabase access token as the MCP credential — most MCP clients treat headers as static; expiry forces frequent re-paste for little gain.
- Build ADR-0008’s OAuth 2.1 + dynamic client registration now — disproportionate for clients that already accept a static bearer token.
- Keep only the Host-header guard in cloud — Host names the app for every caller and does not identify an Owner.

## Consequences

- `/api/mcp` uses loopback checks in local mode and bearer-token Owner resolution in cloud mode. The two paths do not share a guard.
- One active token per Owner. Regenerating or revoking invalidates the previous token immediately.
- A leaked token grants the four MCP tools for that Owner only, through the existing repository `ownerId` seam. Recovery is revoke and regenerate.
