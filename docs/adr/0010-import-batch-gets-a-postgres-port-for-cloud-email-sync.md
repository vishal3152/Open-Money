# ImportBatch gets a Postgres port, for cloud email alert sync

## Context

An earlier cloud plan left ImportBatch out of scope and shipped the cloud tier without AI-assisted import for v1. Email alert sync (`docs/specs/email-alert-sync.md`) needs somewhere in the cloud tier to write the Transactions it produces, and it reuses `ImportBatch` (ADR-0009) rather than a parallel entity.

MCP statement import remains out of scope for cloud: it is a local-process integration (an AI assistant talking to a loopback MCP server) with no hosted multi-tenant shape.

## Decision

`ImportBatch` gets a full Postgres port (`import_batches` table, `transactions.import_batch_id`, `PgImportBatchRepository`) — the same port every other entity already has, following the `getScopedDb` / app-layer `ownerId` filtering pattern from ADR-0006. `/imports` and `/imports/[id]` drop their `isCloudMode()` redirect guard.

Email alert sync’s cloud trigger is a Vercel Cron job (`vercel.json` `crons`, `CRON_SECRET`-authenticated) calling a Node-runtime API route once per configured Owner. The local tier’s standalone poll process cannot run on Vercel serverless, which has no long-running process to hold an interval.

Per-Owner IMAP/OpenRouter credentials live in a new `email_sync_settings` Postgres table (owner-scoped, app-layer filtered like every other cloud table). That is an explicit exception to storing such secrets only in the owner’s `settings.json` — see the spec’s “Cloud credentials” note. There is no RLS second line of defense against an `ownerId`-filter bug (ADR-0006).

## Alternatives considered

- Leave ImportBatch local-only and give email alert sync a different, cloud-only entity — rejected: defeats reusing ImportBatch (ADR-0009’s justification) and would mean two parallel review UIs.
- Store cloud email-sync credentials as Vercel project environment variables instead of a per-Owner table — rejected: the cloud tier is multi-tenant, and env vars cannot hold a different mailbox/API key per Owner. That would only work for a single-owner cloud deployment.
