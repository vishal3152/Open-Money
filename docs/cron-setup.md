# Cloud email-sync cron

Turn on the Vercel Cron job that polls each Owner’s mailbox for bank alerts. Behavior is defined in `docs/specs/email-alert-sync.md`. Local and desktop installs do not use this job; they run `pnpm email-sync:poll` instead.

## 1. Set `CRON_SECRET`

In Vercel: **Project → Settings → Environment Variables**, add `CRON_SECRET` for **Production**. Use at least 32 random characters (`openssl rand -hex 32`). Shorter values are rejected.

Vercel sends `Authorization: Bearer <CRON_SECRET>` on each cron request. `/api/cron/email-sync` compares it in constant time and returns 401 on mismatch. Use a dedicated secret for this check only.

## 2. Deploy

`vercel.json` already declares the job:

```json
"crons": [
  { "path": "/api/cron/email-sync", "schedule": "0 8 * * *" }
]
```

Deploy as usual (`git push` to the Vercel branch, or `vercel deploy --prod`). Confirm under **Project → Settings → Cron Jobs**.

The schedule is once daily at 08:00 UTC. Hobby plans only allow daily crons; a finer schedule fails deploy. Pro or higher can use a tighter expression. See [Vercel cron expressions](https://vercel.com/docs/cron-jobs#cron-expressions).

## 3. Each Owner configures a mailbox

The cron job reads saved settings per Owner. While signed in, each Owner sets IMAP and LLM details under **Settings → Email Alert Sync**. Owners without settings are skipped.

## 4. Verify

- **Logs** — Project → Cron Jobs → **View Logs**. A successful body looks like `{ "results": [{ "ownerId": "...", "ok": true, "matched": 0, "unresolved": 0, "invalid": 0, "skipped": 0 }] }` (empty `results` if nobody has settings).
- **Manual call** after deploy:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://<your-deployment>/api/cron/email-sync
  ```

  A new bank alert in a configured mailbox should appear under `/imports` shortly after.

## Troubleshooting

- **401** — `CRON_SECRET` missing or wrong for that environment (often set on Preview but not Production).
- **404** — route only exists in cloud mode. Unexpected on a real Vercel deploy.
- **Cron schedule deploy error** — Hobby plan with a sub-daily schedule. Use a daily expression or upgrade.
- **One Owner `ok: false`** — that Owner’s result includes an `error` (IMAP, LLM, and so on). Other Owners in the same run still proceed.
- **`ok: true` but nothing imported** — check `matched` / `unresolved` / `invalid`. `unresolved` means institution or account suffix did not match exactly one Account; `invalid` means the LLM response failed validation.

## Not covered

- Confirming the Vercel plan supports sub-daily crons before changing the schedule.
- Local polling (`pnpm email-sync:poll`) — see `docs/specs/email-alert-sync.md`.
