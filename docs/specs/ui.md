# UI

## Purpose

Cross-cutting navigation, layout, and interaction conventions shared across the other feature specs. Per-entity routes and behavior live in `accounts.md`, `transactions.md`, `fixed-deposits.md`, `transfers.md`, `reconciliation.md`, and `share-trading.md`.

## Architecture

Next.js Server Actions and Server Components — no `/api` JSON routes (`docs/adr/0002-server-actions-not-rest-api.md`).

- Institution, Account, Transfer, ShareTradingAccount, and StockTransaction support edit and delete.
- A manually entered Transaction (not Transfer-linked, not an Adjustment) supports edit and delete directly.
- A Transfer-linked or Adjustment-linked Transaction must be corrected through the entity that owns it (edit/delete the Transfer; nothing edits an Adjustment).
- FixedDeposit supports neither edit nor delete (`docs/adr/0003-fixed-deposit-maturity-inside-transfer-creation.md`).

## Route map

```
/                                   — With zero Institutions: welcome state with one Add Institution
                                      action and noninteractive Institution → Account → Transactions
                                      guidance; no date, Add menu, Transfer, or Recent Transactions.
                                      Otherwise dashboard: per-currency balance cards, then Accounts
                                      grouped by currency with Institution, account, and current
                                      balance columns. FixedDeposits appear with their principal.
                                      Institution names link to Institution details; the rest of each
                                      row opens its Account or FixedDeposit. ShareTradingAccounts have
                                      a separate section by currency showing Holdings counts without
                                      implying an unsupported valuation. Each section’s Add Account
                                      opens the matching cash or share-trading create form. Recent
                                      Transactions show the six latest records. No cross-currency
                                      total or chart; no FX-conversion service or balance-history
                                      series (see docs/adr/0001). The + Add menu and Transfer action
                                      stay in the dashboard header. Transfer prerequisites appear on
                                      hover, focus, or tap instead of permanent dashboard space. The
                                      Accounts section links separately to Institution management;
                                      empty Institutions are not shown as Account rows.
/institutions                       — manage Institutions; names open their detail pages
/institutions/new
/institutions/[id]                  — Institution’s Accounts, FixedDeposits, and ShareTradingAccounts;
                                      same zero-balance-hiding toggle as the dashboard, scoped to
                                      this Institution’s Accounts
/institutions/[id]/edit             — rename
/institutions/[id]/delete           — confirmation; blocked while it still has Accounts / FixedDeposits /
                                      ShareTradingAccounts
/accounts/new
/accounts/[id]                      — computed balance, Account-only ledger entries, Transfers, and
                                      Reconciliation history
/accounts/[id]/edit                 — name / account number (currencyCode is not editable)
/accounts/[id]/delete               — confirmation; blocked while it still has Transactions,
                                      Reconciliations, or a linked FixedDeposit
/accounts/[id]/transactions/new
/accounts/[id]/transactions/[transactionId]/edit    — manually entered Transactions only; 404s for
                                                        Transfer-linked or Adjustment-linked
/accounts/[id]/transactions/[transactionId]/delete  — confirmation; same manual-only restriction
/accounts/[id]/reconcile            — capture a BalanceSnapshot and run its Reconciliation in one action
/fixed-deposits/new
/fixed-deposits/[id]                — current/original principal, rate, dates, status, linked Account,
                                      related Transfers, top-up / withdraw actions
/share-trading-accounts/new
/share-trading-accounts/[id]        — per-company Holdings (net quantity) and StockTransaction ledger
/share-trading-accounts/[id]/edit
/share-trading-accounts/[id]/delete — dependency-gated (StockTransactions / StockImportBatches)
/share-trading-accounts/[id]/stock-transactions/new
/share-trading-accounts/[id]/stock-transactions/[stockTransactionId]/edit
/share-trading-accounts/[id]/stock-transactions/[stockTransactionId]/delete
/transfers/new                      — one generic form for every leg combination, including FD
                                      open / maturity
/transfers/[id]                     — both legs, currencies, and the realized FX rate
/transfers/[id]/edit                — same form as /transfers/new; 404s for fixed-deposit-opening
/transfers/[id]/delete              — confirmation; always deletable, no dependent-count guard
/reconciliations/[id]               — reported vs computed balance, Discrepancy, resolution, linked
                                      Adjustment
/imports                            — statement / email ImportBatches
/imports/[id]                       — batch review (docs/specs/import.md)
/stock-imports                      — StockImportBatches
/stock-imports/[id]                 — stock batch review (docs/specs/share-trading.md)
/settings                           — SQLite database path (local: ~/.config/money-watch/); MCP setup link
/settings/mcp                       — Connect AI Assistant: MCP URL, token, copy-paste client config
```

## Form conventions

- **Money**: decimal string input (for example `"1234.56"`), converted server-side to integer minor units via `getMinorUnitExponent`. Interest rates follow the same pattern (percentage input, converted to integer basis points).
- **Currency**: free-text ISO code, format-validated (3 uppercase letters) only — no fixed dropdown.
- **Timestamps**: full date+time where the domain type is a full timestamp (`Transaction.occurredAt`); date-only where it is date-only (`BalanceSnapshot.asOfDate`).
- **Errors**: inline, field-level, via `useActionState`, wherever a thrown error maps to one field (for example `InvalidMinorUnitsError` → that amount field); a generic top-of-form banner otherwise (for example `DatabaseConstraintError` for an unknown referenced id). On validation failure, Server Actions return the submitted field values plus a `formKey` so the form remounts and restores inputs — React 19 otherwise clears the form when the action promise fulfills.
- **Contextual help**: action-level help for ambiguous domain actions (income/expense vs transfer, reconciliation/discrepancy, fixed-deposit top-up/withdrawal, destructive transfer deletion). Do not add tooltip noise to plain navigation.

## Localization

- **Languages**: English (source), Simplified Chinese, Modern Standard Arabic. The active language is a `pw-locale` cookie chosen in Settings — not a URL segment — so every existing route keeps its path.
- **Copy lives in `src/i18n/messages/`**, never inline in a component. The English catalog is the source of truth; `zh` / `ar` are typed against its key set, so an untranslated key cannot compile.
- **Server Actions return message keys** (`LocalizedText = { key, params? }`), not sentences. Validation stays language-agnostic; the component holding the translator renders the text. Same “errors are typed at the boundary” rule as Form conventions, applied to copy.
- **Arabic is right-to-left**: `<html dir>` follows the locale, and the stylesheet uses logical properties (`margin-inline-start`, `text-align: start`) so mirroring falls out of CSS. Only `transform`-based affordances (back chevron, collapse chevron, toggle thumb) need explicit `[dir="rtl"]` rules.
- **Money is not localized.** Amounts render as `1234.56 INR` in every language — integer minor units formatted by `format-money.ts`, Latin digits, currency code suffix. Locale-aware number/date formatting is out of scope; a per-Account currency is domain data, not a display preference.
- **Stored values stay English.** Enum values (`Confirmed`, `Buy`, category names) and written Transaction descriptions are data; only their labels are translated, via `trustStatus.*` / `category.*` / `stockTransactionType.*` keys.

## Out of scope for this pass

- FixedDeposit edit or delete (ADR-0003).
- Transfer-linked or Adjustment-linked Transaction edit/delete (corrected through the Transfer, or left untouched — see Architecture).
- Cross-currency net worth aggregation — would require an assumed market FX rate, which the domain model avoids (`docs/adr/0001-transfer-as-single-entity-with-realized-fx-rate.md`).
