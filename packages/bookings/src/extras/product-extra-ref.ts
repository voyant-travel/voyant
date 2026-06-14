import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export type ProductExtraSelectionType = "optional" | "required" | "default_selected" | "unavailable"

export type ProductExtraPricingMode =
  | "included"
  | "per_person"
  | "per_booking"
  | "quantity_based"
  | "on_request"
  | "free"

export type ProductExtraCollectionMode =
  | "booking_total"
  | "cash_on_trip"
  | "external"
  | "included"
  | "none"

export const productExtrasRef = pgTable("product_extras", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  supplierId: text("supplier_id"),
  code: text("code"),
  name: text("name").notNull(),
  description: text("description"),
  selectionType: text("selection_type")
    .$type<ProductExtraSelectionType>()
    .notNull()
    .default("optional"),
  pricingMode: text("pricing_mode")
    .$type<ProductExtraPricingMode>()
    .notNull()
    .default("per_booking"),
  pricedPerPerson: boolean("priced_per_person").notNull().default(false),
  collectionMode: text("collection_mode")
    .$type<ProductExtraCollectionMode>()
    .notNull()
    .default("booking_total"),
  showOnSlotManifest: boolean("show_on_slot_manifest").notNull().default(true),
  minQuantity: integer("min_quantity"),
  maxQuantity: integer("max_quantity"),
  defaultQuantity: integer("default_quantity"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type ProductExtraRef = typeof productExtrasRef.$inferSelect
