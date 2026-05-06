import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { properties } from "@voyantjs/facilities/schema"
import {
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { ratePlans, roomTypes } from "./schema-inventory.js"

export const stayRules = pgTable(
  "stay_rules",
  {
    id: typeId("stay_rules"),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    ratePlanId: typeIdRef("rate_plan_id").references(() => ratePlans.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id").references(() => roomTypes.id, { onDelete: "cascade" }),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    minNights: integer("min_nights"),
    maxNights: integer("max_nights"),
    minAdvanceDays: integer("min_advance_days"),
    maxAdvanceDays: integer("max_advance_days"),
    closedToArrival: boolean("closed_to_arrival").notNull().default(false),
    closedToDeparture: boolean("closed_to_departure").notNull().default(false),
    arrivalWeekdays: jsonb("arrival_weekdays").$type<string[]>(),
    departureWeekdays: jsonb("departure_weekdays").$type<string[]>(),
    releaseDays: integer("release_days"),
    active: boolean("active").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stay_rules_property_priority_created").on(
      table.propertyId,
      table.priority,
      table.createdAt,
    ),
    index("idx_stay_rules_rate_plan_priority_created").on(
      table.ratePlanId,
      table.priority,
      table.createdAt,
    ),
    index("idx_stay_rules_room_type_priority_created").on(
      table.roomTypeId,
      table.priority,
      table.createdAt,
    ),
    index("idx_stay_rules_active_priority_created").on(
      table.active,
      table.priority,
      table.createdAt,
    ),
  ],
)

export const roomInventory = pgTable(
  "room_inventory",
  {
    id: typeId("room_inventory"),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    totalUnits: integer("total_units").notNull().default(0),
    availableUnits: integer("available_units").notNull().default(0),
    heldUnits: integer("held_units").notNull().default(0),
    soldUnits: integer("sold_units").notNull().default(0),
    outOfOrderUnits: integer("out_of_order_units").notNull().default(0),
    overbookLimit: integer("overbook_limit"),
    stopSell: boolean("stop_sell").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_room_inventory_property_date").on(table.propertyId, table.date),
    index("idx_room_inventory_room_type_date").on(table.roomTypeId, table.date),
    index("idx_room_inventory_stop_sell_date").on(table.stopSell, table.date),
    uniqueIndex("uidx_room_inventory_room_type_date").on(table.roomTypeId, table.date),
  ],
)

export const ratePlanInventoryOverrides = pgTable(
  "rate_plan_inventory_overrides",
  {
    id: typeId("rate_plan_inventory_overrides"),
    ratePlanId: typeIdRef("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    stopSell: boolean("stop_sell").notNull().default(false),
    closedToArrival: boolean("closed_to_arrival").notNull().default(false),
    closedToDeparture: boolean("closed_to_departure").notNull().default(false),
    minNightsOverride: integer("min_nights_override"),
    maxNightsOverride: integer("max_nights_override"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_rate_plan_inventory_overrides_rate_plan_date").on(table.ratePlanId, table.date),
    index("idx_rate_plan_inventory_overrides_room_type_date").on(table.roomTypeId, table.date),
    uniqueIndex("uidx_rate_plan_inventory_overrides_unique").on(
      table.ratePlanId,
      table.roomTypeId,
      table.date,
    ),
  ],
)

export const roomTypeRates = pgTable(
  "room_type_rates",
  {
    id: typeId("room_type_rates"),
    ratePlanId: typeIdRef("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "cascade" }),
    priceScheduleId: text("price_schedule_id"),
    currencyCode: char("currency_code", { length: 3 }).notNull(),
    baseAmountCents: integer("base_amount_cents"),
    extraAdultAmountCents: integer("extra_adult_amount_cents"),
    extraChildAmountCents: integer("extra_child_amount_cents"),
    extraInfantAmountCents: integer("extra_infant_amount_cents"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_room_type_rates_rate_plan_created").on(table.ratePlanId, table.createdAt),
    index("idx_room_type_rates_room_type_created").on(table.roomTypeId, table.createdAt),
    index("idx_room_type_rates_price_schedule_created").on(table.priceScheduleId, table.createdAt),
    index("idx_room_type_rates_active_created").on(table.active, table.createdAt),
    uniqueIndex("uidx_room_type_rates_plan_room_schedule").on(
      table.ratePlanId,
      table.roomTypeId,
      table.priceScheduleId,
    ),
  ],
)

export type StayRule = typeof stayRules.$inferSelect
export type NewStayRule = typeof stayRules.$inferInsert
export type RoomInventory = typeof roomInventory.$inferSelect
export type NewRoomInventory = typeof roomInventory.$inferInsert
export type RatePlanInventoryOverride = typeof ratePlanInventoryOverrides.$inferSelect
export type NewRatePlanInventoryOverride = typeof ratePlanInventoryOverrides.$inferInsert
export type RoomTypeRate = typeof roomTypeRates.$inferSelect
export type NewRoomTypeRate = typeof roomTypeRates.$inferInsert
