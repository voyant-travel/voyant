import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const extraSelectionTypeEnum = pgEnum("extra_selection_type", [
  "optional",
  "required",
  "default_selected",
  "unavailable",
])

export const extraPricingModeEnum = pgEnum("extra_pricing_mode", [
  "included",
  "per_person",
  "per_booking",
  "quantity_based",
  "on_request",
  "free",
])

export const extraCollectionModeEnum = pgEnum("extra_collection_mode", [
  "booking_total",
  "cash_on_trip",
  "external",
  "included",
  "none",
])

export const productExtras = pgTable(
  "product_extras",
  {
    id: typeId("product_extras"),
    productId: text("product_id").notNull(),
    supplierId: text("supplier_id"),
    code: text("code"),
    name: text("name").notNull(),
    description: text("description"),
    selectionType: extraSelectionTypeEnum("selection_type").notNull().default("optional"),
    pricingMode: extraPricingModeEnum("pricing_mode").notNull().default("per_booking"),
    pricedPerPerson: boolean("priced_per_person").notNull().default(false),
    collectionMode: extraCollectionModeEnum("collection_mode").notNull().default("booking_total"),
    showOnSlotManifest: boolean("show_on_slot_manifest").notNull().default(true),
    minQuantity: integer("min_quantity"),
    maxQuantity: integer("max_quantity"),
    defaultQuantity: integer("default_quantity"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_product_extras_sort_name").on(table.sortOrder, table.name),
    index("idx_product_extras_product_sort_name").on(table.productId, table.sortOrder, table.name),
    index("idx_product_extras_supplier_sort_name").on(
      table.supplierId,
      table.sortOrder,
      table.name,
    ),
    index("idx_product_extras_active_sort_name").on(table.active, table.sortOrder, table.name),
    uniqueIndex("uidx_product_extras_product_code").on(table.productId, table.code),
  ],
)

export const optionExtraConfigs = pgTable(
  "option_extra_configs",
  {
    id: typeId("option_extra_configs"),
    optionId: text("option_id").notNull(),
    productExtraId: typeIdRef("product_extra_id")
      .notNull()
      .references(() => productExtras.id, { onDelete: "cascade" }),
    selectionType: extraSelectionTypeEnum("selection_type"),
    pricingMode: extraPricingModeEnum("pricing_mode"),
    pricedPerPerson: boolean("priced_per_person"),
    minQuantity: integer("min_quantity"),
    maxQuantity: integer("max_quantity"),
    defaultQuantity: integer("default_quantity"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_option_extra_configs_sort_default").on(table.sortOrder, table.isDefault),
    index("idx_option_extra_configs_option_sort_default").on(
      table.optionId,
      table.sortOrder,
      table.isDefault,
    ),
    index("idx_option_extra_configs_extra_sort_default").on(
      table.productExtraId,
      table.sortOrder,
      table.isDefault,
    ),
    index("idx_option_extra_configs_active_sort_default").on(
      table.active,
      table.sortOrder,
      table.isDefault,
    ),
    uniqueIndex("uidx_option_extra_configs_option_extra").on(table.optionId, table.productExtraId),
  ],
)

export type ProductExtra = typeof productExtras.$inferSelect
export type NewProductExtra = typeof productExtras.$inferInsert
export type OptionExtraConfig = typeof optionExtraConfigs.$inferSelect
export type NewOptionExtraConfig = typeof optionExtraConfigs.$inferInsert

export const productExtrasRelations = relations(productExtras, ({ many }) => ({
  optionConfigs: many(optionExtraConfigs),
}))

export const optionExtraConfigsRelations = relations(optionExtraConfigs, ({ one }) => ({
  productExtra: one(productExtras, {
    fields: [optionExtraConfigs.productExtraId],
    references: [productExtras.id],
  }),
}))

export {
  EXTRAS_CONTENT_MARKET_ANY,
  type ExtrasSourcedContentFetchStatus,
  extrasSourcedContentTable,
  type InsertExtrasSourcedContent,
  type SelectExtrasSourcedContent,
} from "./schema-sourced-content.js"
