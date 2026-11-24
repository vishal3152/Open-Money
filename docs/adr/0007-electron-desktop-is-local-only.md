---
status: accepted
---

# Electron desktop app is local-only; cloud (and Supabase) stays browser-only

## Context

Open Money has one codebase for browser cloud and desktop local. Desktop’s product job is offline SQLite on the user’s machine. Cloud hosting (Supabase Auth + Postgres) is a browser launch concern (`pnpm dev` / `pnpm start`).

## Decision

The Electron shell always runs the local SQLite tier. It forces `DEPLOYMENT_MODE=local` and `PAISA_WATCH_DESKTOP=1`. There is no storage-mode switch in desktop settings. `isCloudMode()` is hard-false whenever the desktop flag is set.

Middleware, owner lookup, header chrome, login, and the auth callback load `@supabase/*` only behind `isCloudMode()` via dynamic `import()`. A desktop process never constructs a Supabase client, never needs Auth env, and never pays for cloud session plumbing it cannot use.

## Alternatives considered

- Keep a local/cloud switcher inside Electron (settings + relaunch) — rejected: reintroduces Auth, env, and relaunch complexity for a path we do not want to ship in the shell.
- Allow `DEPLOYMENT_MODE=cloud` under Electron if the user sets it, but skip UI — rejected: easy to misconfigure, and `isCloudMode()` would still pull Auth into the desktop Next process.
- Statically import Supabase everywhere and only branch at runtime — rejected: the modules still evaluate on every desktop request; dynamic import behind `isCloudMode()` keeps the SDK unloaded.

## Consequences

- Browser cloud and desktop local remain one codebase, but desktop is not a second cloud client. Reversing this means restoring a storage-mode setting, relaunch UX, and accepting Supabase on the Electron-spawned Next process.
- `/login` and `/auth/callback` redirect home when not in cloud mode. Desktop settings only configure the SQLite file path.
