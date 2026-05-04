import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { cruiseShips } from "./schema-cabins.js"
import {
  cruiseSailingDirectionEnum,
  cruiseStatusEnum,
  cruiseTypeEnum,
  sailingSalesStatusEnum,
} from "./schema-shared.js"

export const cruises = pgTable(
  "cruises",
  {
    id: typeId("cruises"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    cruiseType: cruiseTypeEnum("cruise_type").notNull(),
    lineSupplierId: text("line_supplier_id"),
    defaultShipId: typeIdRef("default_ship_id").references(() => cruiseShips.id, {
      onDelete: "set null",
    }),
    nights: integer("nights").notNull(),
    embarkPortFacilityId: text("embark_port_facility_id"),
    disembarkPortFacilityId: text("disembark_port_facility_id"),
    description: text("description"),
    shortDescription: text("short_description"),
    highlights: jsonb("highlights").$type<string[]>().default([]),
    inclusionsHtml: text("inclusions_html"),
    exclusionsHtml: text("exclusions_html"),
    regions: jsonb("regions").$type<string[]>().default([]),
    themes: jsonb("themes").$type<string[]>().default([]),
    heroImageUrl: text("hero_image_url"),
    mapImageUrl: text("map_image_url"),
    status: cruiseStatusEnum("status").notNull().default("draft"),
    lowestPriceCached: numeric("lowest_price_cached", { precision: 12, scale: 2 }),
    lowestPriceCurrencyCached: text("lowest_price_currency_cached"),
    earliestDepartureCached: date("earliest_departure_cached"),
    latestDepartureCached: date("latest_departure_cached"),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    /**
     * Cruise-level customer payment policy override. Lowest precedence
     * inside the cruise vertical — overridden by per-sailing or per-
     * cabin-category policies. Shape mirrors `PaymentPolicy` from
     * `@voyantjs/finance`.
     */
    customerPaymentPolicy: jsonb("customer_payment_policy"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_cruises_slug").on(table.slug),
    index("idx_cruises_type_status").on(table.cruiseType, table.status),
    index("idx_cruises_supplier_status").on(table.lineSupplierId, table.status),
    index("idx_cruises_earliest_departure_status").on(table.earliestDepartureCached, table.status),
    index("idx_cruises_status_created").on(table.status, table.createdAt),
  ],
)

export type Cruise = typeof cruises.$inferSelect
export type NewCruise = typeof cruises.$inferInsert

export const cruiseSailings = pgTable(
  "cruise_sailings",
  {
    id: typeId("cruise_sailings"),
    cruiseId: typeIdRef("cruise_id")
      .notNull()
      .references(() => cruises.id, { onDelete: "cascade" }),
    shipId: typeIdRef("ship_id")
      .notNull()
      .references(() => cruiseShips.id, { onDelete: "restrict" }),
    departureDate: date("departure_date").notNull(),
    returnDate: date("return_date").notNull(),
    embarkPortFacilityId: text("embark_port_facility_id"),
    disembarkPortFacilityId: text("disembark_port_facility_id"),
    direction: cruiseSailingDirectionEnum("direction"),
    availabilityNote: text("availability_note"),
    isCharter: boolean("is_charter").notNull().default(false),
    salesStatus: sailingSalesStatusEnum("sales_status").notNull().default("open"),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    /**
     * Per-sailing customer payment policy override. Wins over the
     * parent cruise's policy. Useful for high-season departures with
     * stricter terms (gala sailings, holiday-week premiums, …).
     */
    customerPaymentPolicy: jsonb("customer_payment_policy"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cruise_sailings_cruise_departure").on(table.cruiseId, table.departureDate),
    index("idx_cruise_sailings_ship_departure").on(table.shipId, table.departureDate),
    index("idx_cruise_sailings_status_departure").on(table.salesStatus, table.departureDate),
    uniqueIndex("uidx_cruise_sailings_cruise_date_ship").on(
      table.cruiseId,
      table.departureDate,
      table.shipId,
    ),
  ],
)

export type CruiseSailing = typeof cruiseSailings.$inferSelect
export type NewCruiseSailing = typeof cruiseSailings.$inferInsert
