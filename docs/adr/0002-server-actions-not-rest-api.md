# UI mutates through Server Actions, not a REST API layer

## Context

Open Money is single-user and local-first. No consumer other than its own Next.js UI is planned. Hosted and multi-tenant work is deferred.

## Decision

Forms and Server Components call Next.js Server Actions directly. There is no JSON REST layer under `src/app/api/*` for the nine domain entities.

## Alternatives considered

- JSON routes under `src/app/api/*` called from client components — rejected: that means designing and maintaining request/response contracts for nine entities with no second consumer to justify them. Speculative flexibility of that kind is out of scope.

## Consequences

- If a real second consumer appears later (hosted API, mobile client), an API layer becomes non-speculative then — not before.
