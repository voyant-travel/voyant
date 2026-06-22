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

import { stayBookingItems } from "./schema-bookings.js"
import { roomTypes } from "./schema-inventory.js"

/**
 * Room blocks — the inbound, supplier-contracted allotment of rooms held
 * against a property for a date range (negotiate → hold → confirm, with an
 * option/cutoff/release lifecycle and live pickup counters). The reserved
 * `hrbl` TypeID finally gets a table. See RFC voyant#1489.
 *
 * Ownership: tables + service live in accommodations so `roomTypeId` and
 * `stayBookingItemId` are intra-package FKs. `programId` (mice), `supplierId`
 * (distribution), and `propertyId` (operations places) are cross-package, so
 * they are loose `typeIdRef` columns linked via `defineLink` at the deployment.
 */

// Header status is the NEGOTIATION/lifecycle stage only. Pickup PROGRESS
// (none / partial / full) is DERIVED at read time from room_block_nights
// counters — never a stored header status — so the header can never drift
// from the nightly ledger.
export const roomBlockStatusEnum = pgEnum("hotel_room_block_status", ALLOTMENT_STATUSES)

export const roomBlocks = pgTable(
  "room_blocks",
  {
    id: typeId("room_blocks"),
    // Cross-package → loose columns + defineLink at the deployment:
    programId: typeIdRef("program_id"), // → mice.programs (nullable; a block can pre-date a program)
    supplierId: typeIdRef("supplier_id"), // → distribution suppliers
    propertyId: typeIdRef("property_id"), // → operations places (properties/facilities)
    // Intra-package → real FK (room_blocks + roomTypes both live in accommodations):
    roomTypeId: typeIdRef("room_type_id")
      .notNull()
      .references(() => roomTypes.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    status: roomBlockStatusEnum("status").notNull().default("inquiry"),
    currency: text("currency").notNull(),
    netRateCents: integer("net_rate_cents"), // per room / night
    sellRateCents: integer("sell_rate_cents"),
    optionDate: date("option_date"), // decision deadline
    cutoffDate: date("cutoff_date"), // release-back deadline
    attritionTerms: jsonb("attrition_terms").$type<Record<string, unknown>>(), // allowed shrink %, penalties
    depositTerms: jsonb("deposit_terms").$type<Record<string, unknown>>(),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_room_blocks_program").on(table.programId),
    index("idx_room_blocks_supplier").on(table.supplierId),
    index("idx_room_blocks_property").on(table.propertyId),
    index("idx_room_blocks_room_type").on(table.roomTypeId),
    index("idx_room_blocks_status").on(table.status),
    index("idx_room_blocks_cutoff").on(table.cutoffDate),
  ],
)

/**
 * Per-night inventory counters. `remaining(date) = rooms_held - rooms_picked_up
 * - rooms_released`. These are a maintained projection of the room_block_pickups
 * ledger, updated in the SAME transaction as each pickup; the CHECK constraints
 * make oversell fail loudly rather than silently double-count.
 */
export const roomBlockNights = pgTable(
  "room_block_nights",
  {
    id: typeId("room_block_nights"),
    blockId: typeIdRef("block_id")
      .notNull()
      .references(() => roomBlocks.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    roomsHeld: integer("rooms_held").notNull().default(0),
    roomsPickedUp: integer("rooms_picked_up").notNull().default(0),
    roomsReleased: integer("rooms_released").notNull().default(0),
    netRateCentsOverride: integer("net_rate_cents_override"),
    sellRateCentsOverride: integer("sell_rate_cents_override"),
  },
  (table) => [
    uniqueIndex("uidx_room_block_nights_block_date").on(table.blockId, table.date),
    check(
      "ck_room_block_nights_nonneg",
      sql`rooms_held >= 0 AND rooms_picked_up >= 0 AND rooms_released >= 0`,
    ),
    check("ck_room_block_nights_capacity", sql`rooms_picked_up + rooms_released <= rooms_held`),
  ],
)

// The pickup ledger is append-only; reversal compensates rather than deletes.
export const roomBlockPickupStatusEnum = pgEnum(
  "room_block_pickup_status",
  ALLOTMENT_PICKUP_STATUSES,
)

export const roomBlockPickups = pgTable(
  "room_block_pickups",
  {
    id: typeId("room_block_pickups"),
    blockId: typeIdRef("block_id")
      .notNull()
      .references(() => roomBlocks.id, { onDelete: "cascade" }),
    bookingId: text("booking_id"), // → bookings (cross-package, loose)
    // Intra-package → real FK (pickups + stayBookingItems both live in accommodations):
    stayBookingItemId: typeIdRef("stay_booking_item_id").references(() => stayBookingItems.id, {
      onDelete: "restrict",
    }),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    rooms: integer("rooms").notNull().default(1),
    status: roomBlockPickupStatusEnum("status").notNull().default("active"),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }).notNull().defaultNow(),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_room_block_pickups_block").on(table.blockId),
    index("idx_room_block_pickups_booking").on(table.bookingId),
    // Idempotency: at most one ACTIVE pickup per stay item — re-processing a
    // confirmation is a no-op, not a double count.
    uniqueIndex("uidx_room_block_pickups_stay_item")
      .on(table.stayBookingItemId)
      .where(sql`status = 'active'`),
    check("ck_room_block_pickups_rooms_positive", sql`rooms > 0`),
  ],
)

export type RoomBlock = typeof roomBlocks.$inferSelect
export type NewRoomBlock = typeof roomBlocks.$inferInsert
export type RoomBlockNight = typeof roomBlockNights.$inferSelect
export type NewRoomBlockNight = typeof roomBlockNights.$inferInsert
export type RoomBlockPickup = typeof roomBlockPickups.$inferSelect
export type NewRoomBlockPickup = typeof roomBlockPickups.$inferInsert
