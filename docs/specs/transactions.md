# Transactions

## Purpose

Maintain the Account ledger from which balances are independently computed.

## Behavior

- A Transaction is a recorded event that changes one Account’s balance.
- Amounts are signed integer minor units.
- Each Transaction is either `Confirmed` or `Imported`.
- Valid timestamps are normalized to UTC.
- Transactions for an Account are read in chronological order, with stable ordering when timestamps match.
- An Account-side Transfer leg appears in this ledger as a Transaction linked to its Transfer.
- A manually entered Transaction carries a Category from a fixed list determined by Income or Expense:
  - Expense: Grocery, Dining, Education, Transport, Utilities, Rent, Health, Entertainment, Other
  - Income: Salary, Interest, Gift, Other Income
- Transfer-generated and Adjustment Transactions have no Category. They are not user-picked income/expense events.

## Invariants

- Transaction amounts and balance totals remain safe integers.
- A Transaction references an existing Account.
- `Confirmed` means entered or reviewed by the owner. `Imported` means imported and not yet reviewed.
- Transfer-generated Transactions remain projections of their Transfer, not independently editable transfer records.
- A Transaction that is an Adjustment’s own Confirmed Transaction is not independently editable. It corrects a specific Discrepancy and must stay traceable to it.
- A manually entered Transaction (not Transfer-linked, not an Adjustment) may be edited or deleted directly. It has no other entity of record to fix it through.
- A Transaction’s Category, when present, must belong to its Income/Expense kind’s fixed list.

## Persistence requirements

Persistence must support creating one or many Transactions atomically, listing them by Account, and fetching one by id.

- A Transaction may be updated (amount, description, Category, `occurredAt`) or deleted only when it is `Imported` (pre-confirmation review) or `Confirmed` with no `transferId` and no Adjustment referencing it.
- Anything else (a Transfer-linked or Adjustment-linked Confirmed row) is rejected (`TransactionNotEditableError`).
- Transfer linkage is nullable because ordinary deposits, withdrawals, interest credits, and fees do not belong to a Transfer.
- Category is nullable for the same reason it is absent on Transfer/Adjustment rows.

## HTTP and UI contract

Server Actions only.

- `/accounts/[id]/transactions/new` — record Transactions against that Account:
  - Income/Expense Type selector
  - Unsigned decimal Amount (the selector determines the persisted sign)
  - Category selector whose options follow the chosen Type
  - Full date+time (`occurredAt`)
  - Description
  - Mobile keeps the single-Transaction form. Desktop provides a multi-row table with add/remove controls and saves all complete rows atomically.
  - Entirely blank rows are skipped. Any partially filled invalid row rejects the batch and preserves entered values.
  - No trust-status picker. Manually entered Transactions are always `Confirmed`. `Imported` rows come from statement / email import (`docs/specs/import.md`, `docs/specs/email-alert-sync.md`), not from this screen.
- The ledger on `/accounts/[id]` lists Transactions chronologically, shows trust status and Category (when present), and distinguishes three kinds of row:
  - Ordinary Transaction — `Edit` link (manually entered)
  - Transfer-linked projection — links to its Transfer; no Edit/Delete
  - Adjustment — links to the Discrepancy it corrects; no Edit/Delete
- `/accounts/[id]/transactions/[transactionId]/edit` — edits a manually entered Transaction’s Type / Category / Amount / description / date (same fields and validation as `new`, reusing `TransactionForm`). 404s for a Transfer-linked or Adjustment-linked Transaction, or one belonging to a different Account. Includes a `Delete Transaction` danger-zone link (Transaction has no separate detail screen).
- `/accounts/[id]/transactions/[transactionId]/delete` — delete confirmation for a manually entered Transaction; 404s under the same conditions as `edit`.

Amounts are decimal-string input converted to integer minor units server-side. Timestamps use a full date+time picker matching `occurredAt`’s precision. Ordering depends on the real time entered, not an arbitrary default.

## Acceptance criteria

- Listing one Account’s Transactions returns only that Account’s ledger in deterministic chronological order.
- Invalid or overflowing minor-unit values are rejected.
- Balance computation includes ordinary and Transfer-generated Transactions uniformly.
