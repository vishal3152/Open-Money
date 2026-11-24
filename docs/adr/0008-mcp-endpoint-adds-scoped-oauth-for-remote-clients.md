---
status: proposed
---

# MCP import server adds a scoped OAuth-protected public endpoint, ahead of the general hosted phase

## Context

`docs/specs/import.md` originally specified the MCP import server as loopback-only, mounted on the local Next.js server and unreachable off the local machine. That matched the local-first rule of not building auth, tenancy, or cloud-sync ahead of the hosted phase.

Cursor and GitHub Copilot can connect to a loopback MCP endpoint directly. ChatGPT’s connector model cannot: it requires a publicly routable HTTPS endpoint protected by OAuth 2.1 with dynamic client registration. All three clients need to upload transactions.

## Decision

Amend the loopback-only constraint. The same four MCP tools (`list_institutions`, `list_accounts`, `stage_import`, `commit_import`) are also exposed over a public, OAuth-protected HTTP endpoint, alongside — not instead of — the existing loopback endpoint.

This is a narrow exception: it authenticates requests to this one endpoint only. It is not a general auth system, not multi-tenancy, and not the hosted Postgres/Supabase tier. There is still exactly one Owner per dataset, so the OAuth token answers “is this the app owner’s assistant,” not “which owner.”

## Alternatives considered

- Loopback only, wait for the hosted phase — rejected: ChatGPT support is needed now.
- Pull the full hosted multi-tenant phase (Supabase Auth, `src/lib/supabase`, `Pg*Repository`) forward to authenticate this endpoint — rejected: far larger scope than requested; would ship the cloud tier’s login/session/tenancy work for one MCP connector.
- A single-purpose OAuth guard scoped to just this endpoint, independent of the hosted tier’s eventual auth — accepted.

## Consequences

- New follow-up scope (not folded into the MCP-tools TDD slice): public hosting/TLS for this endpoint, OAuth 2.1 token issuance/validation, and a security pass (rate limiting, scope-limited tokens, revocation).
- Local/self-hosted deployments are unaffected by default: the loopback endpoint still needs no auth. The public endpoint is additive and opt-in.
- When the general hosted multi-tenant phase begins, this endpoint’s single-owner token model needs revisiting against real per-owner identity.
