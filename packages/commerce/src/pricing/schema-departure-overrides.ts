import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { priceCatalogs } from "./schema-catalogs.js"

/**
 * Per-departure price override.
 *
 * A single departure (availability slot) can opt out of the seasonal
 * priceSchedule layer by setting an explicit per-unit price. Resolved at
 * snapshot time before the option price rules: a unit with an active
 * override on a given departure gets that override's amount; units without
 * an override fall through to the schedule-matched rule.
 *
 * One row per (departure × unit × catalog). Operators wanting a flat
 * whole-departure rate add one row per unit of the option.
 */
export const departurePriceOverrides = pgTable(
  "departure_price_overrides",
  {
    id: typeId("departure_price_overrides"),
    departureId: text("departure_id").notNull(),
    optionId: text("option_id").notNull(),
    optionUnitId: text("option_unit_id").notNull(),
    priceCatalogId: typeIdRef("price_catalog_id")
      .notNull()
      .references(() => priceCatalogs.id, { onDelete: "cascade" }),
    sellAmountCents: integer("sell_amount_cents").notNull(),
    costAmountCents: integer("cost_amount_cents"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_departure_price_overrides_target").on(
      table.departureId,
      table.optionUnitId,
      table.priceCatalogId,
    ),
    index("idx_departure_price_overrides_departure").on(table.departureId, table.active),
    index("idx_departure_price_overrides_option").on(table.optionId, table.active),
    index("idx_departure_price_overrides_catalog").on(table.priceCatalogId, table.active),
  ],
)

export type DeparturePriceOverride = typeof departurePriceOverrides.$inferSelect
export type NewDeparturePriceOverride = typeof departurePriceOverrides.$inferInsert
