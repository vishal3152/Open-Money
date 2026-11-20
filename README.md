<div align="center">

<img src="public/brand/logo-lockup.svg" alt="Open Money" width="320" />

# Open Money

**Know exactly where your money is — to the paise.**

[Hosted app](https://money-watch-me.vercel.app/) · [Desktop downloads](#desktop-or-local-browser) · [Run it yourself](#run-it-your-way)

</div>

Open Money is a personal ledger for accounts across institutions and currencies. Record a balance reported by your bank and compare it with the balance computed from your ledger. A mismatch stays open as a Discrepancy until you record an Adjustment or mark it as disputed with the bank.

You can maintain the full ledger manually. Optional imports use statements you supply or bank alerts in your inbox. The app has no direct bank connection and does not ask for online banking credentials.

## Features

| Area | What you can do |
| --- | --- |
| Accounts and transactions | Group accounts by institution and maintain a ledger in each account's currency. Review imported transactions before marking them Confirmed. |
| Transfers | Record both legs as one transfer. For cross-currency transfers, the amounts determine the realised exchange rate. |
| Fixed deposits | Track principal through opening, top-ups and withdrawals. |
| Reconciliation | Compare the ledger with a bank-reported BalanceSnapshot and track how each Discrepancy was resolved. |
| Share trading | Track whole-share trades and net holdings by trading account. Import trades in batches. |
| Languages | Switch between English, Simplified Chinese (中文) and Arabic (العربية, right-to-left) from the header or **Settings → Language**. |

Account currencies use three-letter codes. Amounts are stored as integer minor units. The current precision rules use zero decimal places for JPY and KRW, three for BHD, KWD and OMR, and two for other codes. Totals are kept per currency.

## Run it your way

| Mode | Where it runs | Storage and access |
| --- | --- | --- |
| Desktop or local browser | Your computer | SQLite, no app login |
| Self-hosted SQLite | Your own server or NAS | SQLite, one dataset shared by anyone who can reach the app |
| Cloud | Vercel or your own Next.js host | Postgres, one dataset per signed-in Owner |

Source builds use Node.js 22 and pnpm. Install dependencies with `pnpm install`.

### Desktop or local browser

Published installers are listed under the previous project name. From this checkout, use `pnpm electron:dev` for development or `pnpm electron:start` for a production build. Electron always uses local SQLite and applies database migrations at startup. [MoneyWatch releases](https://github.com/vishal3152/MoneyWatch/releases)

For a local browser session, run the following and open `http://127.0.0.1:3000`.

```bash
DEPLOYMENT_MODE=local pnpm exec next dev --hostname 127.0.0.1
```

The package scripts `pnpm dev` and `pnpm start` apply Postgres migrations and start **cloud mode**. `VERCEL=1` also selects cloud mode outside Electron.

To try sample data, open `/dev/seed` in the local development app and choose **Load seed data**. The seeder is disabled in production. [Demo data guide](scripts/demo-data/README.md)

### Self-hosted SQLite

Set `DATABASE_PATH` to a file on persistent storage. In this example the server listens on loopback for a reverse proxy on the same host. Put TLS and access control at the proxy before making the app reachable over the network.

```bash
DEPLOYMENT_MODE=local pnpm build
DATABASE_PATH=/data/money-watch.db DEPLOYMENT_MODE=local pnpm exec next start --hostname 127.0.0.1 --port 3000
```

### Cloud with Postgres

1. Copy `env.example` to `.env.local`. Set `DEPLOYMENT_MODE=cloud` and `POSTGRES_URL`. For Supabase Postgres, use the Session pooler connection string on port 5432. [Environment template](env.example) · [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. Choose an authentication provider.
   - **Supabase Auth** is the default. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. In Supabase, set the app's Site URL and allow `<origin>/auth/callback` and `<origin>/auth/callback?next=/login/reset-password`. Enable Google if you need Google sign-in. For email/password sign-in, sign-up and recovery, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in the app and the corresponding secret in Supabase CAPTCHA settings. Without the site key, those forms are hidden. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) · [Supabase CAPTCHA setup](https://supabase.com/docs/guides/auth/auth-captcha)
   - **Static logins** work with standard Postgres and need no Supabase account. Set `AUTH_PROVIDER=simple` and define `AUTH_USERS` as comma-separated `email:password` pairs. Passwords cannot contain commas or colons. Password changes require editing the list and restarting or redeploying. [Static login design](docs/adr/0015-simple-email-password-auth-as-supabase-alternative.md)
3. Run `pnpm dev` to apply migrations and start the browser app. For a production build on your own host, run `DEPLOYMENT_MODE=cloud pnpm build`, then `pnpm start`.
4. For Vercel, link the project with `pnpm exec vercel link` and set the cloud variables in the project's production environment. Run `pnpm prepare:cloud-database` with the production `POSTGRES_URL` set in your shell before deploying with `pnpm exec vercel deploy --prod`. The deploy and release scripts leave Postgres migrations to this separate step.

### SQLite file locations

| Runtime | Path precedence |
| --- | --- |
| Browser / self-hosted | `DATABASE_PATH` → saved Settings path → `./money-watch.db` |
| Electron | Saved Settings path → `DATABASE_PATH` → `Money-Watch/money-watch.db` under the OS application data directory |

## Imports and automation

Both import paths are optional. Committed rows are **Imported** and already affect balances or holdings. Before confirming a batch, remove suspected duplicates or dismiss their flags. Editing a row leaves its flag in place. Confirming a bank batch with a closing balance also creates a BalanceSnapshot and runs Reconciliation. [Import behavior](docs/specs/import.md)

### Statement imports and transaction search

Open **MCP** in the app navigation to find the connection URL and client configuration. A compatible assistant can read a bank or brokerage statement, preview rows and commit a batch for your review. It can also search transactions already in your ledger.

- **Local or self-hosted.** Keep the MCP endpoint on loopback. It checks the Host and Origin headers and has no remote-client authentication.
- **Cloud.** Generate an access token from the MCP page and configure the client to send it as a bearer token. The app shows the token once and stores its hash. Clients that require OAuth cannot connect to the current endpoint.

[Client setup](docs/mcp-setup.md) · [Cloud token design](docs/adr/0011-mcp-cloud-auth-static-bearer-token.md)

### Email Alert Sync

In **Settings → Email Alert Sync**, configure the mailbox and your full LLM endpoint URL. The poller matches alerts by institution and the last four digits of the account number. Alerts that need correction appear in the Unresolved queue.

- **Local.** Run `pnpm email-sync:poll` alongside the app, using the same OS user and exporting the same `DATABASE_PATH` if set. The poller reads saved settings and does not load `.env.local`. You can use a same-machine Ollama endpoint such as `http://localhost:11434/api/chat`.
- **Cloud on Vercel.** Set `CRON_SECRET` to at least 32 characters and generate `EMAIL_SYNC_ENCRYPTION_KEY` with `openssl rand -base64 32`. Each Owner saves their own mailbox and LLM settings. The hosted poller needs a reachable LLM endpoint. The schedule comes from `vercel.json`. [Cron setup](docs/cron-setup.md) · [Configuration reference](env.example)

## Privacy and data ownership

- **Local.** The ledger lives in SQLite on the machine running the app. Core ledger workflows run without sending data to a bank or LLM. Local email credentials and settings are stored in plaintext in `~/.config/money-watch/settings.json`.
- **Cloud.** The deployment operator controls Postgres and server logs. The app connects as the table owner, so dataset isolation depends on app-layer `owner_id` scoping. IMAP usernames and passwords are encrypted on save with `EMAIL_SYNC_ENCRYPTION_KEY`. Legacy plaintext credentials remain readable, and the LLM API key is outside that encryption. [Owner isolation](docs/adr/0006-drop-rls-for-app-layer-owner-filtering.md) · [Credential storage](docs/adr/0012-imap-credentials-encrypted-at-rest-with-app-layer-key.md)
- **AI data.** Your assistant reads the statement you give it and sends structured rows to Open Money. MCP search returns recorded transaction details to the connected assistant. Email sync sends candidate senders and subjects to your configured LLM, then sends subject and body for messages classified as alerts. Server logs include full LLM request and response bodies, which can contain email and financial details. [Email processing](docs/adr/0009-email-alert-sync-calls-llm-server-side.md)
- **Network traffic.** The app has no built-in analytics or crash reporting. Set `NEXT_TELEMETRY_DISABLED=1` to opt out of Next.js telemetry. Builds fetch the Google font. Email sync connects to your IMAP provider and LLM host. IMAP hosts are checked in both tiers, and hosted LLM requests have additional host checks. [Host checks and limits](docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md)

### Backups

- **SQLite.** Stop the app and poller before copying or syncing the database file. Back up `~/.config/money-watch/settings.json` separately if you need the saved email configuration. Use one writer when storing the file in a synced folder. The app provides no file sync or conflict resolution.
- **Postgres.** Use your database provider's backups and keep a separate backup of `EMAIL_SYNC_ENCRYPTION_KEY`. The key is required to decrypt existing IMAP credentials.

There is no built-in tool for migrating a dataset between SQLite and Postgres.

## Architecture

Next.js Server Components and Server Actions use shared repository interfaces. The repository factory selects Drizzle over SQLite in local mode or Owner-scoped Postgres in cloud mode. Electron runs the local Next.js server in a child process. Pure domain logic lives in `src/domain`. [Module map and invariants](docs/CODEMAP.md) · [Feature specs](docs/specs/) · [Architecture decisions](docs/adr/)

Share trading tracks quantities. Cash legs, cost basis, market valuation, trading reconciliation and broker email imports are outside its current scope. Some labels and repository errors remain English-only. [Known gaps](docs/CODEMAP.md#current-status)

## Develop

Use the startup command for your chosen mode above. To run Postgres and Auth tests locally, start the Docker-backed Supabase stack with `pnpm supabase:start`. Use its URL and publishable key for local Auth development and `postgresql://postgres:postgres@127.0.0.1:54322/postgres` for `POSTGRES_URL`. SQLite tests use a temporary database file. [Test setup and locations](docs/CODEMAP.md#test-locations)

```bash
pnpm test src/domain/transfer.test.ts
pnpm test
pnpm typecheck
pnpm lint
```

For SQLite schema changes, edit `src/db/schema.ts` and regenerate `drizzle/` with Drizzle Kit. Add ordered Postgres SQL files in `postgres/migrations/`. Translation keys start in `src/i18n/messages/en.ts` and are mirrored in `zh.ts` and `ar.ts`.

## Build & release

- `pnpm electron:package` builds installers in `dist/electron/`. The defaults are macOS DMG/ZIP plus Windows NSIS on macOS, or Linux AppImage plus Windows NSIS on Linux. Windows packaging needs Rosetta on Apple Silicon or Wine on Linux. macOS signing and notarization depend on the available credentials. Windows installers are unsigned. Use a clean build environment and see target overrides in the [packaging script](scripts/package-electron.sh).
- `pnpm release` runs tests, typecheck and packaging, then publishes a version-tagged GitHub release and deploys to Vercel. It needs authenticated GitHub CLI and Vercel access for the publishing steps. See skip flags and prerequisites in the [release script](scripts/release.sh).

## Contributing

Issues and pull requests are welcome. Follow the repo conventions, update the code map and README when your change affects them, and run tests, typecheck and lint before opening a PR. [Working agreement](AGENTS.md) · [Code map](docs/CODEMAP.md)

## License

[PolyForm Noncommercial 1.0.0](LICENSE). For commercial licensing, contact the maintainer through a GitHub issue.
