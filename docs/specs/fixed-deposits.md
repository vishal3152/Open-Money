# Fixed Deposits

## Purpose

Track term deposits without treating them as freely debitable Accounts.

## Behavior

- A FixedDeposit belongs to an Institution.
- It records a user-chosen name, original principal, current principal, currency, integer interest rate, opening date, maturity date, linked payout Account, and status.
- Lifecycle states: `Open`, `Matured`, `PrematurelyClosed`.
- It is funded and adjusted only through Transfers: opening, top-up, and withdrawal.
- It does not accept arbitrary Transactions.

## Invariants

- Original and current principal are safe integer minor units.
- Interest rates use an integer representation, not floating point.
- The Institution and linked Account must exist.
- Transfer legs are the record of money entering or leaving a FixedDeposit.
- Creation-time principal is the baseline (`originalPrincipalMinor` and initial `principalMinor`). The opening Transfer records funding without increasing principal again.
- Top-ups increase current principal.
- Withdrawals reduce current principal.
- A zero-balance withdrawal marks status `PrematurelyClosed` before maturity date, or `Matured` on/after maturity date.

## Persistence requirements

Persistence must support creating, retrieving, and listing FixedDeposits. The schema must preserve references to the holding Institution and linked Account. Column details belong in `src/db/schema.ts`.

## HTTP and UI contract

Server Actions only. No edit or delete, and no standalone “mark matured” action — see `docs/adr/0003-fixed-deposit-maturity-inside-transfer-creation.md`.

- `/fixed-deposits/new` — create a FixedDeposit:
  - Institution
  - Linked Account (payout destination)
  - Required custom name (same length limit as Account names)
  - Optional account number
  - Decimal principal
  - Interest rate as a percentage (converted to integer basis points)
  - Opening date and maturity date
  - Currency is taken from the linked Account
  - Status starts `Open`; there is no status field on this form
- `/fixed-deposits/[id]` — name as the heading, optional account number, current principal, original principal, rate, dates, status, linked Account, and any Transfers where this FixedDeposit is a leg. No screen presents it as accepting arbitrary Transactions.
- Opening and maturity movement go through `/transfers/new` (`docs/specs/transfers.md`), not through a FixedDeposit screen. Creating a FixedDeposit does not create its opening Transfer; those stay separate actions.
- `FixedDeposit.originalPrincipalMinor` is immutable after creation. `FixedDeposit.principalMinor` is derived by applying top-up and withdrawal Transfers.

Money and rate fields follow the same decimal-input convention as Accounts (percentage input converted to basis points for the rate).

## Acceptance criteria

- Unknown Institution and linked Account references are rejected.
- Invalid or overflowing principal minor units are rejected.
- Opening and maturity movement is represented through Transfers rather than direct FixedDeposit Transactions.
- Top-up Transfers are accepted only while status is `Open`.
- Withdrawals are accepted only while status is `Open`, must pay to the linked Account, and cannot exceed current principal before maturity date.
