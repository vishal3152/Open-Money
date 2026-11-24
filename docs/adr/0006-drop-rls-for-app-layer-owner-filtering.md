---
status: accepted (supersedes ADR-0005's RLS-based isolation)
---

# App-layer owner filtering replaces RLS

## Context

ADR-0005 relied on Postgres RLS for cloud Owner isolation. Enforcing RLS per query required a transaction with role/`set_config` setup before statements. Against the remote pooler that cost about 2s of connection setup before pooling, and even with pooling about 250ms × several round trips on a typical page.

The safety of RLS — a missing `WHERE owner_id = …` becomes a no-op instead of a leak — was real. Latency was not acceptable.

## Decision

Every cloud repository query filters by `owner_id` in application code. RLS policies stay in the schema but are dormant: the app connects as the table owner, which bypasses RLS by default.

Each repository method’s cross-Owner isolation is covered by a dedicated test. During conversion, filters were broken on purpose to confirm those tests fail, then restored.

## Alternatives considered

- Keep RLS and only collapse duplicate `set_config` calls — still leaves multiple round trips per call.
- Keep RLS as a second line of defense with app-layer filters — role switching still costs the same; “both” is full RLS cost plus app discipline.

## Consequences

- ADR-0005’s “RLS plus repository filtering” was never implemented as written: early repositories had no `owner_id` predicates; RLS was the only isolation. This ADR makes app-layer filtering the real mechanism.
- Every cloud read and write must include `owner_id`. A missing filter on `select` is a cross-tenant leak; on `update`/`delete` it can corrupt or delete another Owner’s rows. Compound `(id, owner_id)` foreign keys constrain references; they do not protect bare update/delete predicates.
- RLS definitions remain in `postgres/migrations/` so re-enabling them later needs no new schema drop — only restoring a non-bypassing role and per-query scope.
