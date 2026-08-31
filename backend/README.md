# Door — Backend

Express + TypeScript + Mongoose API using an MVC layout.

## Setup

```bash
npm install
cp .env.example .env   # already created; fill in real values
npm run dev            # nodemon + tsx, restarts on any change under src/
```

Server: `http://localhost:8000` — API base `http://localhost:8000/api/v1`

> Port 8000, not 5000: macOS Control Center (AirPlay Receiver) holds port 5000
> and silently answers requests with 403.

## Database

The database name is the path segment in `MONGO_URI`, right before the `?`:

```
mongodb+srv://user:pass@cluster.mongodb.net/door_dev?retryWrites=true&w=majority
                                                    ^^^^^^^^
```

This app uses `door_dev`. The same cluster also hosts `feature-request-platform`
(existing production collections) and `test`; neither is touched. To point at a
different database, edit that path segment. `GET /api/v1/health` reports the
database actually connected, so a misconfiguration is visible immediately.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | nodemon watching `src/`, runs TS directly via tsx |
| `npm run build` | compile TypeScript to `dist/` |
| `npm start` | run the compiled build |
| `npm run typecheck` | type check without emitting |
| `npm run clean` | delete `dist/` |

## Structure

```
src/
├── config/        env loading + validation, Mongo connection
├── models/        Mongoose schemas          (M)
├── controllers/   request/response handling (C)
├── services/      business logic + all DB access
├── routes/        route -> middleware -> controller wiring
├── validators/    per-route input rules
├── middlewares/   errorHandler, notFound, validate
├── utils/         ApiError, ApiResponse, asyncHandler, logger, date
├── app.ts         express app assembly
└── server.ts      startup, graceful shutdown
```

Request flow: `route → validate → controller → service → model`.
Controllers never touch the DB directly; services never touch `req`/`res`.

## Adding a new API

1. `src/models/thing.model.ts` — schema + `IThing` interface
2. `src/services/thing.service.ts` — DB operations, throw `ApiError` for 4xx cases
3. `src/controllers/thing.controller.ts` — wrap each handler in `asyncHandler`, respond with `sendSuccess`
4. `src/validators/thing.validator.ts` — return `ValidationIssue[]`
5. `src/routes/thing.routes.ts` — wire it up
6. Register it in `src/routes/index.ts`: `router.use('/things', thingRoutes)`

`src/models/user.model.ts` and its service/controller/route/validator are a
complete working example of that pattern (`/api/v1/users`, full CRUD).

## Responses

Success:
```json
{ "success": true, "message": "Users fetched", "data": [], "meta": { "page": 1 } }
```

Error (`stack` only outside production):
```json
{ "success": false, "message": "Validation failed", "details": [{ "field": "email", "message": "a valid email is required" }] }
```

## Error handling

`src/middlewares/errorHandler.ts` is the single exit point for every error. It
translates into the shape above:

| Cause | Status |
| --- | --- |
| `ApiError.badRequest/unauthorized/forbidden/notFound/conflict` | as thrown |
| Mongoose `ValidationError` | 400 with per-field details |
| Mongoose `CastError` (bad ObjectId) | 400 |
| Mongo duplicate key (`11000`) | 409 |
| Malformed JSON body | 400 |
| Anything else | 500, message hidden in production |

Async controllers must be wrapped in `asyncHandler` so rejections reach it.

## Dates

Always use `src/utils/date.ts` (dayjs with utc, timezone, relativeTime,
duration, customParseFormat, isSameOrBefore/After preloaded) rather than
`new Date()`, so formatting and timezone handling stay consistent.

## Endpoints

All under `/api/v1`. Everything except `/health` and `/auth/login` needs
`Authorization: Bearer <token>`.

