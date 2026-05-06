import { bookingItems } from "@voyantjs/bookings/schema"
import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { properties } from "@voyantjs/facilities/schema"
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { mealPlans, ratePlans, roomTypes, roomUnits } from "./schema-inventory.js"
import {
  hospitalityHousekeepingTaskStatusEnum,
  hospitalityMaintenanceBlockStatusEnum,
  hospitalityRoomBlockStatusEnum,
  stayBookingItemStatusEnum,
} from "./schema-shared.js"

export const stayBookingItems = pgTable(
  "stay_booking_items",
  {
    id: typeId("stay_booking_items"),
    bookingItemId: typeIdRef("booking_item_id")
      .notNull()
      .references(() => bookingItems.id, { onDelete: "cascade" }),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "cascade" }),
    roomUnitId: typeIdRef("room_unit_id").references(() => roomUnits.id, { onDelete: "set null" }),
    ratePlanId: typeIdRef("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "cascade" }),
    checkInDate: date("check_in_date").notNull(),
    checkOutDate: date("check_out_date").notNull(),
    nightCount: integer("night_count").notNull().default(1),
    roomCount: integer("room_count").notNull().default(1),
    adults: integer("adults").notNull().default(1),
    children: integer("children").notNull().default(0),
    infants: integer("infants").notNull().default(0),
    mealPlanId: typeIdRef("meal_plan_id").references(() => mealPlans.id, { onDelete: "set null" }),
    confirmationCode: text("confirmation_code"),
    voucherCode: text("voucher_code"),
    status: stayBookingItemStatusEnum("status").notNull().default("reserved"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stay_booking_items_booking_item").on(table.bookingItemId),
    index("idx_stay_booking_items_check_in").on(table.checkInDate),
    index("idx_stay_booking_items_property_check_in").on(table.propertyId, table.checkInDate),
    index("idx_stay_booking_items_room_type_check_in").on(table.roomTypeId, table.checkInDate),
    index("idx_stay_booking_items_room_unit_check_in").on(table.roomUnitId, table.checkInDate),
    index("idx_stay_booking_items_rate_plan_check_in").on(table.ratePlanId, table.checkInDate),
    index("idx_stay_booking_items_status_check_in").on(table.status, table.checkInDate),
    uniqueIndex("uidx_stay_booking_items_booking_item").on(table.bookingItemId),
  ],
)

