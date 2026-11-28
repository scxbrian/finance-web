# API contract

This document is the agreement between `finance-web` and `finance-api`. The two
repositories deploy separately, so neither can see the other's code. When a
response shape changes, this file changes in the same commit on both sides.

## Conventions

These apply to every endpoint. They are listed first because they are the
decisions most expensive to reverse later.

### Money is an integer in minor units

Every amount is a whole number of cents: `234000` means KES 2,340.00. Field
names end in `_minor` so the unit is visible at every use. Floats never appear
in the API, because `0.1 + 0.2` is not `0.3` in floating point and a ledger
cannot tolerate that. The currency is always KES, so it is not repeated in each
response.

### Amounts in transactions are magnitudes; balances are signed

A transaction's `amount_minor` is never negative. Its direction comes from
`kind`: income adds to net worth, expense and fee subtract, and a transfer moves
money between two of the user's own accounts and changes nothing overall. An
account's `balance_minor` is signed, because an overdraft or a Fuliza balance
is genuinely negative.

### Dates are calendar dates in Africa/Nairobi

Dates are `YYYY-MM-DD` strings with no time and no timezone. "Today" and "this
month" are always computed in East Africa Time on the server. If the server
used UTC, anything recorded between midnight and 3 a.m. would land on the
previous day and quietly corrupt the weekly and monthly totals.

### Identifiers are opaque strings

Ids are strings the frontend stores and sends back untouched. The backend may
use UUIDs or integers internally; the frontend must not care.

### Errors share one shape

Any non-2xx response has this body:

```
{ "error": { "code": "validation_error", "message": "Amount must be greater than zero.", "fields": { "amount_minor": "Must be greater than zero." } } }

```

`code` is a stable machine-readable string, `message` is safe to show to a
person, and `fields` is present only for validation errors. FastAPI's default
body is `{"detail": ...}`, so the backend needs an exception handler that
produces this shape. The frontend client tolerates `detail` as a fallback, but
it should never be relied on.

### Authentication and cross-origin requests

In production the browser never calls this API directly. The frontend host
(Vercel) proxies `/api/*` to the API, so every request is same-origin and the
session cookie is first-party. There is therefore no CORS in production. (A
cookie cannot be shared between two unrelated domains: Brave and Safari block
third-party cookies by default.) In local development the frontend and API run
on different ports of localhost, which browsers treat as same-site, so cookies
still work and the API allows the development origin explicitly.

Because a CDN sits in the path, the API sends `Cache-Control: no-store` on
every response. Phone-side SMS forwarders and native mobile clients do not use
the browser path: they call the API's public address directly and authenticate
with a bearer session token or a per-user ingest token. A request without a
valid session gets `401` with code `unauthorized`.

### No version prefix

Paths are `/api/...` with no `/v1`. Until there is more than one client, changes
are additive: new fields may appear and the frontend ignores fields it does not
know. A rename or removal is a breaking change and needs a coordinated release.
The trade-off is that a Vercel deploy is instant while the home server may lag,
so breaking changes must ship backend-first.

## Endpoints

### GET /api/health

Used by the connection indicator. No authentication, no database access.

```
{ "status": "ok" }

```

### GET /api/overview?month=YYYY-MM

Everything the Home screen shows, in one response. It is one request instead of
four because every round trip crosses the tunnel to the home server, and four
sequential waits are noticeably slower than one.

`month` is optional and defaults to the current month.

**What the numbers mean**

* `period` is the span the summary covers. For the current month it ends today;
  for a past month it is the whole month.

* `previous_period` is what the summary is compared against. Comparing a half-way
  month to a whole previous month would make spending look like it fell by half,
  so for the current month the comparison covers the *same number of days* at the
  start of the previous month, clamped to that month's last day.

* `income_minor` is money earned. Transfers between the user's own accounts and
  opening balances are excluded, since neither is earning.

* `expenses_minor` is everything spent, and it includes fees such as M-Pesa
  transaction costs, because they are real costs.

* `saved_minor` is income minus expenses. It can be negative.

* `previous` is `null` when there is no earlier data to compare against, which is
  different from `0`.

* `total_balance_minor` is the sum of every account's balance, as of the end of
  today (Nairobi), and does not depend on `month`. Entries dated later are not
  included yet.

* `recent_transactions` holds at most five entries within `period`, newest first.

**Response**

```
{
  "month": "2026-11",
  "period": { "from": "2026-11-01", "to": "2026-11-15" },
  "previous_period": { "from": "2026-10-01", "to": "2026-10-15" },
  "total_balance_minor": 14695000,
  "accounts": [
    { "id": "acc_mpesa", "name": "M-Pesa", "type": "mpesa", "balance_minor": 1845000 }
  ],
  "summary": {
    "income_minor": 6500000,
    "expenses_minor": 3124000,
    "saved_minor": 3376000,
    "previous": {
      "income_minor": 6200000,
      "expenses_minor": 3680000,
      "saved_minor": 2520000
    }
  },
  "recent_transactions": [
    {
      "id": "tx_1",
      "occurred_on": "2026-11-14",
      "kind": "expense",
      "title": "Naivas",
      "amount_minor": 234000,
      "fee_minor": 0,
      "category": "Groceries",
      "account": { "id": "acc_mpesa", "name": "M-Pesa" },
      "to_account": null,
      "source": "receipt"
    }
  ]
}

```

**Fields**