| Method | Path | Who |
| --- | --- | --- |
| POST | `/auth/login` | public |
| POST | `/auth/register` | admin |
| GET | `/auth/me` · POST `/auth/change-password` | any |
| GET/PATCH/DELETE | `/users`, `/users/:id` | admin |
| GET | `/stores`, `/stores/:id` | any (scoped) |
| POST/PATCH/DELETE | `/stores`, `/stores/:id` | admin |
| GET | `/catalog/tree?storeId=&priceListId=` | any |
| CRUD | `/catalog/departments`, `/price-lists`, `/services`, `/categories` | read any, write admin |
| CRUD | `/products` | read any, write admin |
| GET/POST | `/stores/:storeId/items` | scoped |
| POST | `/stores/:storeId/items/sync` | scoped |
| PATCH/DELETE | `/store-items/:id` | scoped |
| POST | `/stores/:storeId/stock` | scoped |
| POST | `/stores/:storeId/stock/recompute-usage` | scoped |
| GET | `/inventory/movements`, `/inventory/low-stock` | scoped |
| GET/POST | `/orders`, `/orders/:id` | scoped |
| PATCH | `/orders/:id` | drafts only |
| POST | `/orders/:id/status` | store: PENDING/CANCELLED · admin: all |
| GET | `/orders/pending-approval` | scoped |
| GET/POST | `/payments` | read scoped, write admin |
| PATCH/DELETE | `/payments/:id/status`, `/payments/:id` | admin |
| GET | `/payments/outstanding` | admin |
| CRUD | `/expenses` · GET `/expenses/breakdown` | scoped |
| GET | `/stats/overview`, `/order-trend`, `/orders-by-status`, `/top-consumed`, `/reorder-forecast`, `/financials` | scoped |

## Sessions and refresh

Access tokens last **3 days**; refresh tokens **30 days**, and are signed with a
*different* secret so a leaked access token can never be replayed as a refresh
token.

Refresh uses **rotation**: every call retires the presented token and issues a
brand new pair, recorded in the `refreshtokens` collection (SHA-256 digest only
— the raw token is never stored, and a TTL index drops expired rows).

Each revocation records *why*, which is what keeps the two failure modes apart:

| Replayed token | Revoked reason | Result |
| --- | --- | --- |
| Rotated, within `REFRESH_GRACE_SECONDS` | `ROTATED` | Accepted — concurrent tabs are normal |
| Rotated, after the grace window | `ROTATED` | Treated as theft: **every** session for the user is revoked |
| Retired by sign-out | `LOGOUT` | Rejected alone; the account's other devices keep working |
| Retired by an admin revoke | `REVOKED` | Rejected alone |

`POST /auth/logout` signs out just the device whose `refreshToken` it is given;
pass `allDevices: true` to revoke every session.

When a refresh finally fails, the client clears **both** the turns and door
sessions and signs the user out — a half-authenticated state where some screens
work and others 401 is never allowed.

## Order state machine

`transition()` is the only way a status changes, and every move is checked
against this table:

```
DRAFT     → PENDING, CANCELLED
PENDING   → APPROVED, REJECTED, CANCELLED
APPROVED  → FULFILLED, CANCELLED
REJECTED  → (final)
FULFILLED → (final)
CANCELLED → (final)
```

Reaching `FULFILLED` is what receives stock: it writes a `RECEIPT` movement per
line and raises each `StoreItem.quantityOnHand`.

## Stock

`StoreItem.quantityOnHand` is the running total; `StockMovement` is the
append-only ledger behind it. Both are written together in `stock.service`, so
they cannot drift, and quantity is never patched directly through the store-item
endpoint. Outbound movements feed `avgDailyUsage`, which drives the reorder
forecast.

## Models

`User` · `Store` · `Department` · `PriceList` · `Service` · `Category` ·
`Product` · `StoreItem` · `Order` · `Payment` · `StockMovement` · `Expense` ·
`Counter` (atomic `PO-#####` / `PAY-#####` sequences).

## Notes on Mongoose 9

- Middleware takes **no `next` callback** — hooks are plain/async functions that
  throw to abort.
- `FilterQuery` is now `QueryFilter`.
- `{ new: true }` is deprecated in favour of `{ returnDocument: 'after' }`.
