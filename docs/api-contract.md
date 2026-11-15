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

```json
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
every response. Phone-side SMS forwarders do not use the browser path: they
call the API's public address directly and authenticate with a per-user ingest
token. A request without a valid session gets `401` with code `unauthorized`.

### No version prefix

Paths are `/api/...` with no `/v1`. Until there is more than one client, changes
are additive: new fields may appear and the frontend ignores fields it does not
know. A rename or removal is a breaking change and needs a coordinated release.
The trade-off is that a Vercel deploy is instant while the home server may lag,
so breaking changes must ship backend-first.

## Endpoints

### GET /api/health

Used by the connection indicator. No authentication, no database access.

```json
{ "status": "ok" }
```

### GET /api/overview?month=YYYY-MM

Everything the Home screen shows, in one response. It is one request instead of
four because every round trip crosses the tunnel to the home server, and four
sequential waits are noticeably slower than one.

`month` is optional and defaults to the current month.

**What the numbers mean**

- `period` is the span the summary covers. For the current month it ends today;
  for a past month it is the whole month.
- `previous_period` is what the summary is compared against. Comparing a half-way
  month to a whole previous month would make spending look like it fell by half,
  so for the current month the comparison covers the *same number of days* at the
  start of the previous month, clamped to that month's last day.
- `income_minor` is money earned. Transfers between the user's own accounts and
  opening balances are excluded, since neither is earning.
- `expenses_minor` is everything spent, and it includes fees such as M-Pesa
  transaction costs, because they are real costs.
- `saved_minor` is income minus expenses. It can be negative.
- `previous` is `null` when there is no earlier data to compare against, which is
  different from `0`.
- `total_balance_minor` is the sum of every account's balance, as of now, and
  does not depend on `month`.
- `recent_transactions` holds at most five entries, newest first.

**Response**

```json
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
| ----- | ---- | ----- |
| `accounts[].type` | string | `mpesa`, `bank`, `cash`, `savings`. The frontend uses it to pick an icon and falls back to a generic one for unknown values. |
| `recent_transactions[].kind` | string | `income`, `expense`, `fee`, `transfer`. |
| `recent_transactions[].category` | string or null | `null` for transfers. |
| `recent_transactions[].to_account` | object or null | Set only when `kind` is `transfer`. |
| `recent_transactions[].source` | string | `manual`, `receipt`, `sms`, `import`. |

## Not yet specified

Ledger listing and filtering, creating and reversing transactions, receipt
upload and review, SMS and statement ingestion, scores, and authentication. Each
gets a section here before the frontend or the backend starts on it.