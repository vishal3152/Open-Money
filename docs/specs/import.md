# Statement import (MCP)

## Purpose

Import CSV/PDF bank or brokerage statement data into one Account through the user’s own AI assistant (Claude Desktop, Cursor, and similar). Open Money does not OCR or parse the file and does not pay for those LLM calls.

## Behavior

- Open Money exposes an MCP HTTP endpoint at `/api/mcp` on the same Next.js server in every mode (`src/app/api/mcp/route.ts`).
  - **Local / desktop:** loopback only (`isLoopbackHost()`), no auth.
  - **Cloud:** static per-Owner bearer token (`docs/adr/0011-mcp-cloud-auth-static-bearer-token.md`). Generate the token in Settings; the client sends `Authorization: Bearer <token>`. Missing or wrong tokens return 401.
- A public OAuth-protected endpoint for clients that cannot send a static header (for example ChatGPT) is proposed in `docs/adr/0008-mcp-endpoint-adds-scoped-oauth-for-remote-clients.md` and is not built yet.
- The assistant reads and interprets the statement client-side. Open Money never receives raw file bytes.
- Account-side tools: `list_institutions`, `create_institution`, `list_accounts`, `search_transactions`, `create_account`, `resolve_account`, `stage_import`, `commit_import`. Share-trading tools (including `create_share_trading_account`) are documented in `docs/specs/share-trading.md`.
- `list_accounts` returns Institution, currency, and `accountNumber` (when set) so the assistant can confirm the target Account, including when the statement shows a masked number.
- `stage_import` / `commit_import` take a plain `accountId`. They do not match accounts themselves; the assistant and user resolve identity in conversation.
- `search_transactions` is read-only, newest first, with optional Account, inclusive date range, description, category, and credit/debit filters. Results include amount, currency, Account, and Institution. At most 100 rows per response, with `total` / `truncated`.
- `create_institution` / `create_account` require `confirmed: true` after the user agrees in conversation; otherwise they reject with `OwnerConfirmationRequiredError`.
  - `create_institution` reuses an existing same-named Institution (case-insensitive).
  - `create_account` needs an existing `institutionId` and an `accountNumber` with at least four digits. It reuses a same-Institution last-4 match (`created: false`) and rejects when a ShareTradingAccount already claims that number.
- `resolve_account` matches a statement’s masked account number and institution name deterministically via `src/domain/account-number-match.ts`: last four digits (non-digits stripped) plus case-insensitive exact institution name — never fuzzy matching.
  - Exactly one Account → return it.
  - None → `status: "unresolved"` (assistant asks the user, or creates after confirmation).
  - Several → `status: "ambiguous"` with every candidate.
  - Same claim matches a ShareTradingAccount → `status: "wrong-account-type"`; use `resolve_share_trading_account` instead.
- `stage_import` validates proposed line items (date, signed decimal amount, description, optional category / `externalRef`), optional opening and closing balances with as-of dates, flags likely duplicates, and returns a preview that names Account, Institution, and currency as structured fields.
  - Empty Account with non-zero opening balance/date → preview includes a separate `openingBalanceLine`.
  - Non-empty Account → opening is ignored (`openingBalanceLine: null`).
- `commit_import` writes one `ImportBatch` and its `Imported` Transactions using the same validation as manual entry (`src/domain/decimal-input.ts`, `assertValidCategoryForKind`). It always writes; duplicates are flagged, not rejected (`docs/adr/0014-duplicate-imports-flagged-and-gated-at-confirm-not-blocked-at-commit.md`).
  - Duplicate match: `externalRef` when both sides have one; otherwise `(occurredAt calendar date, amountMinor)`. The flag points at the earliest match (`possibleDuplicateOfTransactionId`).
  - Opening balance follows the same empty/non-empty rules as `stage_import`.
  - Closing balance/date are stored on the batch; they do not create a `BalanceSnapshot` / Reconciliation yet.
  - Optional `idempotencyKey` returns an existing batch on retry instead of writing a second one.
- Imports never create a `Transfer`, even when a line looks like a move between the user’s own Accounts (`docs/adr/0004-mcp-import-produces-transactions-not-transfers.md`).
- Every imported Transaction belongs to exactly one `ImportBatch`.
- On `/imports/[id]`, the user can edit or delete unconfirmed lines. Suspected duplicates show the possible original and a “Not a duplicate — keep it” action that clears the flag only (editing other fields does not clear it).
- **Confirm All** sets remaining Transactions to `Confirmed`. If the batch has a stashed closing balance, it then creates the `BalanceSnapshot` and runs Reconciliation. It refuses (`ImportBatchHasUnresolvedDuplicatesError`) while any Suspected Duplicate flag remains.
- **Undo** before confirm: `ImportBatchRepository.delete()` removes the unconfirmed batch and its Transactions.
- **Undo** after confirm: `ImportBatchRepository.undoConfirmed()` reverses the batch’s Transactions and any Snapshot / Reconciliation / unresolved Discrepancy it created. It refuses (`ImportBatchUndoBlockedError`) if an Adjustment resolved that Discrepancy or a later Reconciliation exists for the Account.

## Invariants

