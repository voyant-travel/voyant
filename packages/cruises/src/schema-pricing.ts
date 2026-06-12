import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { cruiseCabinCategories } from "./schema-cabins.js"
import { cruiseSailings } from "./schema-core.js"
import {
  priceAvailabilityEnum,
  priceComponentDirectionEnum,
  priceComponentKindEnum,
  priceFareVariantEnum,
} from "./schema-shared.js"

export const cruisePrices = pgTable(
  "cruise_prices",
  {
    id: typeId("cruise_prices"),
    sailingId: typeIdRef("sailing_id")
      .notNull()
      .references(() => cruiseSailings.id, { onDelete: "cascade" }),
    cabinCategoryId: typeIdRef("cabin_category_id")
      .notNull()
      .references(() => cruiseCabinCategories.id, { onDelete: "cascade" }),
    occupancy: smallint("occupancy").notNull(),
    fareCode: text("fare_code"),
    fareCodeName: text("fare_code_name"),
    fareVariant: priceFareVariantEnum("fare_variant").notNull().default("cruise_only"),
    currency: text("currency").notNull(),
    pricePerPerson: numeric("price_per_person", { precision: 12, scale: 2 }).notNull(),
    originalPricePerPerson: numeric("original_price_per_person", { precision: 12, scale: 2 }),
    secondGuestPricePerPerson: numeric("second_guest_price_per_person", {
      precision: 12,
      scale: 2,
    }),
    singlePricePerPerson: numeric("single_price_per_person", {
      precision: 12,
      scale: 2,
    }),
    singleSupplementPercent: numeric("single_supplement_percent", {
      precision: 5,
      scale: 2,
    }),
    availability: priceAvailabilityEnum("availability").notNull().default("available"),
    availabilityCount: integer("availability_count"),
    priceCatalogId: text("price_catalog_id"),
    priceScheduleId: text("price_schedule_id"),
    bookingDeadline: date("booking_deadline"),
    earlyBookingDeadline: date("early_booking_deadline"),
    earlyBookingBonusDescription: text("early_booking_bonus_description"),
    requiresRequest: boolean("requires_request").notNull().default(false),
    notes: text("notes"),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cruise_prices_lookup").on(
      table.sailingId,
      table.cabinCategoryId,
      table.occupancy,
      table.fareCode,
      table.fareVariant,
    ),
    index("idx_cruise_prices_lowest").on(table.sailingId, table.availability, table.pricePerPerson),
    index("idx_cruise_prices_catalog").on(table.priceCatalogId),
    index("idx_cruise_prices_schedule").on(table.priceScheduleId),
    uniqueIndex("uidx_cruise_prices_standing")
      .on(
        table.sailingId,
        table.cabinCategoryId,
        table.occupancy,
        table.fareCode,
        table.fareVariant,
      )
      // agent-quality: raw-sql reviewed -- owner: cruises; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      .where(sql`${table.priceScheduleId} IS NULL`),
  ],
)

export type CruisePrice = typeof cruisePrices.$inferSelect
export type NewCruisePrice = typeof cruisePrices.$inferInsert

export const cruisePriceComponents = pgTable(
  "cruise_price_components",
  {
    id: typeId("cruise_price_components"),
    priceId: typeIdRef("price_id")
      .notNull()
      .references(() => cruisePrices.id, { onDelete: "cascade" }),
    kind: priceComponentKindEnum("kind").notNull(),
    label: text("label"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    direction: priceComponentDirectionEnum("direction").notNull(),
    perPerson: boolean("per_person").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cruise_price_components_price").on(table.priceId),
    index("idx_cruise_price_components_price_kind").on(table.priceId, table.kind),
  ],
)

export type CruisePriceComponent = typeof cruisePriceComponents.$inferSelect
export type NewCruisePriceComponent = typeof cruisePriceComponents.$inferInsert
