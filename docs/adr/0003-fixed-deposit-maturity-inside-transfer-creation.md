# FixedDeposit lifecycle updates are side effects of Transfer purpose

## Context

An earlier design treated any FixedDeposit-sourced Transfer as full maturity. That blocked partial premature withdrawal and explicit top-up.

Two later gaps: `currencyCode` was a free-typed form field unrelated to `linkedAccountId`, and creating a FixedDeposit never moved money — `fixed-deposit-opening` existed but was not wired into creation.

## Decision

One generic `/transfers/new` flow. Each FixedDeposit-related Transfer carries an explicit purpose (`fixed-deposit-opening`, `fixed-deposit-top-up`, `fixed-deposit-withdrawal`). Principal and status side effects run atomically inside `TransferRepository.create()`.

- `FixedDeposit` stores immutable `originalPrincipalMinor` (baseline at creation) and mutable `principalMinor` (current principal).
- The opening Transfer records movement into the FixedDeposit but does not increase principal again; baseline principal is the source of truth.
- Top-up Transfers increase current principal while the FixedDeposit is `Open`.
- Withdrawal Transfers reduce current principal while the FixedDeposit is `Open`, must pay to the linked Account, and cannot exceed principal before maturity date.
- When withdrawal drives principal to zero: before `maturityDate` → status `PrematurelyClosed`; on/after `maturityDate` → status `Matured`.
- Transfer deletion recomputes affected FixedDeposit principal/status from remaining Transfer history, so out-of-order deletions cannot leave stale lifecycle state.

### Currency invariant and opening debit at creation

- `FixedDepositRepository.create()` validates `input.currencyCode` against the linked Account’s `currencyCode` and throws `FixedDepositCurrencyMismatchError` on mismatch. Enforcement is at the data layer; `createFixedDeposit` derives currency from the selected Account, so the form does not ask for it.
- `FixedDepositRepository.create()` takes an optional `openingDebit: { transferId, transactionId, description }`. When present, it writes the FixedDeposit row and a `fixed-deposit-opening` Transfer plus its linked Transaction in the same `db.transaction()`. Same pattern as `TransferRepository.create()` / `.delete()`: the repository that owns a composite event reaches into every table that event touches. The codebase has no shared transaction handle across repositories.
- The debit is optional (a “Debit linked Account now” checkbox, checked by default). Not every FixedDeposit is funded through this app when it is recorded.
- `TransferRepository.create()` rejects a second `fixed-deposit-opening` Transfer against the same FixedDeposit, so skipping the debit at creation and recording it later (via “Record opening debit” on the FixedDeposit detail page) cannot happen twice.

## Alternatives considered

- Dedicated maturity wizard separate from Transfers — rejected: keeps UX as one Transfer form with purpose-driven side effects.
- Drop `linkedAccountId` and merge FixedDeposit into Account via a `kind` discriminator — rejected: FixedDeposit does not accept arbitrary Transactions, a boundary this ADR’s repository side effects depend on. Merging would reinvent that as a runtime special case on Account. Reconciliation and BalanceSnapshot also have no equivalent for an FD’s fully computed balance.

## Consequences

- UX stays one Transfer form; FixedDeposit behavior is explicit, auditable, and supports top-ups and premature withdrawals.
