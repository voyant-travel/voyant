import { typeId, typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { facilities } from "./schema.js"

/**
 * Function spaces — the bookable meeting/event sub-spaces of a venue facility
 * (ballroom → breakout rooms → booths). A space can nest under another via
 * `parentSpaceId` (combinable rooms; exhibition booths are just child spaces).
 * Capacity is per-layout (the same room seats a different headcount theater vs
 * banquet). See RFC voyant#1489 (Phase 2).
 */
export const functionSpaceLayoutEnum = pgEnum("function_space_layout", [
  "theater",
  "classroom",
  "banquet",
  "cabaret",
  "boardroom",
  "u_shape",
  "reception",
  "hollow_square",
])

export const functionSpaces = pgTable(
  "function_spaces",
  {
    id: typeId("function_spaces"),
    // Intra-package FK (function_spaces + facilities both live in operations):
    facilityId: typeIdRef("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    parentSpaceId: typeIdRef("parent_space_id").references((): AnyPgColumn => functionSpaces.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    code: text("code"),
    description: text("description"),
    areaSqm: doublePrecision("area_sqm"),
    divisible: boolean("divisible").notNull().default(false),
    defaultLayout: functionSpaceLayoutEnum("default_layout"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_function_spaces_facility_sort_name").on(
      table.facilityId,
      table.sortOrder,
      table.name,
    ),
    index("idx_function_spaces_parent").on(table.parentSpaceId),
    index("idx_function_spaces_active_sort_name").on(table.active, table.sortOrder, table.name),
    uniqueIndex("uidx_function_spaces_facility_code").on(table.facilityId, table.code),
  ],
)

export const functionSpaceCapacities = pgTable(
  "function_space_capacities",
  {
    id: typeId("function_space_capacities"),
    spaceId: typeIdRef("space_id")
      .notNull()
      .references(() => functionSpaces.id, { onDelete: "cascade" }),
    layout: functionSpaceLayoutEnum("layout").notNull(),
    capacity: integer("capacity").notNull(),
  },
  (table) => [
    uniqueIndex("uidx_function_space_capacities_space_layout").on(table.spaceId, table.layout),
    check("ck_function_space_capacities_nonneg", sql`capacity >= 0`),
  ],
)

export type FunctionSpace = typeof functionSpaces.$inferSelect
export type NewFunctionSpace = typeof functionSpaces.$inferInsert
export type FunctionSpaceCapacity = typeof functionSpaceCapacities.$inferSelect
export type NewFunctionSpaceCapacity = typeof functionSpaceCapacities.$inferInsert
