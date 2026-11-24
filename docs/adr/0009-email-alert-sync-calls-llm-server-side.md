# Email alert sync calls an LLM on the server

## Context

MCP statement import (`docs/specs/import.md`) never parses files inside Open Money. The user’s AI assistant reads the statement and Open Money only accepts structured rows, so Open Money does not pay for that LLM usage.

Email alert sync (`docs/specs/email-alert-sync.md`) has no interactive assistant. Alerts arrive on a schedule, so Open Money must structure each message itself.

## Decision

For email alert sync only, Open Money calls an LLM from the server using the Owner’s configured endpoint and credentials. This is a second import path that still produces `ImportBatch` / `Imported` Transaction rows and keeps the same untrusted-input rules as MCP import (server-side decimal parsing, no LLM-chosen Account, advisory duplicate flags).

MCP import is unchanged: `stage_import` / `commit_import` still expect the assistant to have parsed the file.

## Alternatives considered

- Forward each alert into an AI assistant by hand — rejects the unattended sync goal.
- Hand-written per-bank parsers with no LLM — brittle across banks and wording changes; short alerts make LLM cost acceptable.

## Consequences

- Email sync depends on a reachable LLM endpoint (local Ollama or a hosted API).
- MCP import remains assistant-driven and does not share this LLM call path.
