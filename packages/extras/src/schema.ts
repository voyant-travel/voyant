import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
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

export const bookingExtraStatusEnum = pgEnum("booking_extra_status", [
  "draft",
  "selected",
  "confirmed",
  "cancelled",
  "fulfilled",
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

export const bookingExtras = pgTable(
  "booking_extras",
  {
    id: typeId("booking_extras"),
    bookingId: text("booking_id").notNull(),
    productExtraId: typeIdRef("product_extra_id").references(() => productExtras.id, {
      onDelete: "set null",
    }),
    optionExtraConfigId: typeIdRef("option_extra_config_id").references(
      () => optionExtraConfigs.id,
      {
        onDelete: "set null",
      },
    ),
    name: text("name").notNull(),
    description: text("description"),
    status: bookingExtraStatusEnum("status").notNull().default("draft"),
    pricingMode: extraPricingModeEnum("pricing_mode").notNull().default("per_booking"),
    pricedPerPerson: boolean("priced_per_person").notNull().default(false),
    quantity: integer("quantity").notNull().default(1),
    sellCurrency: text("sell_currency").notNull(),
    unitSellAmountCents: integer("unit_sell_amount_cents"),
    totalSellAmountCents: integer("total_sell_amount_cents"),
    costCurrency: text("cost_currency"),
    unitCostAmountCents: integer("unit_cost_amount_cents"),
    totalCostAmountCents: integer("total_cost_amount_cents"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_booking_extras_updated").on(table.updatedAt),
    index("idx_booking_extras_booking_updated").on(table.bookingId, table.updatedAt),
    index("idx_booking_extras_product_extra_updated").on(table.productExtraId, table.updatedAt),
    index("idx_booking_extras_option_extra_config_updated").on(
      table.optionExtraConfigId,
      table.updatedAt,
    ),
    index("idx_booking_extras_status_updated").on(table.status, table.updatedAt),
  ],
)

export type ProductExtra = typeof productExtras.$inferSelect
export type NewProductExtra = typeof productExtras.$inferInsert
export type OptionExtraConfig = typeof optionExtraConfigs.$inferSelect
export type NewOptionExtraConfig = typeof optionExtraConfigs.$inferInsert
export type BookingExtra = typeof bookingExtras.$inferSelect
export type NewBookingExtra = typeof bookingExtras.$inferInsert

export const productExtrasRelations = relations(productExtras, ({ many }) => ({
  optionConfigs: many(optionExtraConfigs),
  bookingExtras: many(bookingExtras),
}))

export const optionExtraConfigsRelations = relations(optionExtraConfigs, ({ one, many }) => ({
  productExtra: one(productExtras, {
    fields: [optionExtraConfigs.productExtraId],
    references: [productExtras.id],
  }),
  bookingExtras: many(bookingExtras),
}))

export const bookingExtrasRelations = relations(bookingExtras, ({ one }) => ({
  productExtra: one(productExtras, {
    fields: [bookingExtras.productExtraId],
    references: [productExtras.id],
  }),
  optionExtraConfig: one(optionExtraConfigs, {
    fields: [bookingExtras.optionExtraConfigId],
    references: [optionExtraConfigs.id],
  }),
}))
