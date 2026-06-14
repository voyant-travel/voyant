import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { charterVoyages } from "./schema-core.js"
import { suiteAvailabilityEnum, suiteCategoryEnum } from "./schema-shared.js"

/**
 * Per-suite pricing on a voyage. Charter pricing is flat — one row per suite
 * per voyage, no occupancy variants and no fare codes (unlike cruises). The
 * four explicit currency columns let SQL filter and order by price natively;
 * tertiary currencies handle via FX at display time.
 */
export const charterSuites = pgTable(
  "charter_suites",
  {
    id: typeId("charter_suites"),
    voyageId: typeIdRef("voyage_id")
      .notNull()
      .references(() => charterVoyages.id, { onDelete: "cascade" }),
    suiteCode: text("suite_code").notNull(),
    suiteName: text("suite_name").notNull(),
    suiteCategory: suiteCategoryEnum("suite_category"),
    description: text("description"),
    squareFeet: numeric("square_feet", { precision: 8, scale: 2 }),
    images: jsonb("images").$type<string[]>().default([]),
    floorplanImages: jsonb("floorplan_images").$type<string[]>().default([]),
    /** Used at booking time to validate party size; not used for pricing math. */
    maxGuests: smallint("max_guests"),

    /**
     * Per-currency flat suite price as a `{ "<ISO-4217>": "<numeric-string>" }`
     * map. Numeric strings preserve trailing zeroes and dodge floating-point
     * drift. Missing key means the suite isn't priced in that currency.
     * Adding a new currency is a data-only change — no schema migration.
     */
    pricesByCurrency: jsonb("prices_by_currency")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),

    /**
     * Optional per-currency port fee, separate from suite price. Same shape
     * as `pricesByCurrency`.
     */
    portFeesByCurrency: jsonb("port_fees_by_currency")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),

    availability: suiteAvailabilityEnum("availability").notNull().default("available"),
    unitsAvailable: smallint("units_available"),
    appointmentOnly: boolean("appointment_only").notNull().default(false),
    notes: text("notes"),

    /** Per-brand quirks that don't fit the canonical schema. */
    extra: jsonb("extra").$type<Record<string, unknown>>().default({}),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_charter_suites_voyage_code").on(table.voyageId, table.suiteCode),
    index("idx_charter_suites_voyage_availability").on(table.voyageId, table.availability),
    // Note: removed the previous (voyage_id, category, price_usd) composite
    // index when prices moved into a jsonb map. Sort-by-price queries on
    // the deployment's browse currency now use the GIN index implicitly via
    // jsonb operators; if a per-currency btree becomes a hot path we can
    // add an expression index on `(prices_by_currency ->> 'USD')::numeric`.
    index("idx_charter_suites_voyage_category").on(table.voyageId, table.suiteCategory),
  ],
)

export type CharterSuite = typeof charterSuites.$inferSelect
export type NewCharterSuite = typeof charterSuites.$inferInsert
