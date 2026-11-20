# AGENTS.md

Read this file before every task. Finish the requested work and verify the result.

## 0. Working rules

- Start with the answer or action. Correct false premises directly. Verify paths, APIs, and results before citing them.
- Ask when competing interpretations or approaches would materially change the result, the literal request conflicts with the goal, the change touches a known load-bearing or versioned contract or migration path, or required credentials or production access are missing. Resolve routine ambiguity from the repo, reuse answers already given, and state assumptions.
- Delegate broad exploration when dozens of file reads would crowd out the main task. After two failed corrections on the same issue, summarize the evidence and ask for a fresh session with a sharper prompt.

## 1. Before editing

- State a brief plan and the success criteria before editing. For non-trivial work, present numbered steps with a verification check for each.
- Read the files you will change and their callers. Before non-trivial changes, read the [code map](docs/CODEMAP.md). For domain work, use the terminology and behavior in the [feature specs](docs/specs/) and read the relevant [ADRs](docs/adr/). Follow the [domain documentation guide](docs/agents/domain.md) when using engineering skills.
- Update [the code map](docs/CODEMAP.md) when a module is added, removed, renamed, or moved, or its responsibility, public interface, dependency direction, major data flow, or test location changes. Keep entries to one line on location, ownership, and non-obvious constraints. Put change history in commits, specs, or ADRs.
- Update [the README](README.md) when a change affects anything it documents, including setup, configuration, deployments, privacy, features, prerequisites, release artifacts, or known gaps.

## 2. Implementation

- Keep every changed line tied to the request. Match existing patterns and style. Remove orphans created by your change. Report unrelated dead code and leave it in place.
- Use the `tdd` skill for code changes. Reproduce bugs with a failing test first. For validation, cover applicable empty, malformed, and oversized inputs. For a refactor, verify that tests pass before and after and public APIs stay stable. For performance work, profile and benchmark the same path before and after.
- Solve the stated problem with the smallest clear change. Keep single-use logic inline, handle realistic failures, and add configurability or extension points only when required.
- Use ES modules and `@/` aliases for cross-directory imports. Throw typed domain and database errors and translate them at the route or Server Action boundary.

## 3. Runtime and data

- Store and compute money in integer minor units. Keep domain logic independent of the database and framework.
- Use `src/db/repository-factory.ts` and the shared Drizzle repository ports for application data access. Keep Drizzle and SQL out of UI and route handlers.
- Preserve the tier boundary. Local, self-hosted SQLite, and Electron stay local, with configurable storage through `DATABASE_PATH` and existing Settings. Cloud uses Owner-scoped Postgres and requires a verified Owner, with no SQLite fallback. Keep authentication and tenancy in cloud mode and avoid speculative sync. Read the [code map invariants](docs/CODEMAP.md#invariants) before changing tier selection, database access, or Owner isolation.
- SQLite schema changes start in `src/db/schema.ts`. Regenerate `drizzle/` with Drizzle Kit. Add ordered Postgres migrations under `postgres/migrations/` and preserve applied migration files.
- Desktop changes start at `electron/main.cjs`. Keep Next.js and native SQLite in the Node child, with database preparation before Next starts. Unset `ELECTRON_RUN_AS_NODE` for the unpackaged Electron parent and set it to `1` for packaged Node children. See the [packaging notes](docs/CODEMAP.md#build-packaging--release-electron-shell-scripts-ci).
- MCP access changes must follow [ADR-0011](docs/adr/0011-mcp-cloud-auth-static-bearer-token.md) for the existing cloud bearer-token path. [ADR-0008](docs/adr/0008-mcp-endpoint-adds-scoped-oauth-for-remote-clients.md) is the proposed OAuth design.

## 4. Verification

- Write and run a check for each success criterion where practical. Read complete logs and traces. Fix root causes and confirm the results before reporting success.
- Run focused Vitest tests while iterating and the full suite, lint, and typecheck for final code verification. Colocate tests as `*.test.ts`. Test database behavior against a real temporary SQLite file and real Postgres as applicable.
- Use Node.js 22 and pnpm. Follow the [README development instructions](README.md#develop) and [package scripts](package.json) for setup and commands. `pnpm dev` and `pnpm start` force cloud mode. Use the README's local browser instructions for SQLite. See [test locations](docs/CODEMAP.md#test-locations) for Postgres and auth test setup.

## 5. UI

- **Mobile-first.** Read the [mobile UX standard](docs/agents/mobile-ux.md) before building, changing, or verifying a screen. Verify touch controls, thumb reach, and preserved input. For UI changes, walk and capture the primary workflow before and after at about 375px and describe the difference.
- **Product coherence.** Read the [product QA guide](docs/agents/product-qa.md) for manual UI review, UI test cases, or forms that expose domain operations. Check both spec compliance and coherence. Flag competing affordances and one-time lifecycle gates offered alongside repeatable actions.

## Project Learnings

After a user correction or an agent mistake, add a concrete one-line rule for missing guidance or sharpen the existing rule. Prune rules when their underlying issue is gone.

- Button-styled links need a hover check for both foreground and background. The global `a:hover` can make the label blend into the button.
- Preserve submitted values after validation errors with `withPersistedFormState` from `src/app/form-persistence.ts` to account for React 19 form resets.
- Use `<DecimalInput>` or `sanitizeDecimalInput` for money and rate fields so users cannot enter letters.
- For financial QA fixes, derive expected behavior from the feature spec and run matching SQLite and Postgres regressions. Cover equal timestamps and concurrent submissions for history replay changes.
- When reusing list or ledger markup, read the full item render and verify reused classes in `src/app/globals.css`. The `.pw-list` row layout requires an `<a>` or `<span>` directly under each `<li>`. Verify the result visually.

## Issue tracker

Use GitHub Issues via `gh`. Read the [issue tracker guide](docs/agents/issue-tracker.md) when working with issues or skills that fetch or publish them.
