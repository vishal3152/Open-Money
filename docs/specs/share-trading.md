# Share Trading

## Purpose

Track shares held in different companies at a broker, without treating share ownership as an Account’s single money balance.

## Behavior

- A ShareTradingAccount belongs to one Institution and is denominated in one currency.
- It is top-level: not linked to any cash Account (unlike a FixedDeposit’s linked payout Account).
- It records a Buy or Sell StockTransaction per trade: scrip/symbol code, quantity, price per unit, date, description.
- Holdings — net quantity per scrip/symbol code — are computed from StockTransactions (Buy adds, Sell subtracts), the same way an Account’s balance is computed from its Transactions rather than stored.
- A company with a fully exited position stays listed at zero quantity rather than being dropped from Holdings.
- Stock trades can also be imported via the owner’s AI assistant over MCP (same architecture as `docs/specs/import.md`). Five tools mirror the Account-side list/create/resolve/stage/commit tools:
  - `list_share_trading_accounts`
  - `create_share_trading_account`
  - `resolve_share_trading_account`
  - `stage_stock_import`
  - `commit_stock_import`
  - Line items are StockTransaction-shaped (scrip/symbol code, Buy/Sell, quantity, price per unit, date, description) instead of a single signed amount.
  - `resolve_share_trading_account` reuses `resolveAccountByNumberSuffix` (`src/domain/account-number-match.ts`) unchanged.
  - `create_share_trading_account` requires owner `confirmed: true` and the same ≥4-digit account-number / last-4 reuse rules as `create_account`.
  - Email alert sync for broker trade-confirmation emails is deferred. Broker confirmations are less uniform than bank debit/credit alerts and are often PDF attachments.
- `commit_stock_import` creates one `StockImportBatch` and its `Imported` StockTransactions, matching `commit_import` for `ImportBatch`/Transaction (`docs/specs/import.md`), including optional retry-safe `idempotencyKey`.
  - It always writes. A line that matches an existing StockTransaction (by `externalRef` when both have one, else by the natural key) is still created, with the match stored as `possibleDuplicateOfTransactionId` (Suspected Duplicate — same accept-and-flag behavior as `docs/specs/import.md` / `docs/adr/0014-duplicate-imports-flagged-and-gated-at-confirm-not-blocked-at-commit.md`).
  - `StockImportBatch` is a separate entity from `ImportBatch`. A stock trade has no closing-balance concept, so `confirmAll` has no BalanceSnapshot / Reconciliation branch.
- Imported StockTransactions count toward Holdings immediately, the same way an Imported Transaction counts toward an Account’s computed balance before confirm. Trust status is a review marker, not a gate on whether a trade counts.

## Invariants

- Quantity and price-per-unit are safe integers (quantity: whole shares; price: minor currency units).
- A ShareTradingAccount references an existing Institution.
- A StockTransaction references an existing ShareTradingAccount.
- A Sell is not validated against currently held quantity. An Account’s computed balance is never checked against a minimum either — partial history can make a legitimate Sell look like an oversell. Negative or zero net quantity is valid and stays visible (`src/domain/holdings.ts`).
- Deleting an Institution is blocked while it still has a ShareTradingAccount (`InstitutionRepository` / `PgInstitutionRepository` dependent-count guard).
- Domain Holdings computation stays independent of the database and web framework.
- `commit_stock_import` / `stage_stock_import` require an existing `shareTradingAccountId`; an unknown id is rejected before any write.
- `commit_stock_import` requires at least one line item; an empty batch is rejected (`EmptyStockImportBatchError`).
- Stock import quantity and price are decimal strings, never pre-scaled integers from the assistant. Quantity is a positive whole number (`parseWholeShareQuantity`); price is parsed against the ShareTradingAccount’s currency (`parseDecimalToMinorUnits`), same untrusted-caller convention as `docs/specs/import.md`.
- Every StockTransaction from `commit_stock_import` has `trustStatus: "Imported"` and a non-null `importBatchId`. A manually entered StockTransaction (via `/share-trading-accounts/[id]/stock-transactions/new`) is always `Confirmed` with a null `importBatchId`.
- Duplicate matching for `stage_stock_import` (advisory) and `commit_stock_import` (persisted):
  - Key: `(shareTradingAccountId, occurredAt, scripCode, type, quantity, pricePerUnitMinor)` when neither side has `externalRef`.
  - When both have non-null `externalRef`, that match wins.
  - Neither blocks `commit_stock_import` — it always writes.
  - When more than one existing StockTransaction matches, the earliest wins (manual rows outrank imported ones; among imports, the earlier `StockImportBatch` wins), same as the Account side.
- `StockImportBatchRepository.confirmAll()` refuses (`StockImportBatchHasUnresolvedDuplicatesError`) if any batch StockTransaction still has a non-null `possibleDuplicateOfTransactionId`; otherwise flips every batch StockTransaction to `Confirmed`. Throws if the batch is already confirmed. `delete()` throws if confirmed; otherwise removes its StockTransactions and the batch row.
- `StockTransactionRepository.dismissSuspectedDuplicate(id)` clears `possibleDuplicateOfTransactionId` only — no `trustStatus` guard, mirroring `TransactionRepository.dismissSuspectedDuplicate()`.

