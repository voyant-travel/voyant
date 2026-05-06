import { integer, jsonb, text, timestamp } from "drizzle-orm/pg-core"

import { typeIdRef } from "../lib/typeid-column.js"

/**
 * Core product accommodation options columns shared between db-main and db-marketplace.
 * propertyId: null = custom accommodation, set = linked from properties
 */
export function productAccommodationOptionsCoreColumns() {
  return {
    name: text("name").notNull(),
    propertyId: typeIdRef("property_id"), // null = custom, set = linked from property
    provider: jsonb("provider").notNull().default("{}"),
    location: jsonb("location"),
    attributes: jsonb("attributes").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
}

/**
 * Core product accommodation option rooms columns shared between db-main and db-marketplace.
 */
export function productAccommodationOptionRoomsCoreColumns() {
  return {
    title: text("title").notNull(),
    description: text("description"),
    occupancy: jsonb("occupancy")
      .notNull()
      .default('{"adults_min": 1, "adults_max": 2, "children_min": 0, "children_max": 0}'),
    bedsCount: integer("beds_count"),
    bedConfig: text("bed_config").array().notNull().default([]),
    amenities: text("amenities").array().notNull().default([]),
    media: jsonb("media").notNull().default("[]"),
    attributes: jsonb("attributes").notNull().default("{}"),
    sort: integer("sort").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
}

/**
 * Core product accommodation sets columns shared between db-main and db-marketplace.
 */
export function productAccommodationSetsCoreColumns() {
  return {
    name: text("name").notNull(),
    selectionStrategy: text("selection_strategy").notNull().default("priority"),
    rule: jsonb("rule").notNull().default("{}"),
    defaults: jsonb("defaults").notNull().default("{}"),
    media: jsonb("media").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
}

/**
 * Core product accommodation set items columns shared between db-main and db-marketplace.
 */
export function productAccommodationSetItemsCoreColumns() {
  return {
    board: text("board"),
    priority: integer("priority").notNull().default(0),
    pricingSource: text("pricing_source").notNull().default("manual"),
    pricing: jsonb("pricing").notNull().default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
}
