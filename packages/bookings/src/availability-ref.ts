import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { boolean, date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const availabilitySlotsRef = pgTable("availability_slots", {
  id: typeId("availability_slots").primaryKey(),
  productId: text("product_id").notNull(),
  optionId: text("option_id"),
  facilityId: text("facility_id"),
  availabilityRuleId: typeIdRef("availability_rule_id"),
  startTimeId: typeIdRef("start_time_id"),
  dateLocal: date("date_local").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  timezone: text("timezone").notNull(),
  status: text("status").$type<"open" | "closed" | "sold_out" | "cancelled">().notNull(),
  unlimited: boolean("unlimited").notNull(),
  initialPax: integer("initial_pax"),
  remainingPax: integer("remaining_pax"),
  initialPickups: integer("initial_pickups"),
  remainingPickups: integer("remaining_pickups"),
  remainingResources: integer("remaining_resources"),
  pastCutoff: boolean("past_cutoff").notNull().default(false),
  tooEarly: boolean("too_early").notNull().default(false),
  nights: integer("nights"),
  days: integer("days"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
})
