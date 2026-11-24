# Duplicate imports are flagged and gated at confirm, not blocked at commit

## Context

`commit_import` / `commit_stock_import` already computed an advisory duplicate check in `stage_import` / `stage_stock_import`, but discarded it. Nothing downstream consulted it, so re-running an MCP import against an already-imported statement silently created a second set of Transactions.

Blocking `commit_import` itself (reject the call, require `confirmDuplicates: true` to retry) is unreliable: the calling AI assistant has no guaranteed memory of a prior staging call or duplicate warning across sessions.

## Decision

Commit stays permissive — it always writes — and persists the match as a Suspected Duplicate flag (a nullable self-referencing FK) on the created Transaction / StockTransaction.

The gate moves to where the owner already reviews an import: `ImportBatchRepository.confirmAll()` / `StockImportBatchRepository.confirmAll()` refuse while any Transaction in the batch still carries an unresolved Suspected Duplicate. That extends the existing single “Confirm All” CTA on `/imports/[id]` rather than adding a second, MCP-only confirmation path.

When a re-import matches more than one existing record, flag against the earliest match so the flag keeps pointing at the presumed original even after a later duplicate in the chain is dismissed or removed.

## Alternatives considered

- Reject the whole `commit_import` call and require `confirmDuplicates: true` to retry — rejected: the caller is an AI assistant across an MCP session boundary with no guaranteed memory of a prior staging call or duplicate warning. A blocking contract there is unreliable and disconnected from the app’s one owner-facing review screen.
- Extend `trustStatus` with a third value (for example `FlaggedDuplicate`) — rejected: `trustStatus` already has binary-assumption consumers (`TransactionRepository.assertEditable`, ledger badge rendering, i18n keys) whose semantics are about review/trust, not duplicate suspicion. A separate nullable FK is additive and leaves `trustStatus` untouched.
- Flag against the most recent match when several exist — rejected in favor of the earliest match (see Decision).

## Consequences

- `commit_import` still never rejects or skips a line for looking like a duplicate; `confirmAll` is where unresolved Suspected Duplicate flags block.
- Specs for import and stock import describe the flag, earliest-match tie-break, and confirm precondition (`docs/specs/import.md`, `docs/specs/share-trading.md`).