export const stayDailyRates = pgTable(
  "stay_daily_rates",
  {
    id: typeId("stay_daily_rates"),
    stayBookingItemId: typeIdRef("stay_booking_item_id")
      .notNull()
      .references(() => stayBookingItems.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    sellCurrency: text("sell_currency").notNull(),
    sellAmountCents: integer("sell_amount_cents"),
    costCurrency: text("cost_currency"),
    costAmountCents: integer("cost_amount_cents"),
    taxAmountCents: integer("tax_amount_cents"),
    feeAmountCents: integer("fee_amount_cents"),
    commissionAmountCents: integer("commission_amount_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_stay_daily_rates_stay_booking_item").on(table.stayBookingItemId),
    index("idx_stay_daily_rates_date").on(table.date),
    uniqueIndex("uidx_stay_daily_rates_item_date").on(table.stayBookingItemId, table.date),
  ],
)

export const roomBlocks = pgTable(
  "room_blocks",
  {
    id: typeId("room_blocks"),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id").references(() => roomTypes.id, { onDelete: "set null" }),
    roomUnitId: typeIdRef("room_unit_id").references(() => roomUnits.id, { onDelete: "set null" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: hospitalityRoomBlockStatusEnum("status").notNull().default("draft"),
    blockReason: text("block_reason"),
    quantity: integer("quantity").notNull().default(1),
    releaseAt: timestamp("release_at", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_room_blocks_property_starts_on").on(table.propertyId, table.startsOn),
    index("idx_room_blocks_room_type_starts_on").on(table.roomTypeId, table.startsOn),
    index("idx_room_blocks_room_unit_starts_on").on(table.roomUnitId, table.startsOn),
    index("idx_room_blocks_status_starts_on").on(table.status, table.startsOn),
    index("idx_room_blocks_dates").on(table.startsOn, table.endsOn),
  ],
)

export const roomUnitStatusEvents = pgTable(
  "room_unit_status_events",
  {
    id: typeId("room_unit_status_events"),
    roomUnitId: typeIdRef("room_unit_id")
      .notNull()
      .references(() => roomUnits.id, { onDelete: "cascade" }),
    statusCode: text("status_code").notNull(),
    housekeepingStatus: text("housekeeping_status"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_room_unit_status_events_effective_from").on(table.effectiveFrom),
    index("idx_room_unit_status_events_room_unit_effective_from").on(
      table.roomUnitId,
      table.effectiveFrom,
    ),
    index("idx_room_unit_status_events_status_effective_from").on(
      table.statusCode,
      table.effectiveFrom,
    ),
  ],
)

export const maintenanceBlocks = pgTable(
  "maintenance_blocks",
  {
    id: typeId("maintenance_blocks"),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomTypeId: typeIdRef("room_type_id").references(() => roomTypes.id, { onDelete: "set null" }),
    roomUnitId: typeIdRef("room_unit_id").references(() => roomUnits.id, { onDelete: "set null" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: hospitalityMaintenanceBlockStatusEnum("status").notNull().default("open"),
    reason: text("reason"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_maintenance_blocks_property_starts_on").on(table.propertyId, table.startsOn),
    index("idx_maintenance_blocks_room_type_starts_on").on(table.roomTypeId, table.startsOn),
    index("idx_maintenance_blocks_room_unit_starts_on").on(table.roomUnitId, table.startsOn),
    index("idx_maintenance_blocks_status_starts_on").on(table.status, table.startsOn),
    index("idx_maintenance_blocks_dates").on(table.startsOn, table.endsOn),
  ],
)

export const housekeepingTasks = pgTable(
  "housekeeping_tasks",
  {
    id: typeId("housekeeping_tasks"),
    propertyId: typeIdRef("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomUnitId: typeIdRef("room_unit_id")
      .notNull()
      .references(() => roomUnits.id, { onDelete: "cascade" }),
    stayBookingItemId: typeIdRef("stay_booking_item_id").references(() => stayBookingItems.id, {
      onDelete: "set null",
    }),
    taskType: text("task_type").notNull(),
    status: hospitalityHousekeepingTaskStatusEnum("status").notNull().default("open"),
    priority: integer("priority").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    assignedTo: text("assigned_to"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_housekeeping_tasks_priority_due_at").on(table.priority, table.dueAt),
    index("idx_housekeeping_tasks_property_priority_due_at").on(
      table.propertyId,
      table.priority,
      table.dueAt,
    ),
    index("idx_housekeeping_tasks_room_unit_priority_due_at").on(
      table.roomUnitId,
      table.priority,
      table.dueAt,
    ),
    index("idx_housekeeping_tasks_stay_booking_item_priority_due_at").on(
      table.stayBookingItemId,
      table.priority,
      table.dueAt,
    ),
    index("idx_housekeeping_tasks_status_priority_due_at").on(
      table.status,
      table.priority,
      table.dueAt,
    ),
    index("idx_housekeeping_tasks_task_type_priority_due_at").on(
      table.taskType,
      table.priority,
      table.dueAt,
    ),
  ],
)

export type StayBookingItem = typeof stayBookingItems.$inferSelect
export type NewStayBookingItem = typeof stayBookingItems.$inferInsert
export type StayDailyRate = typeof stayDailyRates.$inferSelect
export type NewStayDailyRate = typeof stayDailyRates.$inferInsert
export type RoomBlock = typeof roomBlocks.$inferSelect
export type NewRoomBlock = typeof roomBlocks.$inferInsert
export type RoomUnitStatusEvent = typeof roomUnitStatusEvents.$inferSelect
export type NewRoomUnitStatusEvent = typeof roomUnitStatusEvents.$inferInsert
export type MaintenanceBlock = typeof maintenanceBlocks.$inferSelect
export type NewMaintenanceBlock = typeof maintenanceBlocks.$inferInsert
export type HousekeepingTask = typeof housekeepingTasks.$inferSelect
export type NewHousekeepingTask = typeof housekeepingTasks.$inferInsert
