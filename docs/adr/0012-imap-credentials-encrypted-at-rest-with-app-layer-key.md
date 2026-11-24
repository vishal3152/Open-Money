---
status: accepted
---

# Cloud IMAP credentials are encrypted at rest

## Context

Email alert sync stores per-Owner IMAP settings in Postgres (`email_sync_settings`). Isolation was only app-layer `ownerId` filtering (ADR-0006). IMAP username and password should be encrypted at rest and decrypted only on the server when needed.

## Decision

Encrypt `imap_user` and `imap_password` with AES-256-GCM (`src/domain/secret-cipher.ts`), keyed by `EMAIL_SYNC_ENCRYPTION_KEY` (`src/config/email-sync-encryption-key.ts`). The key comes from the environment, not from the database.

Columns stay `text`. `PgEmailSyncSettingsRepository` encrypts on write and decrypts on read so callers still see plaintext `EmailSyncCredentials`. Encryption runs only in that Node repository; the settings UI never receives the secret values (only `hasImapPassword`).

Stored values use a `v1:` envelope (`base64(iv|authTag|ciphertext)`). Values without the prefix are treated as legacy plaintext and returned as-is, then re-encrypted on the next save. That keeps the cron job’s `listAllEmailSyncCredentials` from failing the whole run on one unmigrated row.

The LLM API key remains plaintext; this change covers IMAP credentials only.

## Alternatives considered

- Key derived from data in the same database — an attacker with DB read access could decrypt everything.
- Managed KMS with rotation — heavier than the current single-env-var deployment; revisit if rotation or multi-region is required.
- Hash like MCP tokens (ADR-0011) — IMAP passwords must be recovered to log in to the mailbox; hashing is not enough.
- Separate encrypted columns — no behavior gain over encrypting the existing `text` fields in place.

## Consequences

- Cloud mode needs `EMAIL_SYNC_ENCRYPTION_KEY` (32 random bytes, base64 — `openssl rand -base64 32`) before Owners can save email sync settings or the cron can read them.
- Losing the key makes stored IMAP credentials unrecoverable; Owners must re-enter them. There is no recovery key.
- `llm_api_key` stays plaintext under app-layer Owner filtering only. Encrypting it would be a separate decision.
