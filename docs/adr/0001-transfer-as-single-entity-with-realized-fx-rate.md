# Transfer is a single entity with two legs, not two linked Transactions

## Context

Money often moves between Accounts in different currencies (for example USD → INR). Double-entry bookkeeping would model that as two independent Transactions — a withdrawal and a deposit — that happen to reference each other.

## Decision

`Transfer` is one entity with a source leg and a destination leg. Each leg has its own currency. The Transfer stores the FX rate actually realized on that move.

Both sides stay atomically linked. The realized rate is reconciliation data: a wrong rate is as much a signal as a missing Transaction. Wire fees and FX spread fold into that rate rather than appearing as separate line items.

## Alternatives considered

- Two linked Transactions (plain double-entry) — rejected: the link is easy to break, and the realized FX rate has nowhere to live as first-class data.
