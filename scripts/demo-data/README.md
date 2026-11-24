# Demo seed data

Deterministic fixture for a local Open Money database used in UI and manual testing.

## Contents (`public/demo-data/seed-data.json`)

| Entity | Count | Notes |
| --- | --- | --- |
| Institutions | 10 | Named after common Indian banks |
| Accounts | 100 | 10 per bank: 5 INR, 3 USD, 2 AED |
| Fixed deposits | 100 | One per account, with opening debit |
| Transactions | 600 | Six per account (3 income + 3 expense) |
| Transfers | 600 | Six per account as source to a same-currency peer |

Load order: Institutions → Accounts → Transactions (fund) → Fixed deposits (debit) → Transfers.

## Commands

```bash
pnpm demo:generate   # regenerate public/demo-data/seed-data.json
pnpm demo:seed       # open /dev/seed in the browser, then click Load
```

Or open `http://127.0.0.1:3000/dev/seed` and choose **Load seed data**.

The loader refuses to run if any seed Institution id already exists. It is disabled in production builds. Use local development (`DEPLOYMENT_MODE=local`), not `pnpm dev` (cloud mode).