- `resolve_account` matches last four digits (non-digits stripped) and case-insensitive exact institution name; fewer than four digits is rejected before lookup.
- `resolve_account` never creates Accounts or Institutions. Zero matches → `unresolved`; many matches → `ambiguous`.
- Optional `accountName` / `currencyCode` on `resolve_account` are ignored (kept for older clients).
- `create_institution` / `create_account` require `confirmed: true`.
- `create_institution` returns an existing case-insensitive name match with `created: false`.
- `create_account` requires an existing `institutionId` and ≥4-digit `accountNumber`; unknown id, bad currency, or short number is rejected.
- `create_account` returns an existing same-Institution last-4 match with `created: false` (or rejects if more than one matches).
- `commit_import` requires a known `accountId` and at least one line item.
- Every Transaction from `commit_import` has `trustStatus: "Imported"` and a non-null `importBatchId`.
- Neither `stage_import` nor `commit_import` constructs a `Transfer`.
- Import amounts and closing/opening balances are decimal strings parsed server-side against the Account’s currency (`parseDecimalToMinorUnits`), never trusted as pre-scaled minor units from the assistant.
- Closing balance and as-of date must both be present or both absent. The same rule applies to opening balance and opening as-of date. Zero opening balance creates no synthetic line. On a non-empty Account, a valid opening pair is ignored.
- `stage_import` returns the synthetic opening line as `openingBalanceLine`, not inside `lineItems`, so echoing `lineItems` plus the opening pair into `commit_import` cannot double-book opening.
- Duplicate detection keys on `(accountId, occurredAt calendar date, amountMinor)` when neither side has `externalRef`. Description is excluded. When both have `externalRef`, that match wins.
- `stage_import` duplicate flags are advisory. `commit_import` always writes and may set `possibleDuplicateOfTransactionId`. The gate is `confirmAll`.
- When several Transactions match, the flag points at the earliest: manual rows outrank imported ones; among imports, the earlier batch wins.
- Duplicate primary keys in one `commit_import` call roll back the whole batch.
- `confirmAll` throws `ImportBatchHasUnresolvedDuplicatesError` if any batch Transaction still has `possibleDuplicateOfTransactionId`.
- `dismissSuspectedDuplicate` clears only that flag.
- `TransactionRepository.update` allows edits only while `trustStatus` is `Imported`.
- `ImportBatchRepository.delete` throws if `confirmedAt` is set.
- `confirmAll` throws if the batch is already confirmed.

## Persistence requirements

- `import_batches`: `id`, `accountId`, `createdAt`, `source`, nullable `closingBalanceMinor` / `asOfDate` / `confirmedAt` / `balanceSnapshotId` / `reconciliationId`.
- `transactions.import_batch_id`: nullable FK.
- `transactions.external_ref`: nullable statement reference.
- `transactions.possible_duplicate_of_transaction_id`: nullable self-FK (`on delete set null`).
- `ImportBatchRepository.create(batch, lineItems)` — one `db.transaction()`: look up Account (currency + existence), compute Suspected Duplicate matches, then write.
- `ImportBatchRepository.confirmAll(id)` — refuse on unresolved duplicates; flip trust status; if closing balance is set, call `BalanceSnapshotRepository.create` then `ReconciliationRepository.create` (same order as manual reconcile; not one atomic transaction).
- `ImportBatchRepository.delete(id)` — delete linked Transactions then the batch; refuse if confirmed.
- `getById` / `listAll` for review screens.
- `TransactionRepository.update` for Imported rows; `dismissSuspectedDuplicate` with no trust-status guard.

## HTTP and UI contract

- MCP endpoint: loopback in local/desktop; bearer token in cloud. No public route accepts an uploaded statement file.
- `/imports` — batches newest first, confirmed state visible.
- `/imports/[id]` — review: Account / Institution / currency, edit/remove lines while unconfirmed, Suspected Duplicate badge and dismiss action, Confirm All disabled while flags remain, Undo Import mutually exclusive with confirm. Edit/remove reuse generic Transaction routes with `?returnTo=/imports/[batchId]`. The ledger shows the same duplicate badge. `/stock-imports/[id]` mirrors this for stock imports.
- `/settings/mcp` — server URL, `mcp.json`, and (cloud) generate / regenerate / revoke token. Cloud routes require sign-in.

## Acceptance criteria

- `list_accounts` includes Institution, currency, and `accountNumber`.
- `search_transactions` applies filters, returns newest first with context and total count, and never returns another Owner’s rows in cloud mode.
- `create_institution` / `create_account` without `confirmed: true` write nothing; with confirmation they create or reuse as specified above; invalid inputs write nothing.
- `resolve_account` returns one match, `unresolved`, or `ambiguous` without creating rows; short suffixes are rejected.
- `stage_import` flags duplicates against existing same-account date+amount rows without writing.
- `commit_import` still writes duplicates with `possibleDuplicateOfTransactionId` set; `externalRef` matches win over date; later lines in the same call flag against earlier ones.
- `confirmAll` refuses while flags remain; `dismissSuspectedDuplicate` clears a flag so confirm can proceed.
- Invalid `accountId`, empty lines, bad decimal scale, or unpaired opening/closing fields write nothing.
- Empty Account + non-zero opening creates a synthetic Opening balance Transaction; non-empty Account ignores opening and still imports lines.
- Duplicate ids in one call write nothing.
- Successful `commit_import` creates one unconfirmed batch and its Imported Transactions; no Snapshot/Reconciliation until Confirm All.
- Unconfirmed review allows edit/delete; Confirmed rows reject this edit path.
- Confirm All flips trust status and, when a closing balance was stashed, creates Snapshot + Reconciliation once; repeat confirm/delete on confirmed batches throw.
- No import path constructs a Transfer.
- Cloud MCP without a valid bearer token returns 401; a valid token scopes tools to that Owner. Regenerating invalidates the previous token; revoke leaves none until generate again.

## Decision record

See `docs/adr/0004-mcp-import-produces-transactions-not-transfers.md`, `docs/adr/0011-mcp-cloud-auth-static-bearer-token.md`, and `docs/adr/0014-duplicate-imports-flagged-and-gated-at-confirm-not-blocked-at-commit.md`.
