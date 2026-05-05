import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import {
  boolean,
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

import { cabinRoomTypeEnum, shipTypeEnum } from "./schema-shared.js"

export const cruiseShips = pgTable(
  "cruise_ships",
  {
    id: typeId("cruise_ships"),
    lineSupplierId: text("line_supplier_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shipType: shipTypeEnum("ship_type").notNull(),
    capacityGuests: integer("capacity_guests"),
    capacityCrew: integer("capacity_crew"),
    cabinCount: integer("cabin_count"),
    deckCount: integer("deck_count"),
    lengthMeters: numeric("length_meters", { precision: 8, scale: 2 }),
    cruisingSpeedKnots: numeric("cruising_speed_knots", { precision: 5, scale: 2 }),
    yearBuilt: integer("year_built"),
    yearRefurbished: integer("year_refurbished"),
    imo: text("imo"),
    description: text("description"),
    deckPlanUrl: text("deck_plan_url"),
    gallery: jsonb("gallery").$type<string[]>().default([]),
    amenities: jsonb("amenities").$type<Record<string, unknown>>().default({}),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_cruise_ships_slug").on(table.slug),
    uniqueIndex("uidx_cruise_ships_imo").on(table.imo),
    index("idx_cruise_ships_supplier_active").on(table.lineSupplierId, table.isActive),
    index("idx_cruise_ships_type_active").on(table.shipType, table.isActive),
  ],
)

export type CruiseShip = typeof cruiseShips.$inferSelect
export type NewCruiseShip = typeof cruiseShips.$inferInsert

export const cruiseDecks = pgTable(
  "cruise_decks",
  {
    id: typeId("cruise_decks"),
    shipId: typeIdRef("ship_id")
      .notNull()
      .references(() => cruiseShips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: smallint("level"),
    planImageUrl: text("plan_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cruise_decks_ship_level").on(table.shipId, table.level),
    uniqueIndex("uidx_cruise_decks_ship_name").on(table.shipId, table.name),
  ],
)

export type CruiseDeck = typeof cruiseDecks.$inferSelect
export type NewCruiseDeck = typeof cruiseDecks.$inferInsert

export const cruiseCabinCategories = pgTable(
  "cruise_cabin_categories",
  {
    id: typeId("cruise_cabin_categories"),
    shipId: typeIdRef("ship_id")
      .notNull()
      .references(() => cruiseShips.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    roomType: cabinRoomTypeEnum("room_type").notNull(),
    description: text("description"),
    minOccupancy: smallint("min_occupancy").notNull().default(1),
    maxOccupancy: smallint("max_occupancy").notNull(),
    squareFeet: numeric("square_feet", { precision: 8, scale: 2 }),
    wheelchairAccessible: boolean("wheelchair_accessible").notNull().default(false),
    amenities: jsonb("amenities").$type<string[]>().default([]),
    images: jsonb("images").$type<string[]>().default([]),
    floorplanImages: jsonb("floorplan_images").$type<string[]>().default([]),
    gradeCodes: jsonb("grade_codes").$type<string[]>().default([]),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    /**
     * Per-cabin-category customer payment policy override. Most-
     * specific layer in the cruise vertical — wins over per-sailing
     * and per-cruise. Suite categories often carry stricter non-
     * refundable terms than interior/balcony at the same sailing.
     */
    customerPaymentPolicy: jsonb("customer_payment_policy"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_cruise_cabin_categories_ship_code").on(table.shipId, table.code),
    index("idx_cruise_cabin_categories_ship_type").on(table.shipId, table.roomType),
  ],
)

export type CruiseCabinCategory = typeof cruiseCabinCategories.$inferSelect
export type NewCruiseCabinCategory = typeof cruiseCabinCategories.$inferInsert

export const cruiseCabins = pgTable(
  "cruise_cabins",
  {
    id: typeId("cruise_cabins"),
    categoryId: typeIdRef("category_id")
      .notNull()
      .references(() => cruiseCabinCategories.id, { onDelete: "cascade" }),
    cabinNumber: text("cabin_number").notNull(),
    deckId: typeIdRef("deck_id").references(() => cruiseDecks.id, { onDelete: "set null" }),
    position: text("position"),
    connectsTo: typeIdRef("connects_to"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_cruise_cabins_category_number").on(table.categoryId, table.cabinNumber),
    index("idx_cruise_cabins_deck").on(table.deckId),
    index("idx_cruise_cabins_active").on(table.isActive),
  ],
)

export type CruiseCabin = typeof cruiseCabins.$inferSelect
export type NewCruiseCabin = typeof cruiseCabins.$inferInsert
