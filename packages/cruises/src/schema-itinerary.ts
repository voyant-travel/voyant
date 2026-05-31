import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import {
  boolean,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { cruiseSailings, cruises } from "./schema-core.js"

type DayMeals = { breakfast?: boolean; lunch?: boolean; dinner?: boolean }

export const cruiseDays = pgTable(
  "cruise_days",
  {
    id: typeId("cruise_days"),
    cruiseId: typeIdRef("cruise_id")
      .notNull()
      .references(() => cruises.id, { onDelete: "cascade" }),
    dayNumber: smallint("day_number").notNull(),
    title: text("title"),
    description: text("description"),
    portFacilityId: text("port_facility_id"),
    portCanonicalPlaceId: text("port_canonical_place_id"),
    arrivalTime: time("arrival_time"),
    departureTime: time("departure_time"),
    isOvernight: boolean("is_overnight").notNull().default(false),
    isSeaDay: boolean("is_sea_day").notNull().default(false),
    isExpeditionLanding: boolean("is_expedition_landing").notNull().default(false),
    meals: jsonb("meals").$type<DayMeals>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_cruise_days_cruise_day").on(table.cruiseId, table.dayNumber),
    index("idx_cruise_days_cruise").on(table.cruiseId),
    index("idx_cruise_days_port_place").on(table.portCanonicalPlaceId),
  ],
)

export type CruiseDay = typeof cruiseDays.$inferSelect
export type NewCruiseDay = typeof cruiseDays.$inferInsert

export const cruiseSailingDays = pgTable(
  "cruise_sailing_days",
  {
    id: typeId("cruise_sailing_days"),
    sailingId: typeIdRef("sailing_id")
      .notNull()
      .references(() => cruiseSailings.id, { onDelete: "cascade" }),
    dayNumber: smallint("day_number").notNull(),
    title: text("title"),
    description: text("description"),
    portFacilityId: text("port_facility_id"),
    portCanonicalPlaceId: text("port_canonical_place_id"),
    arrivalTime: time("arrival_time"),
    departureTime: time("departure_time"),
    isOvernight: boolean("is_overnight"),
    isSeaDay: boolean("is_sea_day"),
    isExpeditionLanding: boolean("is_expedition_landing"),
    isSkipped: boolean("is_skipped").notNull().default(false),
    meals: jsonb("meals").$type<DayMeals>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_cruise_sailing_days_sailing_day").on(table.sailingId, table.dayNumber),
    index("idx_cruise_sailing_days_sailing").on(table.sailingId),
    index("idx_cruise_sailing_days_port_place").on(table.portCanonicalPlaceId),
  ],
)

export type CruiseSailingDay = typeof cruiseSailingDays.$inferSelect
export type NewCruiseSailingDay = typeof cruiseSailingDays.$inferInsert