## Persistence requirements

Persistence must support creating, retrieving, listing, updating, and deleting ShareTradingAccounts, and creating, retrieving, listing, updating, and deleting StockTransactions by ShareTradingAccount. Both are implemented for SQLite and Postgres (`src/db/repositories/`, `src/db/postgres/repositories/`), wired into `src/db/repository-factory.ts`.

- `ShareTradingAccountRepositoryPort.update()` throws `ShareTradingAccountNotFoundError` for an unknown id (same pattern as `AccountRepositoryPort.update()` / `AccountNotFoundError`).
- `getDependentCounts()` / `delete()` guard against deleting a ShareTradingAccount that still has StockTransactions or StockImportBatches (`EntityHasDependentsError`, listing counts by name). Do not rely on `stock_transactions.share_trading_account_id`’s DB-level `ON DELETE CASCADE` (same reasoning as `AccountRepository.delete()` for `transactions.account_id`).
- `StockTransactionRepositoryPort.update()` / `delete()` have no editability gate (see HTTP and UI contract). `update()` throws `StockTransactionNotFoundError` for an unknown id; `delete()` on an unknown id is a no-op.
- Every Postgres repository method scopes by `(id, ownerId)` (`docs/adr/0006-drop-rls-for-app-layer-owner-filtering.md`).
- `StockImportBatchRepository` / `PgStockImportBatchRepository` (`StockImportBatchRepositoryPort`):
  - `create(batch, lineItems)` atomically writes one `StockImportBatch` and its `Imported` StockTransactions, including Suspected Duplicate matches before write (same pattern as `ImportBatchRepository.create()`).
  - `getById` / `listAll`; `confirmAll(id)`; `delete(id)`.
- `stock_import_batches` columns: `id`, `shareTradingAccountId` (FK `restrict`), `source`, `createdAt`, `confirmedAt`. No closing-balance / BalanceSnapshot / Reconciliation columns.
- `stock_transactions.external_ref` (nullable text) and `stock_transactions.possible_duplicate_of_transaction_id` (nullable self-FK, `on delete set null`) match their `transactions` counterparts (`docs/specs/import.md`).
- `stock_transactions.trustStatus` / `importBatchId` were added via additive migration after the base table shipped (SQLite: `drizzle/0012_spooky_tomorrow_man.sql`, hand-corrected because drizzle-kit’s auto-generated rebuild tried to copy the new columns from the old table before they existed; Postgres: `postgres/migrations/20260911140000_stock_import_batches.sql`, same bootstrap-order pattern as `transactions.import_batch_id`).
- The SQLite `importBatchId` FK’s live constraint is `NO ACTION`, not the schema’s declared `cascade` — `ALTER TABLE ADD COLUMN` cannot carry that action into SQLite’s FK list, same as `transactions.import_batch_id` (`docs/CODEMAP.md`). Harmless because `StockImportBatchRepository.delete()` deletes a batch’s StockTransactions explicitly before the batch row.

## HTTP and UI contract

Server Actions only — no `/api` JSON routes (`docs/adr/0002-server-actions-not-rest-api.md`).

- `/share-trading-accounts/new` — create a ShareTradingAccount (Institution, account name, optional account number, free-text ISO currency code). Same form conventions as `/accounts/new`. `currencyCode` is not editable after creation.
- `/share-trading-accounts/[id]` — Holdings (scrip/symbol code and net quantity, including zero-quantity positions) and the StockTransaction ledger in chronological order, with an “Add stock transaction” action.
- `/share-trading-accounts/[id]/stock-transactions/new` — record Buy or Sell trades:
  - Buy/Sell Type selector
  - Scrip/symbol code (normalized to uppercase server-side so casing cannot split one company’s Holdings into two rows)
  - Unsigned decimal quantity (whole shares only) and price per unit
  - Full date+time, description
  - Mobile keeps the single-trade form. Desktop provides a multi-row table with add/remove controls and saves all complete rows atomically.
  - Entirely blank rows are skipped. Any partially filled invalid row rejects the batch and preserves entered values.
- `/share-trading-accounts/[id]/stock-transactions/[stockTransactionId]/edit` — edit fields (same form as `new`, prefilled).
- `/share-trading-accounts/[id]/stock-transactions/[stockTransactionId]/delete` — confirm-and-delete, linked from the edit page’s danger zone.
  - Unlike Transaction, a StockTransaction has no Transfer/Adjustment linkage, so there is no editability gate: both Confirmed and Imported rows are editable/deletable. No `assertEditable()` or `returnTo` (nothing links here but the ledger).
