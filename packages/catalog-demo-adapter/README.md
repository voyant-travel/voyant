# `@voyantjs/catalog-demo-adapter`

Reference `SourceAdapter` implementation for the catalog booking engine.

The demo adapter is a Postgres-backed `SourceAdapter` that pretends to be an external inventory feed. It exists so the catalog booking lifecycle (`quote` → `book` → `cancel`) is clickable end-to-end on a fresh deployment, before any external integrations (TUI, Hotelbeds, Voyant Connect peers, GDS) are wired up.

It is also the reference implementation other adapter authors copy when building their own `SourceAdapter`.

## What it provides

- A `SourceAdapter` instance with `kind: "demo"`, `verticals: ["products"]` (configurable).
- Two Postgres tables (`catalog_demo_inventory`, `catalog_demo_orders`) registered in `@voyantjs/db`.
- `discover` returns paginated `CatalogProjection`s emitted from `catalog_demo_inventory`.
- `liveResolve` returns each row's current price + availability.
- `reserve` writes a row to `catalog_demo_orders`, decrements the inventory's `available` counter, and returns either `held` or `confirmed` based on the request's `paymentIntent`.
- `cancel` flips the order's status, restores the counter, and returns a refund equal to the original price.
- A `seedDemoInventory` helper plus a default three-row starter set.

It does **not** implement `freshnessCheck` (no upstream to check) or `onDrift` (no drift to detect).

## Usage

```ts
import { createDemoAdapter, seedDemoInventory, defaultDemoInventory } from "@voyantjs/catalog-demo-adapter"

// At process start
const adapter = createDemoAdapter({ getDb: () => db })
registry.register(adapter)

// First-boot seed (idempotent)
await seedDemoInventory(db, defaultDemoInventory)
```

Templates that don't want demo data simply skip both calls; the `catalog_demo_*` tables remain empty.

## Source kind

Every projection emits `source.kind: "demo"` and `source.ref: <inventory.id>`. The catalog UI's "Source" column renders this as **Demo**.

## Schema

Add `@voyantjs/catalog-demo-adapter/schema` to the template's `drizzle.config.ts` so the two tables are included in `db:generate` / `db:push`. Templates that don't register the adapter shouldn't include the schema.

## License

Apache-2.0
