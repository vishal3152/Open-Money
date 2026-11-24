# MCP import produces plain Transactions, never Transfers

## Context

The MCP statement importer (`docs/specs/import.md`) creates Transactions on the Account being imported. Statement lines can look like movements to another of the owner’s tracked Accounts. The MCP server never sees the source file — the AI assistant parses it client-side — so it cannot reliably confirm a beneficiary Account unless the assistant or owner names it. Most “transfer-looking” lines are not between the owner’s own tracked Accounts (rent, bills, transfers to other people).

## Decision

Import always records each leg as an independent Transaction. Never a Transfer.

Account balances stay correct either way: balance computation sums signed Transaction amounts per Account. What is lost is the Transfer entity’s structural link and realized FX rate. For a genuine internal movement, the owner can still use `/transfers/new`.

## Alternatives considered

- Cross-account matching after importing both sides (same amount, same date → merge into a Transfer) — rejected: fragile heuristic (FX timing, coincidental matches); not requested for v1.
- Assistant names a destination Account and `commit_import` builds a Transfer — rejected: that trusts an AI-supplied beneficiary for a structural, harder-to-undo entity. A wrong plain Transaction is a one-line fix or an `ImportBatch` undo; a wrong Transfer is two related entries to unwind.
