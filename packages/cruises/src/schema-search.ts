import { typeId, typeIdRef } from "@voyantjs/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  char,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import type { SourceRef } from "./adapters/index.js"
import { cruises } from "./schema-core.js"
import { cruiseSourceEnum, cruiseTypeEnum } from "./schema-shared.js"

export const cruiseSearchIndex = pgTable(
  "cruise_search_index",
  {
    id: typeId("cruise_search_index"),
    source: cruiseSourceEnum("source").notNull(),
    sourceProvider: text("source_provider"),
    sourceRef: jsonb("source_ref").$type<SourceRef>(),
    localCruiseId: typeIdRef("local_cruise_id").references(() => cruises.id, {
      onDelete: "cascade",
    }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    cruiseType: cruiseTypeEnum("cruise_type").notNull(),
    lineName: text("line_name").notNull(),
    shipName: text("ship_name").notNull(),
    nights: integer("nights").notNull(),
    embarkPortName: text("embark_port_name"),
    embarkPortCanonicalPlaceId: text("embark_port_canonical_place_id"),
    disembarkPortName: text("disembark_port_name"),
    disembarkPortCanonicalPlaceId: text("disembark_port_canonical_place_id"),
    regionIds: jsonb("region_ids").$type<string[]>().default([]),
    waterwayIds: jsonb("waterway_ids").$type<string[]>().default([]),
    portIds: jsonb("port_ids").$type<string[]>().default([]),
    countryIso: jsonb("country_iso").$type<string[]>().default([]),
    regions: jsonb("regions").$type<string[]>().default([]),
    waterways: jsonb("waterways").$type<string[]>().default([]),
    ports: jsonb("ports").$type<string[]>().default([]),
    countries: jsonb("countries").$type<string[]>().default([]),
    themes: jsonb("themes").$type<string[]>().default([]),
    earliestDeparture: date("earliest_departure"),
    latestDeparture: date("latest_departure"),
    departureCount: integer("departure_count"),
    lowestPriceCents: integer("lowest_price_cents"),
    lowestPriceCurrency: char("lowest_price_currency", { length: 3 }),
    salesStatus: text("sales_status"),
    heroImageUrl: text("hero_image_url"),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_cruise_search_index_slug").on(table.slug),
    index("idx_cruise_search_index_source_refreshed").on(table.source, table.refreshedAt),
    index("idx_cruise_search_index_type_price").on(table.cruiseType, table.lowestPriceCents),
    index("idx_cruise_search_index_earliest_departure").on(table.earliestDeparture),
    index("idx_cruise_search_index_latest_departure").on(table.latestDeparture),
    index("idx_cruise_search_index_embark_place").on(table.embarkPortCanonicalPlaceId),
    index("idx_cruise_search_index_disembark_place").on(table.disembarkPortCanonicalPlaceId),
    index("idx_cruise_search_index_region_ids_gin").using("gin", table.regionIds),
    index("idx_cruise_search_index_waterway_ids_gin").using("gin", table.waterwayIds),
    index("idx_cruise_search_index_port_ids_gin").using("gin", table.portIds),
    index("idx_cruise_search_index_country_iso_gin").using("gin", table.countryIso),
    index("idx_cruise_search_index_regions_gin").using("gin", table.regions),
    index("idx_cruise_search_index_waterways_gin").using("gin", table.waterways),
    index("idx_cruise_search_index_ports_gin").using("gin", table.ports),
    index("idx_cruise_search_index_countries_gin").using("gin", table.countries),
    index("idx_cruise_search_index_themes_gin").using("gin", table.themes),
    uniqueIndex("uidx_cruise_search_index_external")
      .on(table.sourceProvider, table.sourceRef)
      .where(sql`${table.source} = 'external'`),
  ],
)

export type CruiseSearchIndexRow = typeof cruiseSearchIndex.$inferSelect
export type NewCruiseSearchIndexRow = typeof cruiseSearchIndex.$inferInsert
