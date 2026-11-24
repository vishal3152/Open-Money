# Email alert sync

## Purpose

Turn bank debit/credit alert emails into reviewable `ImportBatch` / Transaction rows without pasting each message into an AI assistant.

Unlike MCP statement import (`docs/specs/import.md`), nobody is present at fetch time, so Open Money calls an LLM on the server to structure each alert (`docs/adr/0009-email-alert-sync-calls-llm-server-side.md`). The endpoint is any OpenAI-compatible chat-completions host the Owner configures (`docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md`).

| Tier | Trigger |
| --- | --- |
| Local / desktop / self-hosted | Standalone process: `pnpm email-sync:poll` (see Known gap below) |
| Cloud | Vercel Cron → Node route per Owner (`docs/adr/0010-import-batch-gets-a-postgres-port-for-cloud-email-sync.md`) |

## Behavior

- Settings (**Settings → Email Alert Sync**): IMAP host/port/username/app password, LLM base URL and model (required), API key (optional), poll interval. Local values live in `~/.config/money-watch/settings.json` next to `databasePath`, merge-preserved like other settings, stored in plaintext on disk.
- The poller is a **separate Node process** (`scripts/email-sync-poll-daemon.ts`), not inside Next.js. `imapflow` / `mailparser` break Next’s edge bundle when pulled into the app graph. **Known gap:** nothing starts this process automatically — not Electron, not `pnpm dev` / `pnpm start`. Operators run `pnpm email-sync:poll` themselves.
- Each tick fetches INBOX candidates: unseen messages of any age, plus messages from roughly the last six days even if `\Seen` (another client may mark mail read first). Idempotency uses the sync cursor, not the IMAP flag. On Gmail (`X-GM-EXT-1`), SEARCH also excludes Promotions and Social categories.
- Before sending a body to the LLM, a cheap classifier uses sender name(s) and subject (`createEmailClassifier`) to ask whether the message is a bank transaction alert. Telecom bills, OTPs, marketing, and e-commerce payment mail are excluded. Only “yes” messages get the full structured parse. Forwarded alerts may include `originalSenderName` from a forwarded-message block; the classifier prefers that over the forwarder’s name. Classifier “no” is recorded as `invalid` and never retried.
- Passed messages go to the configured LLM with a fixed schema (direction, amount, currency, date, masked account suffix, institution name, description, reference, claimed balance — decimal/plain strings, never pre-scaled minor units). Responses are validated field-by-field (`validateEmailAlertFields`).
- Invalid or non-JSON responses are **queued as unresolved alerts** with the LLM draft and invalid field list, not discarded and not written to the ledger. One bad message never aborts the rest of the poll.
- Account matching is deterministic: last four digits of the claimed number (non-digits stripped) plus case-insensitive exact institution name — never fuzzy. Exactly one Account → import; zero or many → unresolved. The LLM never chooses the Account.
- A matched alert becomes one `ImportBatch` (`source: "email"`) with one Imported Transaction, through the same validation as `commitImport`. Claimed currency must match the Account. Claimed balance is validated but **never** stored as batch closing balance or turned into a Snapshot/Reconciliation — reconcile email-synced Accounts manually.
- ImportBatch / Transaction ids are derived from `(mailbox, messageUid)` so a crash between create and cursor advance cannot double-write.
- **Idempotency** is one `EmailSyncCursor` per mailbox (`UIDVALIDITY` + highest UID read). Messages are processed ascending by UID; the pointer advances after each. A changed `UIDVALIDITY` restarts from the beginning. Unparseable UIDs do not move the pointer.
- Only alerts that still need the user are stored. Clean imports and rejected non-bank mail leave no queue row. Queued rows carry the draft and invalid fields.
- Unresolved reasons include: validation failures, implausible `occurredAt` vs the email `Date` header, zero/many Account matches, or amount/currency wrong for the Account. Queued alerts are not auto-retried.
- After a cursor-format upgrade, the first poll may re-read recent messages once (bounded duplicate LLM cost). Deterministic ids and unique constraints prevent double ledger writes.
- IMAP hosts are blocked if localhost/private/link-local (both tiers). LLM base URLs get the same class of check **only in cloud mode** (ADR-0013) so local Ollama on `localhost` works. `llm_api_key` stays plaintext at rest. PostgREST grants on secret tables are revoked.
- Resolving a queued alert on `/imports` lets the user fix direction, amount, currency, date, description, and pick the Account, then creates the email `ImportBatch`. Draft values are not trusted until revalidated. Claimed balance/reference/institution/suffix are shown as context only.
- Email batches reuse `/imports` and `/imports/[id]` (one line item, `source: "email"`). Those screens work in cloud mode (ADR-0010).
- **Cloud trigger:** `GET /api/cron/email-sync` (`runtime = "nodejs"`), `Authorization: Bearer $CRON_SECRET`, lists all credentials (`listAllEmailSyncCredentials`), polls each Owner independently. Schedule is daily `0 8 * * *` on Hobby; see `docs/cron-setup.md`.
- **Cloud credentials:** per-Owner row in `email_sync_settings`, app-layer `ownerId` filtering (ADR-0006). IMAP user/password encrypted at rest (ADR-0012). LLM API key remains plaintext.

