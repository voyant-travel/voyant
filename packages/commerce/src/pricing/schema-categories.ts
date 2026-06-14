import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
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

import { pricingCategoryTypeEnum, pricingDependencyTypeEnum } from "./schema-shared.js"

export const pricingCategories = pgTable(
  "pricing_categories",
  {
    id: typeId("pricing_categories"),
    productId: text("product_id"),
    optionId: text("option_id"),
    unitId: text("unit_id"),
    code: text("code"),
    name: text("name").notNull(),
    categoryType: pricingCategoryTypeEnum("category_type").notNull().default("other"),
    seatOccupancy: integer("seat_occupancy").notNull().default(1),
    groupSize: integer("group_size"),
    isAgeQualified: boolean("is_age_qualified").notNull().default(false),
    minAge: integer("min_age"),
    maxAge: integer("max_age"),
    internalUseOnly: boolean("internal_use_only").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pricing_categories_sort_name").on(table.sortOrder, table.name),
    index("idx_pricing_categories_product_sort_name").on(
      table.productId,
      table.sortOrder,
      table.name,
    ),
    index("idx_pricing_categories_option_sort_name").on(
      table.optionId,
      table.sortOrder,
      table.name,
    ),
    index("idx_pricing_categories_unit_sort_name").on(table.unitId, table.sortOrder, table.name),
    index("idx_pricing_categories_type_sort_name").on(
      table.categoryType,
      table.sortOrder,
      table.name,
    ),
    index("idx_pricing_categories_active_sort_name").on(table.active, table.sortOrder, table.name),
    uniqueIndex("uidx_pricing_categories_option_code").on(table.optionId, table.code),
  ],
)

export const pricingCategoryDependencies = pgTable(
  "pricing_category_dependencies",
  {
    id: typeId("pricing_category_dependencies"),
    pricingCategoryId: typeIdRef("pricing_category_id")
      .notNull()
      .references(() => pricingCategories.id, { onDelete: "cascade" }),
    masterPricingCategoryId: typeIdRef("master_pricing_category_id")
      .notNull()
      .references(() => pricingCategories.id, { onDelete: "cascade" }),
    dependencyType: pricingDependencyTypeEnum("dependency_type").notNull().default("requires"),
    maxPerMaster: integer("max_per_master"),
    maxDependentSum: integer("max_dependent_sum"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pricing_category_dependencies_created").on(table.createdAt),
    index("idx_pricing_category_dependencies_category_created").on(
      table.pricingCategoryId,
      table.createdAt,
    ),
    index("idx_pricing_category_dependencies_master_created").on(
      table.masterPricingCategoryId,
      table.createdAt,
    ),
    index("idx_pricing_category_dependencies_type_created").on(
      table.dependencyType,
      table.createdAt,
    ),
    index("idx_pricing_category_dependencies_active_created").on(table.active, table.createdAt),
    uniqueIndex("uidx_pricing_category_dependencies_pair_type").on(
      table.pricingCategoryId,
      table.masterPricingCategoryId,
      table.dependencyType,
    ),
  ],
)

export type PricingCategory = typeof pricingCategories.$inferSelect
export type NewPricingCategory = typeof pricingCategories.$inferInsert
export type PricingCategoryDependency = typeof pricingCategoryDependencies.$inferSelect
export type NewPricingCategoryDependency = typeof pricingCategoryDependencies.$inferInsert
