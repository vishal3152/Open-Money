<div align="center">

<img src="public/brand/logo-lockup.svg" alt="Open Money" width="320" />

# Open Money

**A privacy-first ledger you can keep on your own device.**

[![Audited with Cloudflare security-audit-skill](https://img.shields.io/badge/security_audit-Cloudflare-F38020?style=flat&logo=cloudflare&logoColor=white)](https://github.com/cloudflare/security-audit-skill)

[Privacy](#privacy-and-data-ownership) · [Hosted app](https://money-watch-me.vercel.app/) · [Desktop downloads](#desktop-or-local-browser) · [Run it yourself](#run-it-your-way) · [Development setup](#develop) · [FAQ](#faq)

</div>

Open Money is a personal ledger for accounts across institutions and currencies. In local mode, your ledger lives in a SQLite file on your own device or server. You can enter transactions and reconcile balances without connecting to a bank or AI service. We built Open Money because, after Microsoft discontinued Money, we wanted a successor we could run ourselves. [Microsoft Money support archive](https://mskb.pkisolutions.com/kb/894020)

Recent bank account takeover scams show how unauthorized transfers can appear in your account. Keeping a parallel ledger gives you an independent record to compare with your bank statement and investigate entries you don't recognize. Compare the bank's reported balance with your ledger balance and keep any discrepancy open until you record an Adjustment or mark it as disputed with the bank. [FBI account takeover alert](https://www.ic3.gov/PSA/2025/PSA251125)

Bring in statement history with an AI assistant over MCP, then use automatic Email Alert Sync to pick up new bank alerts for review. Both imports are optional, work in local and cloud mode, and use records you already have without asking for your online banking login. Your assistant reads the statement file. For email sync, you choose the AI endpoint and can use a model on your own machine in local mode. [Imports and automation](#imports-and-automation)

## Features

| Area | What you can do |
| --- | --- |
| **[Local data ownership](#privacy-and-data-ownership)** | Keep your ledger on hardware you control and back up the SQLite file yourself. |
| Accounts and transactions | Group accounts by institution and maintain a ledger in each account's currency. Review imported transactions before marking them Confirmed. |
| **[MCP statement sync](#mcp-statement-imports-and-transaction-search)** | Import bank and brokerage statements on demand with a compatible AI assistant in local or cloud mode. |
| **[Automatic Email Alert Sync](#email-alert-sync)** | Import transactions from new bank alert emails automatically after setup in local or cloud mode. |
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

Published installers are on the [Open Money releases](https://github.com/vishal3152/Open-Money/releases) page. From this checkout, use `pnpm electron:dev` for development or `pnpm electron:start` for a production build. Electron always uses local SQLite and applies database migrations at startup.

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

#### Prerequisites

To use the hosted version, open Open Money in your browser and select **Sign in**. [Open Money hosted app](https://money-watch-me.vercel.app/)

To deploy your own cloud instance, you need Node.js 22, pnpm, a Next.js host such as Vercel, and a Postgres connection with permission to apply app migrations. Use a Supabase Auth project or configure static logins. Email Alert Sync requires additional credentials and scheduling only if you enable it. [Email Alert Sync](#email-alert-sync)

#### Deploy your own instance

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

### MCP statement imports and transaction search

Open **MCP** in the app navigation to find the connection URL and client configuration. Give a bank or brokerage statement to a compatible assistant to import transactions on demand. The assistant can preview the extracted rows, save a batch for your review, and search transactions already in your ledger.

- **Local or self-hosted.** Keep the MCP endpoint on loopback. It checks the Host and Origin headers and has no remote-client authentication.
- **Cloud.** Generate an access token from the MCP page and configure the client to send it as a bearer token. The app shows the token once and stores its hash. Clients that require OAuth cannot connect to the current endpoint.

[Client setup](docs/mcp-setup.md) · [Cloud token design](docs/adr/0011-mcp-cloud-auth-static-bearer-token.md)

### Email Alert Sync

In **Settings → Email Alert Sync**, configure the mailbox and your full LLM endpoint URL. The poller matches alerts by institution and the last four digits of the account number. Alerts that need correction appear in the Unresolved queue.

- **Local.** Run `pnpm email-sync:poll` alongside the app to check for new bank alerts automatically at your configured interval. Use the same OS user and export the same `DATABASE_PATH` if set. The poller reads saved settings and does not load `.env.local`. You can use a same-machine Ollama endpoint such as `http://localhost:11434/api/chat`.
- **Cloud on Vercel.** Vercel Cron checks for new bank alerts daily using the schedule in `vercel.json`. Set `CRON_SECRET` to at least 32 characters and generate `EMAIL_SYNC_ENCRYPTION_KEY` with `openssl rand -base64 32`. Each Owner saves their own mailbox and LLM settings. The hosted poller needs a reachable LLM endpoint. [Cron setup](docs/cron-setup.md) · [Configuration reference](env.example)

## Privacy and data ownership

- **Local.** The ledger lives in SQLite on the machine running the app. Core ledger workflows run without sending data to a bank or LLM. Local email credentials and settings are stored in plaintext in `~/.config/money-watch/settings.json`.
- **Cloud.** The deployment operator controls Postgres and server logs. The app connects as the table owner, so dataset isolation depends on app-layer `owner_id` scoping. IMAP usernames and passwords are encrypted on save with `EMAIL_SYNC_ENCRYPTION_KEY`. Legacy plaintext credentials remain readable, and the LLM API key is outside that encryption. [Owner isolation](docs/adr/0006-drop-rls-for-app-layer-owner-filtering.md) · [Credential storage](docs/adr/0012-imap-credentials-encrypted-at-rest-with-app-layer-key.md)
- **MCP.** Your assistant reads the statement you give it. Open Money receives structured rows. If you use MCP search, the connected assistant receives matching ledger transactions.
- **Email Alert Sync.** Your configured AI endpoint receives candidate senders and subjects, then the subject and body of messages classified as alerts. Local mode can send these requests to a model running on your own machine. Server logs include full AI request and response bodies, which can contain email and financial details. [Email processing](docs/adr/0009-email-alert-sync-calls-llm-server-side.md)
- **Network traffic.** The app has no built-in analytics or crash reporting. Set `NEXT_TELEMETRY_DISABLED=1` to opt out of Next.js telemetry. Builds fetch the Google font. Email sync connects to your IMAP provider and LLM host. IMAP hosts are checked in both tiers, and hosted LLM requests have additional host checks. [Host checks and limits](docs/adr/0013-provider-agnostic-llm-config-with-cloud-only-host-safety.md)

### Backups

- **SQLite.** Stop the app and poller before copying or syncing the database file. Back up `~/.config/money-watch/settings.json` separately if you need the saved email configuration. Use one writer when storing the file in a synced folder. The app provides no file sync or conflict resolution.
- **Postgres.** Use your database provider's backups and keep a separate backup of `EMAIL_SYNC_ENCRYPTION_KEY`. The key is required to decrypt existing IMAP credentials.

There is no built-in tool for migrating a dataset between SQLite and Postgres.

## Architecture

Next.js Server Components and Server Actions use shared repository interfaces. The repository factory selects Drizzle over SQLite in local mode or Owner-scoped Postgres in cloud mode. Electron runs the local Next.js server in a child process. Pure domain logic lives in `src/domain`. [Module map and invariants](docs/CODEMAP.md) · [Feature specs](docs/specs/) · [Architecture decisions](docs/adr/)

Share trading tracks quantities. Cash legs, cost basis, market valuation, trading reconciliation and broker email imports are outside its current scope. Some labels and repository errors remain English-only. [Known gaps](docs/CODEMAP.md#current-status)

## Develop

Install Git, Node.js 22, and pnpm. For local Postgres and Supabase Auth development, install and start Docker as well. [Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started)

```bash
git clone https://github.com/vishal3152/Open-Money.git
cd Open-Money
pnpm install
```

### Develop with SQLite

Start the browser app and open `http://127.0.0.1:3000`. Use `pnpm electron:dev` to develop in the desktop shell.

```bash
DEPLOYMENT_MODE=local pnpm exec next dev --hostname 127.0.0.1
```

### Develop cloud mode locally

1. With Docker running, run `pnpm supabase:start` to start the local stack and apply the Postgres migrations.
2. Copy `env.example` to `.env.local` if needed. Set `POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` for the local database.
3. For a test login, set `AUTH_PROVIDER=simple` and add a development-only `email:password` pair to `AUTH_USERS`. To develop against Supabase Auth, use the local API URL and publishable key shown by `pnpm exec supabase status` and configure the sign-in flow you need. [Authentication setup](#deploy-your-own-instance)
4. Run `pnpm dev --hostname 127.0.0.1` and open `http://127.0.0.1:3000`.

### Run checks

SQLite tests use temporary database files. Start the local Supabase stack before running the full suite, which includes Postgres and Auth tests. [Test setup and locations](docs/CODEMAP.md#test-locations)

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

## FAQ

<details>
<summary><b>Does this connect to my bank?</b></summary><br>

No — and it will never ask for online-banking credentials. There is no Plaid, Yodlee, or screen-scraping integration in the codebase. It works from artifacts you already have: statements you download (imported with AI assistance over MCP) and the alert emails your bank already sends you (IMAP sync). That is a deliberate product choice, not a missing feature.
</details>

<details>
<summary><b>Is my financial data sent anywhere?</b></summary><br>

Core local ledger workflows store your data in SQLite without a bank or LLM connection. Email sync, your external assistant, framework telemetry and build-time downloads have separate network behavior; see [Privacy and data ownership](#privacy-and-data-ownership).

In cloud mode, data is stored in the deployment's Postgres database. If you use someone else's hosted instance, that operator controls the database and server logs. Email sync sends data to its configured IMAP and LLM services; keeping LLM processing on your own machine requires a local installation and local model.
</details>

<details>
<summary><b>Do I need Supabase to use this?</b></summary><br>

No. Supabase is a **cloud-mode-only** dependency (Postgres + Auth). The desktop app and self-hosted local mode never load the Supabase SDK — cloud modules are dynamic-imported behind `isCloudMode()`. Local mode needs no accounts, no keys, and no `.env` file. Even in cloud mode, `AUTH_PROVIDER=simple` gives you multi-user logins with no Supabase Auth.
</details>

<details>
<summary><b>Which mode should I pick?</b></summary><br>

**Local/desktop** if you want your ledger on your own disk and you mostly use one machine — this is the default posture the project was built around. **Self-hosted** if you want it on your own server or NAS. **Cloud** if you want to reach the same data from a phone and a laptop without syncing a file yourself, and you are comfortable running a Supabase project (or any Postgres).
</details>

<details>
<summary><b>Can the desktop app use cloud mode?</b></summary><br>

No, by design. The Electron shell forces `DEPLOYMENT_MODE=local`, exposes no storage-mode switch, and cloud SDK modules are never loaded there. Cloud is a browser concern. The reasoning — and what reversing it would cost — is in [ADR-0007](docs/adr/0007-electron-desktop-is-local-only.md).
</details>

<details>
<summary><b>How do I back up my data? Where does it live?</b></summary><br>

**Local:** stop the app and email poller, then copy the SQLite file. Browser mode defaults to `./money-watch.db`; Electron defaults to appData/`Money-Watch/money-watch.db`, unless an environment or saved Settings path overrides it. Back up `~/.config/money-watch/settings.json` separately if you need email settings; it contains plaintext secrets. A synced folder is external storage, not a supported concurrent-write sync protocol: close all writers before syncing or copying and avoid simultaneous use on multiple machines. **Cloud:** use your Postgres provider's backups and back up `EMAIL_SYNC_ENCRYPTION_KEY` separately; losing it prevents decryption of encrypted IMAP credentials. See [Backups](#backups) and [SQLite file locations](#sqlite-file-locations).
</details>

<details>
<summary><b>Can I move my data from local to cloud (or back)?</b></summary><br>

There is no built-in migration tool. The tiers have separate SQLite and Postgres schemas, and cloud records also need an Owner identity; copying the SQLite file into cloud mode does not migrate the data.
</details>

<details>
<summary><b>Can my spouse and I share one dataset?</b></summary><br>

There is no household or shared-access feature. Cloud mode isolates one dataset per Owner and cannot grant another login access to it. Local mode has no login or person-level isolation: anyone with access to that running instance uses the same dataset.
</details>

<details>
<summary><b>Why integer minor units instead of decimals?</b></summary><br>

Amounts such as 0.1 cannot always be represented exactly as binary floating-point fractions. Open Money parses decimal input into safe-integer minor units and stores and sums those integers for ledger balances. Currency precision is defined in `src/domain/currency.ts`; realised FX rates are derived numeric ratios.
</details>

<details>
<summary><b>Does the AI see my bank statements?</b></summary><br>

With MCP import, your assistant reads the statement under its own privacy terms and sends Open Money structured rows, not the original document. Email sync sends candidate sender names and subjects and classified alert bodies to the configured LLM ([ADR-0009](docs/adr/0009-email-alert-sync-calls-llm-server-side.md)). In local mode, a same-machine Ollama endpoint keeps that LLM processing local.
</details>

<details>
<summary><b>Do I have to use the AI features at all?</b></summary><br>

No. Both are opt-in. Institutions, accounts, transactions, transfers, fixed deposits, trades and reconciliations can be managed manually. Import batches are created by the import paths; you do not need them for the manual workflows.
</details>

<details>
<summary><b>Which currencies are supported?</b></summary><br>

Accounts accept three-letter currency codes. Precision currently uses zero decimal places for JPY and KRW, three for BHD, KWD and OMR, and two for every other code; there is no complete ISO currency validation or precision table. Each Account has one currency. Cross-currency Transfers derive the realised rate from the amounts you enter; there is no market-rate feed or consolidated cross-currency valuation.
</details>

<details>
<summary><b>Why Server Actions instead of a REST API?</b></summary><br>

The server-rendered financial UI uses Server Actions for mutations and repository ports for storage access. SQLite and Postgres implementations share those ports, while cloud authentication supplies the Owner identity. MCP and email-sync routes provide separate HTTP entry points. See [ADR-0002](docs/adr/0002-server-actions-not-rest-api.md).
</details>

## Contributing

Issues and pull requests are welcome. Follow the repo conventions, update the code map and README when your change affects them, and run tests, typecheck and lint before opening a PR. [Working agreement](AGENTS.md) · [Code map](docs/CODEMAP.md)

## License

[PolyForm Noncommercial 1.0.0](LICENSE). For commercial licensing, contact the maintainer through a GitHub issue.
