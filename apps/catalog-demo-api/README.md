# `catalog-demo-api`

Standalone HTTP service that mocks an upstream catalog source so starters
and examples can exercise the full booking lifecycle (`quote → book →
cancel`) without external credentials. Mirrors `SourceAdapter` 1:1 over
REST; the `@voyant-travel/plugin-catalog-demo` package is a thin fetch client
that implements the adapter interface against this service.

Owns its own Postgres database — inventory and orders persist here, not
in the operator starter's primary DB. Replace it with a real upstream
(TUI direct, Hotelbeds, a Voyant Connect peer) by swapping the plugin —
no starter tables to drop.

## Run

```bash
cp .env.example .env        # default points at the docker-compose Postgres
docker compose up -d        # spins up Postgres on :5437
pnpm db:migrate             # creates catalog_demo_inventory + catalog_demo_orders
pnpm dev                    # listens on :3330 by default
```

Then in your operator starter (e.g. `starters/operator/.env`):

```
CATALOG_DEMO_API_URL=http://localhost:3330
```

When `AUTO_SEED=true` (the default in `.env.example`), the service seeds
three default inventory rows on first boot — the catalog booking lifecycle
is clickable immediately. Set `AUTO_SEED=false` when running against a
hand-curated dataset.

## Endpoints

Each maps 1:1 to a `SourceAdapter` method.

| Method | Path                       | Adapter method        |
| ------ | -------------------------- | --------------------- |
| POST   | `/discover`                | `discover`            |
| POST   | `/live-resolve`            | `liveResolve`         |
| POST   | `/reserve`                 | `reserve`             |
| POST   | `/cancel`                  | `cancel`              |
| GET    | `/health`                  | (liveness probe)      |
| GET    | `/inventory`               | admin: list inventory |
| POST   | `/inventory/seed`          | admin: re-seed defaults |
| GET    | `/orders/:id`              | admin: read one order |

Bodies and response shapes match the catalog plane's contract types from
`@voyant-travel/catalog/adapter/contract` — `CatalogProjection`,
`LiveResolveRequest` / `LiveResolveResult`, `ReserveRequest` /
`ReserveResult`, `CancelResult`. CORS is permissive so the operator
starter can call the service from a worker and ops users can hit
`/inventory` from a browser tab — production upstreams obviously lock
this down.

## License

Apache-2.0
