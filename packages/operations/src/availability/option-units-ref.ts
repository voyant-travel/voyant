import { integer, pgTable, text } from "drizzle-orm/pg-core"

/** Minimal reference to option_units for per-unit availability derivation. */
export const optionUnitsRef = pgTable("option_units", {
  id: text("id").primaryKey(),
  optionId: text("option_id").notNull(),
  name: text("name").notNull(),
  maxQuantity: integer("max_quantity"),
  occupancyMax: integer("occupancy_max"),
  sortOrder: integer("sort_order").notNull().default(0),
})
