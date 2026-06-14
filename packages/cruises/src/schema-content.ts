import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { boolean, index, integer, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core"

import { cruiseSailings, cruises } from "./schema-core.js"
import {
  cruiseInclusionKindEnum,
  cruiseMediaTypeEnum,
  enrichmentProgramKindEnum,
} from "./schema-shared.js"

export const cruiseMedia = pgTable(
  "cruise_media",
  {
    id: typeId("cruise_media"),
    cruiseId: typeIdRef("cruise_id")
      .notNull()
      .references(() => cruises.id, { onDelete: "cascade" }),
    sailingId: typeIdRef("sailing_id").references(() => cruiseSailings.id, {
      onDelete: "cascade",
    }),
    mediaType: cruiseMediaTypeEnum("media_type").notNull(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    storageKey: text("storage_key"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cruise_media_cruise").on(table.cruiseId),
    index("idx_cruise_media_sailing").on(table.sailingId),
    index("idx_cruise_media_cruise_cover_sort").on(table.cruiseId, table.isCover, table.sortOrder),
  ],
)

export type CruiseMedia = typeof cruiseMedia.$inferSelect
export type NewCruiseMedia = typeof cruiseMedia.$inferInsert

export const cruiseInclusions = pgTable(
  "cruise_inclusions",
  {
    id: typeId("cruise_inclusions"),
    cruiseId: typeIdRef("cruise_id")
      .notNull()
      .references(() => cruises.id, { onDelete: "cascade" }),
    kind: cruiseInclusionKindEnum("kind").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cruise_inclusions_cruise_kind_sort").on(table.cruiseId, table.kind, table.sortOrder),
  ],
)

export type CruiseInclusion = typeof cruiseInclusions.$inferSelect
export type NewCruiseInclusion = typeof cruiseInclusions.$inferInsert

/**
 * Expedition enrichment programs — naturalists, historians, photographers,
 * lecturers, domain experts that travel with the cruise. Specific to expedition
 * (and increasingly luxury) sailings; left empty for standard ocean/river cruises.
 */
export const cruiseEnrichmentPrograms = pgTable(
  "cruise_enrichment_programs",
  {
    id: typeId("cruise_enrichment_programs"),
    cruiseId: typeIdRef("cruise_id")
      .notNull()
      .references(() => cruises.id, { onDelete: "cascade" }),
    kind: enrichmentProgramKindEnum("kind").notNull(),
    name: text("name").notNull(),
    title: text("title"),
    description: text("description"),
    bioImageUrl: text("bio_image_url"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_cruise_enrichment_programs_cruise_kind_sort").on(
      table.cruiseId,
      table.kind,
      table.sortOrder,
    ),
  ],
)

export type CruiseEnrichmentProgram = typeof cruiseEnrichmentPrograms.$inferSelect
export type NewCruiseEnrichmentProgram = typeof cruiseEnrichmentPrograms.$inferInsert