| Field | Type | Notes | 
| ----- | ----- | ----- | 
| `accounts[].type` | string | `mpesa`, `bank`, `cash`, `savings`, `liability`, `other`. Money market funds are reported as `savings`. The frontend uses it to pick an icon and falls back to a generic one for unknown values. | 
| `recent_transactions[].kind` | string | `income`, `expense`, `fee`, `transfer`, `opening`, `adjustment`. | 
| `recent_transactions[].category` | string or null | `null` for transfers and opening balances. | 
| `recent_transactions[].fee_minor` | integer | `0` when there is no fee. For an expense, `amount_minor` is everything that left the account, fee included. | 
| `recent_transactions[].to_account` | object or null | Set only when `kind` is `transfer`. | 
| `recent_transactions[].source` | string | `manual`, `receipt`, `sms`, `import`. | 

### GET /api/transactions

Query: `month` (YYYY-MM, default current), `kind` (income, expense, transfer, opening,
adjustment), `account` (id), `category` (name), `q` (text, matched in title and note,
case-insensitive), `limit` (1-200, default 100), `offset` (default 0).

Unlike the overview, a list covers the WHOLE month, including days after today, so
something dated tomorrow is visible. Newest first. `total` counts everything matching
the filters, not only this page.

```
{ "month": "2026-11", "period": { "from": "2026-11-01", "to": "2026-11-30" },
  "total": 6, "transactions": [ ...same row shape as recent_transactions... ] }

```

### GET /api/reconcile

Query: `apply_opening` (boolean, default `false`).

Checks chronological mobile-money and MMF messages against ledger running
balances using `balance_after_minor`. When `apply_opening` is `true`, infers and
records a balanced `opening` transaction paired with equity (`Opening Balances`)
without mutating historical entries.

```
{
  "providers": [
    {
      "provider": "mpesa",
      "account_id": "acc_mpesa",
      "opening_transaction_id": null,
      "opening_balance_minor": 7900,
      "checked_messages": 2,
      "mismatches": []
    }
  ]
}

```

## Not yet specified

Creating and reversing transactions, receipt upload and review, SMS and
statement ingestion, scores, and authentication. Each gets a section here
before the frontend or the backend starts on it.

### Features built

* Ledger conventions: integer minor-unit (`_minor`) amounts, signed account
  balances (`mpesa`, `bank`, `cash`, `savings`, `liability`, `other`), magnitude
  `amount_minor` on transactions, `Africa/Nairobi` calendar dates (`YYYY-MM-DD`),
  opaque string IDs, `Cache-Control: no-store`, and standard
  `{ "error": { "code", "message", "fields" } }` error responses.

* Endpoints: `GET /api/health`, `GET /api/overview?month=YYYY-MM` (with
  same-elapsed-day comparison, `fee_minor` on `recent_transactions`, and MMFs
  reported under `savings`), full-month filtered `GET /api/transactions`, and
  `GET /api/reconcile`.

### Features to be built

* Statement and SMS ingestion: ephemeral in-memory (`io.BytesIO`) password-protected
  M-Pesa PDF and bank statement import with zero disk persistence and
  `"raw_file_purged": true` confirmation; multi-bank and multi-vendor parser
  registry; Android SMS auto-parsing plus iOS Shortcut / paste-SMS / statement
  workflows; receipt OCR upload and review.

* Categorization and spend controls: recurring Pochi / Send Money / time-window
  pattern prompts and per-user auto-tagging rules; liquidity sweep and fee
  handling; "Safe-to-Spend Today" daily allowance; Kenyan budget generator and
  payday auto-splitter; 30/90-day fee and Fuliza leak detection; crowdsourced
  local vendor and item price comparison across supermarkets, restaurants,
  pharmacies, hardware stores, and fuel spots.

* Yields, splits and tax lens: Money Market Fund (MMF) daily net interest and
  15% withholding tax (WHT) tracking with monthly balance sync; shareable
  bill-split and Chama links with M-Pesa repayment matching; Kenyan statutory
  tax and payslip decoder (`PAYE`, `SHIF`, `NSSF`, `AHL`, `16% VAT`, EPRA fuel
  levies, `15%` MMF WHT).

* Privacy and account controls: biometric lock, 1-tap balance masking,
  JSON/CSV/PDF exports, live zero-retention audit log, and self-service account
  and data deletion.

### Changes needed in `api-contract.md`

* Auth, sync and idempotency: add bearer session token authentication for
  mobile/offline sync alongside session cookies, per-user SMS ingest tokens,
  and `X-Idempotency-Key` / `client_tx_id` deduplication on write endpoints.

* Transaction and account fields: add optional `occurred_at_time` (`HH:MM:SS` in
  `Africa/Nairobi`), `counterparty_ref`, `counterparty_name`,
  `tax_component_minor`, `tax_type` (`paye`, `shif`, `nssf`, `ahl`, `vat_16`,
  `fuel_levy`, `wht_15`), rule/category `suggestion` hints on transactions, and
  `annual_yield_bps` / `last_accrued_on` on `savings` (MMF) accounts.

* Planned endpoints: specify endpoints for creating and reversing transactions,
  ephemeral statement import (`POST /api/statements/import`), SMS ingestion,
  receipt OCR review, Safe-to-Spend and budget planning, Kenyan tax/payslip
  summary (`GET /api/tax/summary`), local price comparison
  (`GET /api/catalog/compare`), bill/Chama splits (`POST /api/splits`,
  `GET /api/splits/{share_token}`), privacy audit (`GET /api/privacy/audit`),
  and account deletion (`DELETE /users/me`).