- Listed under each Institution on `/` and `/institutions/[id]`, alongside Accounts and FixedDeposits.
- `/share-trading-accounts/[id]/edit` — rename / change account number (`currencyCode` stays fixed), matching `/accounts/[id]/edit`.
- `/share-trading-accounts/[id]/delete` — dependency-gated delete (blocked while it still has StockTransactions or StockImportBatches, listed by name), matching `/accounts/[id]/delete`. Holdings are summed StockTransactions, so renaming or deleting an empty ShareTradingAccount does not touch FixedDeposit-style immutable-principal math (`docs/adr/0003-fixed-deposit-maturity-inside-transfer-creation.md` does not apply here).
- No BalanceSnapshot / Reconciliation equivalent — there is no bank-reported figure to compare a computed share position against in this pass.
- MCP endpoint is the existing Next.js server, same trust boundary as Account-side tools in `docs/specs/import.md` (loopback-only local mode; bearer-token cloud mode). The stock tools register on the same `McpServer` instance, not a separate endpoint.
- `/stock-imports/[id]` — per-batch review, mirroring `/imports/[id]` (`docs/specs/import.md`):
  - Flagged line: “Suspected duplicate” badge, “View possible original” link, “Not a duplicate — keep it” action (`dismiss-duplicate-actions.ts`) that clears the flag in place.
  - “Confirm All” is disabled with inline text naming how many flagged rows remain while any are unresolved.

Money fields (price per unit) take a decimal string, converted server-side to integer minor units via `getMinorUnitExponent` against the ShareTradingAccount’s currency. Quantity uses decimal-shaped input (`<DecimalInput>`, per `docs/agents/mobile-ux.md`) but is validated server-side as a positive whole number — fractional shares are out of scope.

## Out of scope for this pass

- Cash-leg bookkeeping — a Buy/Sell does not debit/credit any cash Account. Share trades are a standalone ledger, the same way manually entered Transactions in `docs/specs/transactions.md` do not require a matching bank feed.
- Cost basis / realized gain tracking — Holdings report net quantity only, not money invested or profit/loss. Average cost vs FIFO is deferred.
- Market valuation — no price feed exists (`docs/adr/0001-transfer-as-single-entity-with-realized-fx-rate.md` makes the same call for FX). A Holding’s value is never priced at a current market rate.
- Email alert sync for broker trade-confirmation emails — MCP import only this pass; not assumed to extend the same way later.

## Acceptance criteria

- An unknown Institution cannot be used to create a ShareTradingAccount.
- An unknown ShareTradingAccount cannot be used to create a StockTransaction.
- Holdings sum Buy/Sell quantity per scrip/symbol code exactly, across multiple companies on one ShareTradingAccount.
- A fully exited company’s Holding remains listed at zero rather than disappearing.
- Deleting an Institution is rejected while it still has a ShareTradingAccount.
- `resolve_share_trading_account` with exactly one matching ShareTradingAccount (last-4 + institution name) returns it and creates nothing. No match returns `status: "unresolved"` and creates nothing. If that same number/institution matches an Account instead, nothing is created and the result is `status: "wrong-account-type"` (call `resolve_account`). More than one match creates nothing and returns every candidate (`status: "ambiguous"`).
- `create_share_trading_account` without `confirmed: true` writes nothing; with confirmation it creates (or reuses a same-Institution last-4 match) the same way `create_account` does.
- `stage_stock_import` against a ShareTradingAccount with a matching existing StockTransaction (same account, date, scrip code, type, quantity, price) flags it as a likely duplicate without altering any data.
- `commit_stock_import` with an unknown `shareTradingAccountId`, an empty line-item list, a non-positive/fractional quantity, or a price that does not parse for the account’s currency writes nothing.
- A successful `commit_stock_import` creates exactly one unconfirmed `StockImportBatch` and its `Imported` StockTransactions (each with `importBatchId` set).
- `confirmAll` flips every StockTransaction in the batch to `Confirmed` and creates no BalanceSnapshot / Reconciliation. `confirmAll` / `delete` on an already-confirmed batch throw without side effects.
- `commit_stock_import` against a matching existing StockTransaction still creates the new row (never rejects or skips a line), with `possibleDuplicateOfTransactionId` set to the existing one’s id.
- `commit_stock_import` with a line whose `externalRef` matches an existing StockTransaction’s `externalRef` sets `possibleDuplicateOfTransactionId` to that StockTransaction, even when the date differs.
- `confirmAll` on a batch with any StockTransaction still carrying a non-null `possibleDuplicateOfTransactionId` throws `StockImportBatchHasUnresolvedDuplicatesError` and writes nothing.
- `dismissSuspectedDuplicate` clears a StockTransaction’s `possibleDuplicateOfTransactionId` without changing any other field, after which `confirmAll` no longer refuses on that ShareTradingAccount.

## Decision record

See `docs/adr/0014-duplicate-imports-flagged-and-gated-at-confirm-not-blocked-at-commit.md` for the Suspected Duplicate design, which applies identically here.
