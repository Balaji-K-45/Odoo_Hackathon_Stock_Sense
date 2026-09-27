# StockSense API Handoff

Base URL: `http://localhost:5000`

Authenticated requests use `Authorization: Bearer <token>`. JSON endpoints return `{ "success": true, "message": "...", "data": ... }` on success and `{ "success": false, "message": "..." }` on errors. Signup creates `WAREHOUSE_STAFF` accounts only; manager accounts must be provisioned through a trusted process.

## Authentication

| Endpoint | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/auth/signup` | POST | Public | Create a staff account |
| `/api/auth/verify-signup-otp` | POST | Public | Verify a new account's email address |
| `/api/auth/login` | POST | Public | Authenticate and receive a JWT |
| `/api/auth/me` | GET | Any authenticated role | Get the current user profile |
| `/api/auth/profile` | GET | Any authenticated role | Existing alias for `/me` |
| `/api/auth/forgot-password` | POST | Public | Request password-reset OTP |
| `/api/auth/verify-otp` | POST | Public | Verify reset OTP |
| `/api/auth/reset-password` | POST | Public | Set a new password |
| `/api/auth/change-password` | POST | Any authenticated role | Change password after verifying the current password |

Signup body: `{ "name": "A User", "email": "user@example.com", "password": "secret" }`. A submitted `role` is ignored. Signup creates an unverified staff account and sends a 6-digit verification code; it returns HTTP 202 without an authentication token. If delivery needs to be retried, submit the same email and password again while the account remains unverified. Verify with `{ "email": "user@example.com", "otp": "<email code>" }` at `/api/auth/verify-signup-otp`; codes expire after 10 minutes, allow at most 5 attempts, are single-use, and can be resent no more than once every 30 seconds. Login is blocked until verification succeeds. Login body: `{ "email": "user@example.com", "password": "secret" }`. Login returns `data.token` and `data.user`, including `id`, `name`, `email`, and `role`.

Signup verification and forgot-password emails require authenticated SMTP configuration. OTP values are HMAC-hashed in the existing `otp_tokens` table, purpose-scoped, expire after 10 minutes using the database clock, allow at most 5 attempts, and are invalidated if delivery fails. Resending is limited to one request per email/purpose every 30 seconds; `429` responses include `Retry-After`. Forgot-password returns the same generic response for registered and unregistered emails to avoid account enumeration; an unregistered address receives no email.

For password reset, verify using `{ "email": "user@example.com", "otp": "<email code>" }` at `/api/auth/verify-otp`. A successful verification consumes the OTP and returns a short-lived `data.reset_token`; the frontend keeps this token in memory, not in the URL. Set a new password using `{ "email": "user@example.com", "reset_token": "<reset token>", "new_password": "..." }` at `/api/auth/reset-password`. The reset grant is HMAC-hashed, expires after 10 minutes, and is single-use. A successful reset returns a JWT and user so the frontend can establish the normal session and navigate to the dashboard. The backend rejects direct reset requests without a valid grant. Change-password body: `{ "current_password": "...", "new_password": "..." }`; new passwords require at least 8 characters.

## Inventory APIs

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/products` | GET | Both | List/search products; accepts `search`, `category_id` |
| `/api/products/<id>` | GET | Both | Get product and per-location totals |
| `/api/products` | POST | Manager | Create product |
| `/api/products/<id>` | PUT, DELETE | Manager | Update or delete product |
| `/api/categories` | GET | Both | List categories |
| `/api/categories` | POST | Manager | Create category |
| `/api/warehouses` | GET | Both | List warehouses |
| `/api/warehouses` | POST | Manager | Create warehouse |
| `/api/warehouses/<id>` | DELETE | Manager | Delete an unused warehouse; returns 409 if stock or operation history references it |
| `/api/locations` | GET | Both | List locations; accepts `warehouse_id` |
| `/api/locations` | POST | Manager | Create location |
| `/api/stock` | GET | Both | List balances; accepts `product_id`, `location_id`, `warehouse_id`, `category_id` |
| `/api/dashboard` | GET | Both | KPIs, low/out-of-stock counts, and recent stock activity |
| `/api/analysis` | GET | Manager | 12-month operation trends, stock health, top stock balances, 90-day delivery rankings, and 14-day activity |
| `/api/ledger` | GET | Both | Stock history; accepts `product_id`, `operation_type`, `location_id`, `limit` |

Product body: `{ "name": "Steel Rod", "sku": "STEEL-001", "category_id": 1, "uom": "kg", "reorder_level": 10 }`.

## Stock Operations

The current POST endpoints validate and apply stock immediately; they do not create drafts or separate validation actions.

| Endpoint | Method | Role | Request body |
| --- | --- | --- | --- |
| `/api/receipts` | POST | Both | `{ "product_id": 1, "location_id": 1, "quantity": 50, "reference": "PO-1", "notes": "..." }` |
| `/api/deliveries` | POST | Both | `{ "product_id": 1, "location_id": 1, "quantity": 20, "reference": "DO-1", "notes": "..." }` |
| `/api/transfers` | POST | Both | `{ "product_id": 1, "source_location_id": 1, "destination_location_id": 2, "quantity": 10, "reference": "TR-1", "notes": "..." }` |
| `/api/adjustments` | POST | Both | `{ "product_id": 1, "location_id": 1, "physical_count": 97, "reference": "COUNT-1", "notes": "..." }` |

Each operation collection supports GET; receipts, deliveries, and transfers also support GET `/api/<operation>/<id>`. Adjustments currently have no single-operation GET route. Deliveries and transfers reject insufficient source stock with HTTP 400. Every committed stock change writes operation data and ledger entries in one transaction; transfers write both a negative source entry and a positive destination entry. The authenticated user ID is taken from the token, not the request body.

## Permissions and Errors

Both roles can view products, read stock, view dashboard/ledger, and create or list receipts, deliveries, transfers, and adjustments. Only `INVENTORY_MANAGER` can mutate products or create categories, warehouses, and locations. Authenticated role failures return HTTP 403; missing or invalid authentication returns HTTP 401. Other expected statuses include 200, 201, 202, 400, 404, 409, 429 (OTP resend cooldown), and 503 (SMTP unavailable).

Example frontend call:

```js
const response = await fetch("http://localhost:5000/api/stock?warehouse_id=1", {
  headers: { Authorization: `Bearer ${token}` },
});
const result = await response.json();
```

Set `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, a strong `SECRET_KEY`, and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `SMTP_USE_TLS` in `backend/.env`. For Gmail, use an App Password in `SMTP_PASSWORD`, not the account's login password. See `backend/.env.example`. Initialize the schema with the project’s schema initialization path, then run `python app.py` from `backend`; the development server listens on `127.0.0.1:5000`.