# Accounts

## Purpose

Record where money is held and compare each Account’s independently computed balance with dated bank-reported balances.

## Behavior

- An Institution is the financial company that holds an Account or FixedDeposit.
- An Account belongs to one Institution and is denominated in one currency.
- An Account’s balance is computed from its Transactions. It is not a mutable stored balance.
- A BalanceSnapshot records what the Institution reported for an Account on a specific date.
- Balance computation for a BalanceSnapshot includes Transactions through the end of that date in UTC.

## Invariants

- Money is represented as safe integer minor units.
- An Account references an existing Institution.
- A BalanceSnapshot references an existing Account.
- Deleting an Account must not leave its BalanceSnapshots behind.
- Domain balance computation stays independent of the database and web framework.
- Hard-deleting an Account (a separate advanced action from ordinary delete) cascades through its Transactions, Reconciliations, Discrepancies, and Adjustments, and through any Transfer that touches it (removing the whole Transfer and both linked Transactions).
  - A linked FixedDeposit blocks hard-delete entirely. Hard-delete never cascades through a FixedDeposit.
  - If the other side’s Account has already reconciled a period covering the Transfer, that blocks the whole hard-delete instead of removing the Transfer.

## Persistence requirements

Persistence must support creating, retrieving, and listing Institutions, Accounts, and BalanceSnapshots. Account deletion behavior for dependent financial history must stay explicit. Column details belong in `src/db/schema.ts` and repository tests.

## HTTP and UI contract

Server Actions only — no `/api` JSON routes (`docs/adr/0002-server-actions-not-rest-api.md`).

- Institution and Account each support edit and delete.
- An Account’s `currencyCode` is fixed after creation (BalanceSnapshots, Transactions, and any linked FixedDeposit assume it). Only name and account number are editable.
- `/institutions/new` — create an Institution (name).
- `/institutions/[id]` — that Institution’s Accounts and FixedDeposits.
- `/institutions/[id]/edit` — edit an Institution’s name.
- `/accounts/new` — create an Account (Institution, name, optional account number, free-text ISO currency code).
- `/accounts/[id]` — computed balance, Transaction ledger, and BalanceSnapshot / Reconciliation history. Computed balance is always shown separately from the most recent bank-reported BalanceSnapshot, never merged into one figure.
- `/accounts/[id]/edit` — edit name and account number.
- BalanceSnapshot has no standalone creation screen. It is captured only as part of running a Reconciliation (`docs/specs/reconciliation.md`).

Money fields take a decimal string (for example `"1234.56"`), converted server-side to integer minor units via `getMinorUnitExponent`. Currency fields are free-text ISO codes, format-validated only — no fixed dropdown.

## Acceptance criteria

- Transactions compose into the Account’s computed balance without a stored-balance update.
- Date-bounded computation excludes later Transactions.
- An unknown Institution cannot be used to create an Account.
- An unknown Account cannot be used to create a BalanceSnapshot.
