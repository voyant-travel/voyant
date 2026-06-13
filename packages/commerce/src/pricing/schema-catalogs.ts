import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { priceCatalogTypeEnum } from "./schema-shared.js"

export const priceCatalogs = pgTable(
  "price_catalogs",
  {
    id: typeId("price_catalogs"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    // NULL = follow product.sellCurrency at snapshot time (multi-currency catalog)
    currencyCode: text("currency_code"),
    catalogType: priceCatalogTypeEnum("catalog_type").notNull().default("public"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_price_catalogs_code").on(table.code),
    index("idx_price_catalogs_name").on(table.name),
    index("idx_price_catalogs_currency_name").on(table.currencyCode, table.name),
    index("idx_price_catalogs_type_name").on(table.catalogType, table.name),
    index("idx_price_catalogs_active_name").on(table.active, table.name),
  ],
)

export const priceSchedules = pgTable(
  "price_schedules",
  {
    id: typeId("price_schedules"),
    priceCatalogId: typeIdRef("price_catalog_id")
      .notNull()
      .references(() => priceCatalogs.id, { onDelete: "cascade" }),
    code: text("code"),
    name: text("name").notNull(),
    recurrenceRule: text("recurrence_rule").notNull(),
    timezone: text("timezone"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    weekdays: jsonb("weekdays").$type<string[]>(),
    priority: integer("priority").notNull().default(0),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_price_schedules_priority_name").on(table.priority, table.name),
    index("idx_price_schedules_catalog_priority_name").on(
      table.priceCatalogId,
      table.priority,
      table.name,
    ),
    index("idx_price_schedules_active_priority_name").on(table.active, table.priority, table.name),
    uniqueIndex("uidx_price_schedules_catalog_code").on(table.priceCatalogId, table.code),
  ],
)

export type PriceCatalog = typeof priceCatalogs.$inferSelect
export type NewPriceCatalog = typeof priceCatalogs.$inferInsert
export type PriceSchedule = typeof priceSchedules.$inferSelect
export type NewPriceSchedule = typeof priceSchedules.$inferInsert
