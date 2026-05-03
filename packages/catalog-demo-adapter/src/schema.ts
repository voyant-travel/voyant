/**
 * Schema for the catalog demo adapter.
 *
 * The demo adapter is a `SourceAdapter` whose "upstream" is just two
 * Postgres tables in the operator's own database. It exists for two
 * reasons:
 *
 *   1. **First-day demo source.** Even on a clean operator deployment with
 *      no external integrations wired, the catalog page can show a row
 *      with `source.kind: "demo"` and the booking engine lifecycle
 *      (quote → book → cancel) is clickable end-to-end.
 *   2. **Reference for adapter authors.** The shape of these two tables
 *      mirrors what an external adapter (TUI, Hotelbeds, Voyant Connect
 *      peer) would model in its own system: a discovery feed of bookable
 *      rows + an order book of upstream reservations.
 *
 * Both tables are owned by this package. Templates that don't register
 * the demo adapter shouldn't include this schema in their `drizzle.config.ts`.
 */

import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Inventory rows the demo adapter publishes to the catalog plane.
 *
 * Each row becomes one `CatalogProjection` when `discover()` runs, with
 * `entity_module` mapped via the adapter's vertical configuration
 * (defaulting to `"products"` for the tracer). The `priceCents` and
 * `available` columns drive the `liveResolve` response.
 *
 * `metadata` is a free-form JSONB blob for vertical-specific fields the
 * caller may need at quote/book time (e.g. capacity, day-services). The
 * tracer ignores it; richer integrations populate it.
 */
export const catalogDemoInventory = pgTable(
  "catalog_demo_inventory",
  {
    id: typeId("catalog_demo_inventory"),
    /** Vertical this row feeds into. Defaults to "products" for the tracer. */
    entityModule: text("entity_module").notNull().default("products"),
    /** Display name surfaced in the catalog UI. */
    name: text("name").notNull(),
    description: text("description"),
    /** Sell price at quote time. Integer cents to match the rest of the catalog plane. */
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    /** When false, `liveResolve` returns this row as `failed[id] = "not_found"`. */
    available: integer("available").notNull().default(1),
    /** Free-form payload echoed back into the snapshot's frozen-payload column. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_catalog_demo_inventory_module").on(table.entityModule),
    index("idx_catalog_demo_inventory_available_module").on(table.available, table.entityModule),
  ],
)

export type CatalogDemoInventoryRow = typeof catalogDemoInventory.$inferSelect
export type NewCatalogDemoInventoryRow = typeof catalogDemoInventory.$inferInsert

/**
 * Orders the demo adapter creates when `reserve()` is called.
 *
 * `status` follows the `SourceAdapter.reserve` result vocabulary:
 *   - `"held"` — `paymentIntent.type === "hold"` was requested.
 *   - `"confirmed"` — default; the booking is fully committed upstream.
 *   - `"cancelled"` — `cancel()` flipped this row's status.
 *
 * `inventoryId` is a soft FK — `onDelete: "set null"` — because the demo
 * lets templates clean up inventory rows without nuking the order history.
 */
export const catalogDemoOrders = pgTable(
  "catalog_demo_orders",
  {
    id: typeId("catalog_demo_orders"),
    inventoryId: typeIdRef("inventory_id").references(() => catalogDemoInventory.id, {
      onDelete: "set null",
    }),
    /** Mirrors what the adapter received in `reserve.entity_id`. */
    entityId: text("entity_id").notNull(),
    entityModule: text("entity_module").notNull(),
    status: text("status").notNull().default("confirmed"),
    /** Frozen at reserve time so cancellation refunds the original price. */
    pricedCents: integer("priced_cents").notNull(),
    currency: text("currency").notNull(),
    /** Customer / passenger payload echoed back from the reserve request. */
    party: jsonb("party").$type<Record<string, unknown>>(),
    /** Whatever payment intent was passed; recorded but not actually charged. */
    paymentIntent: jsonb("payment_intent").$type<Record<string, unknown>>(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledReason: text("cancelled_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_catalog_demo_orders_status_created").on(table.status, table.createdAt),
    index("idx_catalog_demo_orders_entity").on(table.entityId, table.entityModule),
    index("idx_catalog_demo_orders_inventory").on(table.inventoryId),
  ],
)

export type CatalogDemoOrderRow = typeof catalogDemoOrders.$inferSelect
export type NewCatalogDemoOrderRow = typeof catalogDemoOrders.$inferInsert
