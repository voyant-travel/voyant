import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { charterStatusEnum, voyageSalesStatusEnum } from "./schema-shared.js"
import { charterYachts } from "./schema-yachts.js"

export const charterProducts = pgTable(
  "charter_products",
  {
    id: typeId("charter_products"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    lineSupplierId: text("line_supplier_id"),
    defaultYachtId: typeIdRef("default_yacht_id").references(() => charterYachts.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    shortDescription: text("short_description"),
    heroImageUrl: text("hero_image_url"),
    mapImageUrl: text("map_image_url"),
    regions: jsonb("regions").$type<string[]>().default([]),
    themes: jsonb("themes").$type<string[]>().default([]),
    status: charterStatusEnum("status").notNull().default("draft"),
    /** Default booking modes offered. Per-voyage entries can override. */
    defaultBookingModes: jsonb("default_booking_modes")
      .$type<Array<"per_suite" | "whole_yacht">>()
      .default(["per_suite"]),
    /** Soft FK to legal.contractTemplates for whole-yacht MYBA template. */
    defaultMybaTemplateId: text("default_myba_template_id"),
    /** Typical APA % for this brand (e.g. 27.50). Per-voyage can override. */
    defaultApaPercent: numeric("default_apa_percent", { precision: 5, scale: 2 }),
    /**
     * Cached aggregate — the lowest published voyage × suite price for this
     * product, recomputed by `recomputeProductAggregates`. Single-currency
     * (the deployment's chosen browse currency) so card surfaces have a
     * sortable price without scanning the jsonb pricing maps;
     * `lowestPriceCachedCurrency` records which currency the amount is in.
     */
    lowestPriceCachedAmount: numeric("lowest_price_cached_amount", {
      precision: 12,
      scale: 2,
    }),
    lowestPriceCachedCurrency: text("lowest_price_cached_currency"),
    earliestVoyageCached: date("earliest_voyage_cached"),
    latestVoyageCached: date("latest_voyage_cached"),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_charter_products_slug").on(table.slug),
    index("idx_charter_products_status_created").on(table.status, table.createdAt),
    index("idx_charter_products_supplier_status").on(table.lineSupplierId, table.status),
    index("idx_charter_products_earliest").on(table.earliestVoyageCached, table.status),
  ],
)

export type CharterProduct = typeof charterProducts.$inferSelect
export type NewCharterProduct = typeof charterProducts.$inferInsert

export const charterVoyages = pgTable(
  "charter_voyages",
  {
    id: typeId("charter_voyages"),
    productId: typeIdRef("product_id")
      .notNull()
      .references(() => charterProducts.id, { onDelete: "cascade" }),
    yachtId: typeIdRef("yacht_id")
      .notNull()
      .references(() => charterYachts.id, { onDelete: "restrict" }),
    voyageCode: text("voyage_code").notNull(),
    name: text("name"),
    embarkPortFacilityId: text("embark_port_facility_id"),
    embarkPortName: text("embark_port_name"),
    disembarkPortFacilityId: text("disembark_port_facility_id"),
    disembarkPortName: text("disembark_port_name"),
    departureDate: date("departure_date").notNull(),
    returnDate: date("return_date").notNull(),
    nights: smallint("nights").notNull(),
    /** Which booking modes this voyage offers — `['per_suite']`, `['whole_yacht']`, or both. */
    bookingModes: jsonb("booking_modes")
      .$type<Array<"per_suite" | "whole_yacht">>()
      .notNull()
      .default(["per_suite"]),
    appointmentOnly: boolean("appointment_only").notNull().default(false),

    /**
     * Whole-yacht pricing — only relevant when 'whole_yacht' in bookingModes.
     * `{ "<ISO-4217>": "<numeric-string>" }` map; missing key means the
     * voyage isn't priced in that currency. Adding a new currency is a
     * data-only change.
     */
    wholeYachtPricesByCurrency: jsonb("whole_yacht_prices_by_currency")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),

    apaPercentOverride: numeric("apa_percent_override", { precision: 5, scale: 2 }),
    mybaTemplateIdOverride: text("myba_template_id_override"),
    charterAreaOverride: text("charter_area_override"),

    salesStatus: voyageSalesStatusEnum("sales_status").notNull().default("open"),
    availabilityNote: text("availability_note"),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_charter_voyages_product_departure").on(table.productId, table.departureDate),
    index("idx_charter_voyages_yacht_departure").on(table.yachtId, table.departureDate),
    index("idx_charter_voyages_status_departure").on(table.salesStatus, table.departureDate),
    uniqueIndex("uidx_charter_voyages_product_date_yacht").on(
      table.productId,
      table.departureDate,
      table.yachtId,
    ),
  ],
)

export type CharterVoyage = typeof charterVoyages.$inferSelect
export type NewCharterVoyage = typeof charterVoyages.$inferInsert
