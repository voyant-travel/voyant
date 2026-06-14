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

import {
  accommodationGuaranteeModeEnum,
  accommodationInventoryModeEnum,
  ratePlanChargeFrequencyEnum,
} from "./schema-shared.js"

export const roomTypes = pgTable(
  "room_types",
  {
    id: typeId("room_types"),
    propertyId: typeIdRef("property_id").notNull(),
    supplierId: text("supplier_id"),
    code: text("code"),
    name: text("name").notNull(),
    description: text("description"),
    inventoryMode: accommodationInventoryModeEnum("inventory_mode").notNull().default("pooled"),
    roomClass: text("room_class"),
    maxAdults: integer("max_adults"),
    maxChildren: integer("max_children"),
    maxInfants: integer("max_infants"),
    standardOccupancy: integer("standard_occupancy"),
    maxOccupancy: integer("max_occupancy"),
    minOccupancy: integer("min_occupancy"),
    bedroomCount: integer("bedroom_count"),
    bathroomCount: integer("bathroom_count"),
    areaValue: integer("area_value"),
    areaUnit: text("area_unit"),
    accessibilityNotes: text("accessibility_notes"),
    smokingAllowed: boolean("smoking_allowed").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_room_types_property_sort_name").on(table.propertyId, table.sortOrder, table.name),
    index("idx_room_types_supplier_sort_name").on(table.supplierId, table.sortOrder, table.name),
    index("idx_room_types_active_sort_name").on(table.active, table.sortOrder, table.name),
    index("idx_room_types_inventory_mode_sort_name").on(
      table.inventoryMode,
      table.sortOrder,
      table.name,
    ),
    uniqueIndex("uidx_room_types_property_code").on(table.propertyId, table.code),
  ],
)

export const roomTypeBedConfigs = pgTable(
  "room_type_bed_configs",
  {
    id: typeId("room_type_bed_configs"),
    roomTypeId: typeIdRef("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "cascade" }),
    bedType: text("bed_type").notNull(),
    quantity: integer("quantity").notNull().default(1),
    isPrimary: boolean("is_primary").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_room_type_bed_configs_room_type_primary_created").on(
      table.roomTypeId,
      table.isPrimary,
      table.createdAt,
    ),
    index("idx_room_type_bed_configs_bed_type_primary_created").on(
      table.bedType,
      table.isPrimary,
      table.createdAt,
    ),
  ],
)

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: typeId("meal_plans"),
    propertyId: typeIdRef("property_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    includesBreakfast: boolean("includes_breakfast").notNull().default(false),
    includesLunch: boolean("includes_lunch").notNull().default(false),
    includesDinner: boolean("includes_dinner").notNull().default(false),
    includesDrinks: boolean("includes_drinks").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_meal_plans_property_sort_name").on(table.propertyId, table.sortOrder, table.name),
    index("idx_meal_plans_active_sort_name").on(table.active, table.sortOrder, table.name),
    uniqueIndex("uidx_meal_plans_property_code").on(table.propertyId, table.code),
  ],
)

export const ratePlans = pgTable(
  "rate_plans",
  {
    id: typeId("rate_plans"),
    propertyId: typeIdRef("property_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    mealPlanId: typeIdRef("meal_plan_id").references(() => mealPlans.id, { onDelete: "set null" }),
    priceCatalogId: text("price_catalog_id"),
    cancellationPolicyId: text("cancellation_policy_id"),
    marketId: text("market_id"),
    currencyCode: text("currency_code").notNull(),
    chargeFrequency: ratePlanChargeFrequencyEnum("charge_frequency").notNull().default("per_night"),
    guaranteeMode: accommodationGuaranteeModeEnum("guarantee_mode").notNull().default("none"),
    commissionable: boolean("commissionable").notNull().default(true),
    refundable: boolean("refundable").notNull().default(true),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    customerPaymentPolicy: jsonb("customer_payment_policy"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_rate_plans_property_sort_name").on(table.propertyId, table.sortOrder, table.name),
    index("idx_rate_plans_meal_plan_sort_name").on(table.mealPlanId, table.sortOrder, table.name),
    index("idx_rate_plans_catalog").on(table.priceCatalogId),
    index("idx_rate_plans_policy").on(table.cancellationPolicyId),
    index("idx_rate_plans_market_sort_name").on(table.marketId, table.sortOrder, table.name),
    index("idx_rate_plans_active_sort_name").on(table.active, table.sortOrder, table.name),
    uniqueIndex("uidx_rate_plans_property_code").on(table.propertyId, table.code),
  ],
)

export const ratePlanRoomTypes = pgTable(
  "rate_plan_room_types",
  {
    id: typeId("rate_plan_room_types"),
    ratePlanId: typeIdRef("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "cascade" }),
    productId: text("product_id"),
    optionId: text("option_id"),
    unitId: text("unit_id"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_rate_plan_room_types_rate_plan_sort_created").on(
      table.ratePlanId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_rate_plan_room_types_room_type_sort_created").on(
      table.roomTypeId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_rate_plan_room_types_product_sort_created").on(
      table.productId,
      table.sortOrder,
      table.createdAt,
    ),
    index("idx_rate_plan_room_types_option").on(table.optionId),
    index("idx_rate_plan_room_types_unit").on(table.unitId),
    index("idx_rate_plan_room_types_active_sort_created").on(
      table.active,
      table.sortOrder,
      table.createdAt,
    ),
    uniqueIndex("uidx_rate_plan_room_types_pair").on(table.ratePlanId, table.roomTypeId),
  ],
)

export type RoomType = typeof roomTypes.$inferSelect
export type NewRoomType = typeof roomTypes.$inferInsert
export type RoomTypeBedConfig = typeof roomTypeBedConfigs.$inferSelect
export type NewRoomTypeBedConfig = typeof roomTypeBedConfigs.$inferInsert
export type MealPlan = typeof mealPlans.$inferSelect
export type NewMealPlan = typeof mealPlans.$inferInsert
export type RatePlan = typeof ratePlans.$inferSelect
export type NewRatePlan = typeof ratePlans.$inferInsert
export type RatePlanRoomType = typeof ratePlanRoomTypes.$inferSelect
export type NewRatePlanRoomType = typeof ratePlanRoomTypes.$inferInsert
