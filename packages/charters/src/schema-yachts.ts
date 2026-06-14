import { typeId } from "@voyant-travel/db/lib/typeid-column"
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { yachtClassEnum } from "./schema-shared.js"

type CrewBio = {
  role: string
  name: string
  bio?: string
  photoUrl?: string
}

export const charterYachts = pgTable(
  "charter_yachts",
  {
    id: typeId("charter_yachts"),
    lineSupplierId: text("line_supplier_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    yachtClass: yachtClassEnum("yacht_class").notNull(),
    capacityGuests: integer("capacity_guests"),
    capacityCrew: integer("capacity_crew"),
    lengthMeters: numeric("length_meters", { precision: 8, scale: 2 }),
    yearBuilt: integer("year_built"),
    yearRefurbished: integer("year_refurbished"),
    imo: text("imo"),
    description: text("description"),
    gallery: jsonb("gallery").$type<string[]>().default([]),
    amenities: jsonb("amenities").$type<Record<string, unknown>>().default({}),
    crewBios: jsonb("crew_bios").$type<CrewBio[]>().default([]),
    defaultCharterAreas: jsonb("default_charter_areas").$type<string[]>().default([]),
    externalRefs: jsonb("external_refs").$type<Record<string, string>>().default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uidx_charter_yachts_slug").on(table.slug),
    uniqueIndex("uidx_charter_yachts_imo").on(table.imo),
    index("idx_charter_yachts_supplier_active").on(table.lineSupplierId, table.isActive),
    index("idx_charter_yachts_class_active").on(table.yachtClass, table.isActive),
  ],
)

export type CharterYacht = typeof charterYachts.$inferSelect
export type NewCharterYacht = typeof charterYachts.$inferInsert
