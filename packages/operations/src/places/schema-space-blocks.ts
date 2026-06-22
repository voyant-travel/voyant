import { ALLOTMENT_PICKUP_STATUSES, ALLOTMENT_STATUSES } from "@voyant-travel/allotments"
import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { functionSpaces } from "./schema-function-spaces.js"

/**
 * Space blocks — held function-space inventory over a date range, the second
 * consumer of the shared allotment lifecycle (room blocks being the first).
 * Same negotiate → hold → confirm → pickup/cutoff/release lifecycle; the unit
 * is "units of the space" rather than rooms, and an optional hold time window
 * scopes the daily slots. See RFC voyant#1489 §4.2 (Phase 2).
 */
export const spaceBlockStatusEnum = pgEnum("space_block_status", ALLOTMENT_STATUSES)
export const spaceBlockPickupStatusEnum = pgEnum(
  "space_block_pickup_status",
  ALLOTMENT_PICKUP_STATUSES,
)

export const spaceBlocks = pgTable(
  "space_blocks",
  {
    id: typeId("space_blocks"),
    // Intra-package FK (space_blocks + function_spaces both live in operations):
    functionSpaceId: typeIdRef("function_space_id")
      .notNull()
      .references(() => functionSpaces.id, { onDelete: "restrict" }),
    // Cross-package → loose columns + defineLink at the deployment:
    programId: typeIdRef("program_id"), // → mice.programs
    supplierId: typeIdRef("supplier_id"), // → distribution suppliers
    name: text("name").notNull(),
    status: spaceBlockStatusEnum("status").notNull().default("inquiry"),
    currency: text("currency"),
    netRateCents: integer("net_rate_cents"), // per unit / day
    sellRateCents: integer("sell_rate_cents"),
    holdStartTime: text("hold_start_time"), // optional daily window, HH:MM
    holdEndTime: text("hold_end_time"),
    optionDate: date("option_date"),
    cutoffDate: date("cutoff_date"),
    attritionTerms: jsonb("attrition_terms").$type<Record<string, unknown>>(),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_space_blocks_function_space").on(table.functionSpaceId),
    index("idx_space_blocks_program").on(table.programId),
    index("idx_space_blocks_supplier").on(table.supplierId),
    index("idx_space_blocks_status").on(table.status),
    index("idx_space_blocks_cutoff").on(table.cutoffDate),
  ],
)

/**
 * Per-day unit counters. `remaining(date) = units_held - units_picked_up -
 * units_released`. Maintained projection of the pickup ledger, updated in the
 * same transaction as each pickup; the CHECK constraints make oversell loud.
 */
export const spaceBlockSlots = pgTable(
  "space_block_slots",
  {
    id: typeId("space_block_slots"),
    blockId: typeIdRef("block_id")
      .notNull()
      .references(() => spaceBlocks.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    unitsHeld: integer("units_held").notNull().default(0),
    unitsPickedUp: integer("units_picked_up").notNull().default(0),
    unitsReleased: integer("units_released").notNull().default(0),
    netRateCentsOverride: integer("net_rate_cents_override"),
    sellRateCentsOverride: integer("sell_rate_cents_override"),
  },
  (table) => [
    uniqueIndex("uidx_space_block_slots_block_date").on(table.blockId, table.date),
    check(
      "ck_space_block_slots_nonneg",
      sql`units_held >= 0 AND units_picked_up >= 0 AND units_released >= 0`,
    ),
    check("ck_space_block_slots_capacity", sql`units_picked_up + units_released <= units_held`),
  ],
)

export const spaceBlockPickups = pgTable(
  "space_block_pickups",
  {
    id: typeId("space_block_pickups"),
    blockId: typeIdRef("block_id")
      .notNull()
      .references(() => spaceBlocks.id, { onDelete: "cascade" }),
    bookingId: text("booking_id"), // → bookings (cross-package, loose)
    sessionId: text("session_id"), // → mice.programSessions (cross-package, loose)
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    units: integer("units").notNull().default(1),
    status: spaceBlockPickupStatusEnum("status").notNull().default("active"),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }).notNull().defaultNow(),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_space_block_pickups_block").on(table.blockId),
    index("idx_space_block_pickups_booking").on(table.bookingId),
    index("idx_space_block_pickups_session").on(table.sessionId),
    // Idempotency: at most one ACTIVE pickup per session — re-processing a
    // confirmation is a no-op, not a double count.
    uniqueIndex("uidx_space_block_pickups_session")
      .on(table.sessionId)
      .where(sql`status = 'active'`),
    check("ck_space_block_pickups_units_positive", sql`units > 0`),
  ],
)

export type SpaceBlock = typeof spaceBlocks.$inferSelect
export type NewSpaceBlock = typeof spaceBlocks.$inferInsert
export type SpaceBlockSlot = typeof spaceBlockSlots.$inferSelect
export type NewSpaceBlockSlot = typeof spaceBlockSlots.$inferInsert
export type SpaceBlockPickup = typeof spaceBlockPickups.$inferSelect
export type NewSpaceBlockPickup = typeof spaceBlockPickups.$inferInsert
