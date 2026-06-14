import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { charterVoyages } from "./schema-core.js"

/**
 * Charter schedule days. Charter itineraries are flat per voyage — no template
 * + override two-tier model like cruises uses, because the schedule is itself
 * negotiable between broker and charterer for whole-yacht bookings, and is
 * just a published suggestion for per-suite bookings.
 */
export const charterScheduleDays = pgTable(
  "charter_schedule_days",
  {
    id: typeId("charter_schedule_days"),
    voyageId: typeIdRef("voyage_id")
      .notNull()
      .references(() => charterVoyages.id, { onDelete: "cascade" }),
    dayNumber: smallint("day_number").notNull(),
    portFacilityId: text("port_facility_id"),
    portName: text("port_name"),
    /** Optional explicit date — else derived from voyage.departureDate + dayNumber - 1. */
    scheduleDate: date("schedule_date"),
    arrivalTime: time("arrival_time"),
    departureTime: time("departure_time"),
    isSeaDay: boolean("is_sea_day").notNull().default(false),
    description: text("description"),
    activities: jsonb("activities").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_charter_schedule_voyage_day").on(table.voyageId, table.dayNumber),
    index("idx_charter_schedule_voyage").on(table.voyageId),
  ],
)

export type CharterScheduleDay = typeof charterScheduleDays.$inferSelect
export type NewCharterScheduleDay = typeof charterScheduleDays.$inferInsert