## Invariants

- LLM output is validated before use; invalid responses are never written as ledger rows.
- The LLM never selects the Account; matching is suffix + institution only.
- Amounts and claimed balance are decimal strings checked against the Account currency; claimed `currencyCode` must match. Claimed balance never becomes a Snapshot/Reconciliation.
- Account-number suffixes shorter than four characters never match.
- Dates must pass `assertValidCalendarDate`.
- `occurredAt` far from the email `Date` header is queued unresolved (`isOccurredAtPlausible`); missing headers do not block solely for that reason.
- Each IMAP message is processed at most once per cursor rules.
- Non-alert and cleanly imported messages leave no queue row.
- Queued drafts are revalidated (`validateImportableEmailAlert`) before ledger write.
- Duplicate flagging against existing Transactions follows `docs/specs/import.md` (advisory only).
- The local poller is not imported from the Next.js app graph. The cloud cron route is the only Next path that loads `imapflow` / `mailparser`, with `runtime: "nodejs"`.
- `listAllEmailSyncCredentials` is cron-only, never from a per-Owner Server Action.

## Persistence requirements

- `email_sync_cursors` — one row per mailbox (SQLite and Postgres with `owner_id`).
- `processed_email_alerts` — unresolved queue only for listing; deleted when an `ImportBatch` is created. Legacy columns remain for older rows.
- `import_batches` / `transactions.import_batch_id` — SQLite and Postgres (ADR-0010). `confirmAll` stays the same non-atomic two-step as statement import.
- Local settings and last-poll status in `~/.config/money-watch/settings.json`.
- Cloud settings and status columns on `email_sync_settings`; IMAP fields encrypted (ADR-0012).
- `checkEmailSyncNow()` records sanitized outcomes for local poll, cron, and “Check now”.

## HTTP and UI contract

- Settings Email Alert Sync section on both tiers: secrets never echoed after save; status + **Check now**.
- `POST /api/email-sync/check-now` (`runtime = "nodejs"`) — one poll for the current Owner / local settings; 401 without cloud session; 400 if not configured.
- Email batches appear on existing `/imports` routes.
- `GET /api/cron/email-sync` — cron entry, cloud-only.
- Unresolved queue on `/imports` with in-place correction form (`withPersistedFormState`).

## Acceptance criteria

Covered by domain, email-sync, repository, and settings tests (SQLite and Postgres as applicable):

- Well-formed LLM payloads validate; malformed ones do not write ledger rows.
- Classifier false skips the full parse; true proceeds.
- Cursor skip / advance / UIDVALIDITY restart / unparseable UID behavior as above.
- Multi-field validation failures queue a draft; owner corrections (not the draft) become the ImportBatch; queue row is removed.
- Exactly one Account match imports; zero/many leave unresolved; Accounts without `accountNumber` never match.
- Matched alert → one `source: "email"` batch and one Imported Transaction; closing balance fields stay null.
- Unique `(mailbox, messageUid)` / Owner-scoped equivalent prevents double queue rows; racing polls produce one outcome.
- Settings save validates required fields; blank password/API key keeps saved secrets; cloud requires a signed-in Owner.
- Postgres isolation tests cover ImportBatch, queue, cursor, and credentials across Owners.
- Repository encrypts IMAP fields on set and decrypts on get; legacy plaintext rows still read.

## Known gap

Automatic startup of the local poll process is not built.

## Decision record

See `docs/adr/0009-email-alert-sync-calls-llm-server-side.md`, `docs/adr/0010-import-batch-gets-a-postgres-port-for-cloud-email-sync.md`, `docs/adr/0012-imap-credentials-encrypted-at-rest-with-app-layer-key.md`, and `docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md`.
