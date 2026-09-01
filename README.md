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

## Signing in

Accounts live in the **turns** backend, not here. Sign in with your business id,
then a role (Admin, Employee or Store) and your turns credentials — there is no
local sign-up, and vendor login is deliberately not offered.

Two sessions are held side by side: the turns session, and this app's own. Both
refresh independently, and if either expires and cannot be refreshed you are
signed out of both — a half-authenticated state where some screens work and
others 401 is never allowed.

## Deploying

The API and the web app ship as **one process**: the build puts the SPA under
`backend/public/client`, and the server serves it alongside `/api/v1`. That
means one URL, one certificate, no CORS, and nothing to keep in step between two
deployments.

```bash
npm run install:all   # install both workspaces
npm run build         # build SPA → copy into backend → compile API
npm start             # serve everything on $PORT
```

### Free hosting

`render.yaml` is a Render blueprint on the **free** plan — point Render at the
repo and it picks it up. A free service sleeps after ~15 minutes idle and takes
~30s to wake, which is fine for testing. Set `MONGO_URI` in the dashboard (the
JWT secrets are generated for you).

The `Dockerfile` is plain multi-stage Docker, so Fly.io, Railway or Koyeb work
equally well. To deploy without Docker at all, use build `npm run install:all &&
npm run build` and start `npm start`.

Required environment: `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`. The turns
values have working defaults — see `backend/.env.example`.

### Why turns is proxied

The browser never calls turns directly. Turns only returns CORS headers for
allowlisted origins, and a deployed origin is not one of them, so calls are
relayed through `/api/v1/turns/:businessId/*`. The relay refuses any host
outside `turnsapp.com` / `sifabso.com`, so it cannot be used as an open proxy.
Dev and production behave identically as a result.

## Tests

```bash
cd backend  && npm test     # vitest + in-memory MongoDB
cd frontend && npm test     # vitest + jsdom
```

Both run on every push via `.github/workflows/ci.yml`, alongside a typecheck
and a build. Backend tests use `mongodb-memory-server`, so they never touch a
real database.

## What comes from turns, and what lives here

Turns owns **stores** and the **classification** — department, price list,
service, category — and both are mirrored in on sign-in. Materials are added in
this app; turns is not asked for them, because its product catalog is the
laundry service catalog used by the main app, which is a different domain.

```
Department
└── PriceList          (per store)
    └── Service        (belongs to SEVERAL price lists)
        ├── Category   (optional)
        │   └── Item   (a material — added here)
        └── Item       (uncategorised)
```

Creating an item walks that cascade: picking a **store** loads its price lists
live from turns, which opens its services, which opens their categories.

`Product` is the shared catalog record; **`StoreItem`** is the per-location row
that makes each store's list different — its own price, availability, reorder
points and stock on hand. An item is described as a pack: `packSize` + `unit`,
so a material reads as "5 L", "100 pieces" or "25 kg".

## Images

Screenshots and receipts are stored inline as base64 on the document, which
keeps the deployment to one database and no object store. Two things make that
safe:

- The client downscales to 1000px and steps quality down (WebP where supported)
  until the result is under ~120KB — a ~40× reduction on a typical screenshot.
- The API caps an image at 1MB and rejects anything that is not a real image,
  including `data:` URLs of other types.

Image fields are `select: false`, so list endpoints never carry them; they are
returned only on the detail endpoint that needs them.

## Roles

| | Admin | Store manager / staff |
| --- | --- | --- |
| Catalog & items | manage | read |
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
