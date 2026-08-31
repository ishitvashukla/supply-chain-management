# SupplyHub — multi-store supply chain management

Two-way supply chain app: stores raise their own purchase orders, head office
approves and settles them, and both work against one shared product catalog
with per-location pricing and stock.

```
door/
├── backend/    Express + TypeScript + Mongoose (MVC)
└── frontend/   Vite + React + TypeScript + Tailwind + shadcn-style components
```

## Running it

Two terminals, so you see the logs of each:

```bash
# terminal 1
cd backend && npm run dev        # http://localhost:8000

# terminal 2
cd frontend && npm run dev       # http://localhost:3000
```

The frontend proxies `/api` → `localhost:8000`, so there is no CORS setup in dev.

Seed a working dataset (safe to re-run; it clears what it owns first):

```bash
cd backend && npm run seed
```

## Login credentials

These are created by `npm run seed`. Re-running the seed resets them.

| Email | Password | Role |
| --- | --- | --- |
| `admin@cleanops.test` | `Admin@12345` | Admin — all stores, approves orders |
| `alpha@cleanops.test` | `Store@12345` | Store manager — Store Alpha |
| `beta@cleanops.test` | `Store@12345` | Store manager — Store Beta |

Quick check that the API is up and the credentials work:

```bash
curl -i http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  --data-raw '{"email":"admin@cleanops.test","password":"Admin@12345"}'
```

A 200 with a `token` means the backend is healthy. An empty response with exit
code 0 means nothing is listening — start the server rather than debugging the
request.

## Ports

| Port | What | Notes |
| --- | --- | --- |
| 3000 | frontend (vite) | pinned with `strictPort`, so it fails loudly rather than drifting to another port |
| 8000 | backend (express) | |

If vite refuses to start with "port in use" but `lsof -nP -iTCP:3000 -sTCP:LISTEN`
shows nothing, the port is held by half-closed browser sockets from a previous
dev server. Close the stale `localhost:3000` tab (or quit Chrome) and start again.

> Port 8000 rather than 5000: macOS Control Center (AirPlay Receiver) holds
> 5000 and answers requests with a silent 403.

## The catalog hierarchy

Mirrors the structure the customer app already uses, including the case where a
service holds products directly with no category in between:

```
Department
└── PriceList
    └── Service
        ├── Category   (optional)
        │   └── Product
        └── Product    (uncategorised)
```

`Product` is the master item — one definition, shared by every location.
`StoreItem` is the per-location row that makes each store's list different:
its own price override, availability, reorder/critical thresholds and stock on
hand. `GET /api/v1/catalog/tree?storeId=…` returns the whole hierarchy with
that store's prices and stock folded in.

## Roles

| | Admin | Store manager / staff |
| --- | --- | --- |
| Catalog & products | manage | read |
| Stores, users | manage | own store, read |
| Order for a store | any store | own store only |
| Approve / reject / fulfil | yes | no |
| Submit / cancel own order | yes | yes |
| Payments | record & settle | read |
| Stock, expenses | all stores | own store |

Store-scoped users are pinned server-side: whatever `storeId` they send is
ignored in favour of their own, so one store can never read another's data.

## Docs

- [backend/README.md](backend/README.md) — API surface, models, error handling
