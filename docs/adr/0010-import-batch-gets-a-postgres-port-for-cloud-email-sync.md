# ImportBatch gets a Postgres port, for cloud email alert sync

## Context

An earlier cloud plan left ImportBatch out of scope and shipped the cloud tier without AI-assisted import for v1. Email alert sync (`docs/specs/email-alert-sync.md`) needs somewhere in the cloud tier to write the Transactions it produces, and it reuses `ImportBatch` (ADR-0009) rather than a parallel entity.

MCP statement import remains out of scope for cloud: it is a local-process integration (an AI assistant talking to a loopback MCP server) with no hosted multi-tenant shape.

## Decision

`ImportBatch` gets a full Postgres port (`import_batches` table, `transactions.import_batch_id`, `PgImportBatchRepository`), using the same `getScopedDb` / app-layer `ownerId` filtering as other cloud entities (ADR-0006). `/imports` and `/imports/[id]` no longer redirect away in cloud mode.

Email alert sync in cloud is a Vercel Cron job (`vercel.json` `crons`, `CRON_SECRET`-authenticated) hitting a Node-runtime API route once per configured Owner. Vercel serverless has no long-running process for the local poll daemon.

Per-Owner IMAP and LLM credentials live in `email_sync_settings` (owner-scoped, app-layer filtered). That is an exception to the local default of secrets only in `settings.json` — see the spec’s “Cloud credentials” note. There is no RLS fallback if an `ownerId` filter is missing (ADR-0006).

Cloud MCP import was out of scope for this ADR; ADR-0011 later added bearer-token auth for `/api/mcp` in cloud mode.

## Alternatives considered

- Leave ImportBatch local-only and invent a cloud-only entity for email sync — rejected: would duplicate review UI and break reuse of ImportBatch (ADR-0009).
- Store mailbox/API keys as Vercel project env vars — rejected: cloud is multi-tenant; env vars cannot hold different credentials per Owner.
