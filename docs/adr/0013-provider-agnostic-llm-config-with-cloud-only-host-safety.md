---
status: accepted
---

# Provider-agnostic LLM config, with cloud-only host safety

## Context

ADR-0009 introduced a server-side LLM call for email alert sync, hardcoded to OpenRouter. Operators need any OpenAI-compatible chat-completions host (OpenRouter, OpenAI, local Ollama) so alert text can stay on a machine they control.

## Decision

Replace the OpenRouter-only client with `src/email-sync/llm-client.ts` (`createLlmCaller`), configured by:

| Setting | Role |
| --- | --- |
| `llmBaseUrl` | Full chat-completions URL (trailing slash stripped; no path appended) |
| `llmApiKey` | Optional; omit `Authorization` when blank |
| `llmModel` | Required; no universal default once the host varies |

Storage uses those fields on both tiers (local `settings.json` and Postgres `email_sync_settings`). A migration backfills from the old OpenRouter columns, then drops them. `llm_api_key` stays plaintext at rest (out of ADR-0012’s IMAP-only scope).

### Host safety

IMAP host checks block localhost and private addresses on **both** tiers.

LLM host checks reuse the same block list but run **only in cloud mode**:

- Cloud: the server fetches on shared infrastructure; a private `llmBaseUrl` is an SSRF risk. Save and poll paths pass `enforceHostSafety: true`.
- Local / self-hosted: the check is skipped so Ollama on `localhost` works.

Both tiers still validate that the URL is non-empty, parseable, and `http`/`https` at save time.

`createLlmCaller` caches the resolved host check once per caller instance (one poll can call the LLM many times). A new caller is built per Owner per cron run, or per on-demand / local tick.

Resolved DNS is not pinned onto `fetch` the way IMAP connections are; a small DNS-rebinding window remains in cloud mode. Hostname, literal-IP, and resolved-address checks still run.

### Error handling

Malformed LLM JSON (common when a host ignores structured-output mode) raises `InvalidEmailAlertError` so one bad message is marked invalid instead of aborting the whole poll.

## Alternatives considered

- Same SSRF policy as IMAP on both tiers — would block local Ollama, the main reason for configurable hosts.
- No LLM host check at all — leaves cloud SSRF open.
- Custom `fetch` dispatcher to pin the resolved address — deferred relative to residual risk.
- Keep reading the old `openRouterApiKey` field in application code — rejected in favor of a one-time SQL backfill and a clean rename.

## Consequences

- Cloud email sync cannot reach an Owner’s home-network Ollama; the URL must be publicly reachable from the host.
- `llm-client.ts` is unit-tested with an injectable `fetch` because URL handling, optional auth, and error wrapping need coverage without a live network.
