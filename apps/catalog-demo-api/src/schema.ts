/**
 * Schema for the catalog demo API.
 *
 * Both tables live in the demo service's own Postgres — they're not
 * mounted in the operator template's primary DB. A real upstream
 * source (TUI, Hotelbeds, a Voyant Connect peer) wouldn't share its
 * inventory and order tables with the operator either; the demo mirrors
 * that posture so the swap from `demo` → `voyant-connect` is purely an
 * adapter URL change.
 *
 * `entityModule` is stamped on every inventory row so the discover
 * endpoint can emit projections for the right vertical (defaulting to
 * `"products"` for the tracer scope).
 */

import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const catalogDemoInventory = pgTable(
  "catalog_demo_inventory",
  {
    id: typeId("catalog_demo_inventory"),
    entityModule: text("entity_module").notNull().default("products"),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    /** When 0, `liveResolve` returns this row as `failed[id] = "not_found"`. */
    available: integer("available").notNull().default(1),
    /** Free-form payload the booking engine echoes into the snapshot's frozenPayload. */
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

export const catalogDemoOrders = pgTable(
  "catalog_demo_orders",
  {
    id: typeId("catalog_demo_orders"),
    inventoryId: typeIdRef("inventory_id").references(() => catalogDemoInventory.id, {
      onDelete: "set null",
    }),
    /** Mirrors `reserve.entity_id` from the booking engine. */
    entityId: text("entity_id").notNull(),
    entityModule: text("entity_module").notNull(),
    status: text("status").notNull().default("confirmed"),
    /** Frozen at reserve time so cancel refunds the original price. */
    pricedCents: integer("priced_cents").notNull(),
    currency: text("currency").notNull(),
    party: jsonb("party").$type<Record<string, unknown>>(),
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
