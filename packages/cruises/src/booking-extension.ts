import { OpenAPIHono } from "@hono/zod-openapi"
import type { Extension } from "@voyant-travel/core"
import { typeIdRef } from "@voyant-travel/db/lib/typeid-column"
import { parseJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { eq } from "drizzle-orm"
import {
  char,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

import type { ExternalPassengerComposition, SourceRef } from "./adapters/index.js"
import { cruiseSourceEnum, priceFareVariantEnum } from "./schema-shared.js"
import type { QuoteBookingTerms, QuoteComponent } from "./service-pricing.js"

// ---------- enums ----------

export const cruiseBookingModeEnum = pgEnum("cruise_booking_mode", ["inquiry", "reserve"])

/**
 * Air-arrangement choice on a cruise booking. Per
 * booking-journey-architecture §7. The cruise booking carries the
 * intent; the flight booking line itself lives in the flights
 * vertical (or with the customer when "independent").
 */
export const cruiseAirArrangementEnum = pgEnum("cruise_air_arrangement", [
  "cruise_line",
  "independent",
  "none",
])

// ---------- schemas ----------

export const bookingCruiseDetails = pgTable(
  "booking_cruise_details",
  {
    bookingId: text("booking_id").primaryKey(),
    // Provenance — 'local' bookings reference local sailing/cabin rows;
    // 'external' bookings carry a sourceRef back to the upstream adapter
    // and have nullable local FK columns.
    source: cruiseSourceEnum("source").notNull().default("local"),
    sourceProvider: text("source_provider"),
    sourceRef: jsonb("source_ref").$type<SourceRef>(),
    sailingId: typeIdRef("sailing_id"),
    cabinCategoryId: typeIdRef("cabin_category_id"),
    cabinId: typeIdRef("cabin_id"),
    // Display / search hints — populated for both local and external so the UI
    // can render booking history without resolving the sailing every time.
    sailingDisplayName: text("sailing_display_name"),
    cabinDisplayName: text("cabin_display_name"),
    occupancy: smallint("occupancy").notNull(),
    fareCode: text("fare_code"),
    fareVariant: priceFareVariantEnum("fare_variant").notNull().default("cruise_only"),
    mode: cruiseBookingModeEnum("mode").notNull().default("inquiry"),
    quotedPricePerPerson: numeric("quoted_price_per_person", { precision: 12, scale: 2 }).notNull(),
    quotedTotalForCabin: numeric("quoted_total_for_cabin", { precision: 12, scale: 2 }).notNull(),
    quotedCurrency: char("quoted_currency", { length: 3 }).notNull(),
    quotedComponentsJson: jsonb("quoted_components_json").$type<QuoteComponent[]>().default([]),
    bookingTermsSnapshotJson: jsonb("booking_terms_snapshot_json").$type<QuoteBookingTerms>(),
    passengerCompositionSnapshotJson: jsonb(
      "passenger_composition_snapshot_json",
    ).$type<ExternalPassengerComposition>(),
    connectorBookingRef: text("connector_booking_ref"),
    connectorStatus: text("connector_status"),
    /**
     * Air-arrangement choice carried alongside the cruise. Per
     * booking-journey-architecture §7 — cruises take the booking
     * line for the cabin; the actual flight booking lives in the
     * flights vertical and is the multi-line composer's concern.
     * This column captures the customer's intent so ops can route
     * follow-up:
     *   - "cruise_line"  — operator must arrange flights with the
     *                      cruise line's air desk.
     *   - "independent"  — customer is booking flights themselves
     *                      (or via a separate flight-booking line
     *                      orchestrated by the composer).
     *   - "none"         — no flights needed (regional / drive-to).
     *   - null           — choice not collected (legacy bookings).
     */
    airArrangement: cruiseAirArrangementEnum("air_arrangement"),
    /** Free-form pointer to the linked flight booking when the
     *  composer ties cabin + flight lines together. Plain text per
     *  schema-discipline (cross-domain refs go through links). */
    linkedFlightBookingId: text("linked_flight_booking_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bcd_source").on(t.source),
    index("idx_bcd_sailing").on(t.sailingId),
    index("idx_bcd_cabin_category").on(t.cabinCategoryId),
    index("idx_bcd_connector_ref").on(t.connectorBookingRef),
    index("idx_bcd_provider").on(t.sourceProvider),
    index("idx_bcd_air_arrangement").on(t.airArrangement),
  ],
)

export type BookingCruiseDetail = typeof bookingCruiseDetails.$inferSelect
export type NewBookingCruiseDetail = typeof bookingCruiseDetails.$inferInsert

export const bookingGroupCruiseDetails = pgTable(
  "booking_group_cruise_details",
  {
    bookingGroupId: text("booking_group_id").primaryKey(),
    source: cruiseSourceEnum("source").notNull().default("local"),
    sourceProvider: text("source_provider"),
    sourceRef: jsonb("source_ref").$type<SourceRef>(),
    sailingId: typeIdRef("sailing_id"),
    sailingDisplayName: text("sailing_display_name"),
    cabinCount: smallint("cabin_count").notNull(),
    totalQuotedAmount: numeric("total_quoted_amount", { precision: 12, scale: 2 }).notNull(),
    quotedCurrency: char("quoted_currency", { length: 3 }).notNull(),
    connectorBookingRef: text("connector_booking_ref"),
    bookingTermsSnapshotJson: jsonb("booking_terms_snapshot_json").$type<QuoteBookingTerms>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bgcd_source").on(t.source),
    index("idx_bgcd_sailing").on(t.sailingId),
    index("idx_bgcd_connector_ref").on(t.connectorBookingRef),
    index("idx_bgcd_provider").on(t.sourceProvider),
  ],
)

export type BookingGroupCruiseDetail = typeof bookingGroupCruiseDetails.$inferSelect
export type NewBookingGroupCruiseDetail = typeof bookingGroupCruiseDetails.$inferInsert

// ---------- validation ----------

const sourceRefValueSchema = z
  .object({
    connectionId: z.string().optional(),
    externalId: z.string(),
  })
  .catchall(z.unknown())

const passengerCompositionValueSchema = z
  .object({
    adults: z.number().int().min(0),
    children: z.number().int().min(0).optional(),
    infants: z.number().int().min(0).optional(),
    seniors: z.number().int().min(0).optional(),
    childAges: z.array(z.number().int().min(0).max(17)).optional(),
  })
  .catchall(z.unknown())

const cruiseDetailUpsertSchema = z
  .object({
    source: z.enum(["local", "external"]).default("local"),
    sourceProvider: z.string().optional().nullable(),
    sourceRef: sourceRefValueSchema.optional().nullable(),
    sailingId: z.string().optional().nullable(),
    cabinCategoryId: z.string().optional().nullable(),
    cabinId: z.string().optional().nullable(),
    sailingDisplayName: z.string().optional().nullable(),
    cabinDisplayName: z.string().optional().nullable(),
    occupancy: z.number().int().min(1).max(8),
    fareCode: z.string().optional().nullable(),
    fareVariant: z.enum(["cruise_only", "air_inclusive"]).default("cruise_only"),
    mode: z.enum(["inquiry", "reserve"]).default("inquiry"),
    quotedPricePerPerson: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
    quotedTotalForCabin: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
    quotedCurrency: z.string().length(3),
    quotedComponentsJson: z.array(z.unknown()).optional().nullable(),
    bookingTermsSnapshotJson: z.record(z.string(), z.unknown()).optional().nullable(),
    passengerCompositionSnapshotJson: passengerCompositionValueSchema.optional().nullable(),
    connectorBookingRef: z.string().optional().nullable(),
    connectorStatus: z.string().optional().nullable(),
    airArrangement: z.enum(["cruise_line", "independent", "none"]).optional().nullable(),
    linkedFlightBookingId: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "local") {
      if (!value.sailingId)
        ctx.addIssue({
          code: "custom",
          path: ["sailingId"],
          message: "sailingId is required when source='local'",
        })
      if (!value.cabinCategoryId)
        ctx.addIssue({
          code: "custom",
          path: ["cabinCategoryId"],
          message: "cabinCategoryId is required when source='local'",
        })
    } else {
      if (!value.sourceProvider)
        ctx.addIssue({
          code: "custom",
          path: ["sourceProvider"],
          message: "sourceProvider is required when source='external'",
        })
      if (!value.sourceRef)
        ctx.addIssue({
          code: "custom",
          path: ["sourceRef"],
          message: "sourceRef is required when source='external'",
        })
    }
  })

const groupCruiseDetailUpsertSchema = z
  .object({
    source: z.enum(["local", "external"]).default("local"),
    sourceProvider: z.string().optional().nullable(),
    sourceRef: sourceRefValueSchema.optional().nullable(),
    sailingId: z.string().optional().nullable(),
    sailingDisplayName: z.string().optional().nullable(),
    cabinCount: z.number().int().min(1).max(20),
    totalQuotedAmount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
    quotedCurrency: z.string().length(3),
    connectorBookingRef: z.string().optional().nullable(),
    bookingTermsSnapshotJson: z.record(z.string(), z.unknown()).optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "local" && !value.sailingId) {
      ctx.addIssue({
        code: "custom",
        path: ["sailingId"],
        message: "sailingId is required when source='local'",
      })
    }
    if (value.source === "external") {
      if (!value.sourceProvider)
        ctx.addIssue({
          code: "custom",
          path: ["sourceProvider"],
          message: "sourceProvider is required when source='external'",
        })
      if (!value.sourceRef)
        ctx.addIssue({
          code: "custom",
          path: ["sourceRef"],
          message: "sourceRef is required when source='external'",
        })
    }
  })

// ---------- services ----------

export const bookingCruiseDetailsService = {
  async get(db: PostgresJsDatabase, bookingId: string): Promise<BookingCruiseDetail | null> {
    const [row] = await db
      .select()
      .from(bookingCruiseDetails)
      .where(eq(bookingCruiseDetails.bookingId, bookingId))
      .limit(1)
    return row ?? null
  },

  async upsert(
    db: PostgresJsDatabase,
    bookingId: string,
    data: z.infer<typeof cruiseDetailUpsertSchema>,
  ): Promise<BookingCruiseDetail> {
    const [existing] = await db
      .select()
      .from(bookingCruiseDetails)
      .where(eq(bookingCruiseDetails.bookingId, bookingId))
      .limit(1)

    const payload: NewBookingCruiseDetail = {
      ...data,
      bookingId,
      quotedComponentsJson: (data.quotedComponentsJson ?? []) as QuoteComponent[],
    }

    if (existing) {
      const [row] = await db
        .update(bookingCruiseDetails)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(bookingCruiseDetails.bookingId, bookingId))
        .returning()
      if (!row) throw new Error("Failed to update booking cruise details")
      return row
    }

    const [row] = await db.insert(bookingCruiseDetails).values(payload).returning()
    if (!row) throw new Error("Failed to insert booking cruise details")
    return row
  },

  async remove(db: PostgresJsDatabase, bookingId: string): Promise<boolean> {
    const result = await db
      .delete(bookingCruiseDetails)
      .where(eq(bookingCruiseDetails.bookingId, bookingId))
      .returning({ id: bookingCruiseDetails.bookingId })
    return result.length > 0
  },
}

export const bookingGroupCruiseDetailsService = {
  async get(
    db: PostgresJsDatabase,
    bookingGroupId: string,
  ): Promise<BookingGroupCruiseDetail | null> {
    const [row] = await db
      .select()
      .from(bookingGroupCruiseDetails)
      .where(eq(bookingGroupCruiseDetails.bookingGroupId, bookingGroupId))
      .limit(1)
    return row ?? null
  },

  async upsert(
    db: PostgresJsDatabase,
    bookingGroupId: string,
    data: z.infer<typeof groupCruiseDetailUpsertSchema>,
  ): Promise<BookingGroupCruiseDetail> {
    const [existing] = await db
      .select()
      .from(bookingGroupCruiseDetails)
      .where(eq(bookingGroupCruiseDetails.bookingGroupId, bookingGroupId))
      .limit(1)

    const payload: NewBookingGroupCruiseDetail = { ...data, bookingGroupId }

    if (existing) {
      const [row] = await db
        .update(bookingGroupCruiseDetails)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(bookingGroupCruiseDetails.bookingGroupId, bookingGroupId))
        .returning()
      if (!row) throw new Error("Failed to update booking group cruise details")
      return row
    }

    const [row] = await db.insert(bookingGroupCruiseDetails).values(payload).returning()
    if (!row) throw new Error("Failed to insert booking group cruise details")
    return row
  },

  async remove(db: PostgresJsDatabase, bookingGroupId: string): Promise<boolean> {
    const result = await db
      .delete(bookingGroupCruiseDetails)
      .where(eq(bookingGroupCruiseDetails.bookingGroupId, bookingGroupId))
      .returning({ id: bookingGroupCruiseDetails.bookingGroupId })
    return result.length > 0
  },
}

// ---------- routes ----------

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const CRUISES_BOOKING_OPENAPI_API_ID = "@voyant-travel/cruises#booking-extension.api.admin"

export const cruisesBookingExtensionRoutes = new OpenAPIHono<Env>()
  .get("/:bookingId/cruise-details", async (c) => {
    const bookingId = c.req.param("bookingId")
    const row = await bookingCruiseDetailsService.get(c.get("db"), bookingId)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .put("/:bookingId/cruise-details", async (c) => {
    const bookingId = c.req.param("bookingId")
    const data = await parseJsonBody(c, cruiseDetailUpsertSchema)
    const row = await bookingCruiseDetailsService.upsert(c.get("db"), bookingId, data)
    return c.json({ data: row })
  })
  .delete("/:bookingId/cruise-details", async (c) => {
    const bookingId = c.req.param("bookingId")
    const ok = await bookingCruiseDetailsService.remove(c.get("db"), bookingId)
    if (!ok) return c.json({ error: "not_found" }, 404)
    return c.body(null, 204)
  })

  .get("/groups/:groupId/cruise-details", async (c) => {
    const groupId = c.req.param("groupId")
    const row = await bookingGroupCruiseDetailsService.get(c.get("db"), groupId)
    if (!row) return c.json({ error: "not_found" }, 404)
    return c.json({ data: row })
  })
  .put("/groups/:groupId/cruise-details", async (c) => {
    const groupId = c.req.param("groupId")
    const data = await parseJsonBody(c, groupCruiseDetailUpsertSchema)
    const row = await bookingGroupCruiseDetailsService.upsert(c.get("db"), groupId, data)
    return c.json({ data: row })
  })
  .delete("/groups/:groupId/cruise-details", async (c) => {
    const groupId = c.req.param("groupId")
    const ok = await bookingGroupCruiseDetailsService.remove(c.get("db"), groupId)
    if (!ok) return c.json({ error: "not_found" }, 404)
    return c.body(null, 204)
  })

for (const [method, path] of [
  ["get", "/{bookingId}/cruise-details"],
  ["put", "/{bookingId}/cruise-details"],
  ["delete", "/{bookingId}/cruise-details"],
  ["get", "/groups/{groupId}/cruise-details"],
  ["put", "/groups/{groupId}/cruise-details"],
  ["delete", "/groups/{groupId}/cruise-details"],
] as const) {
  cruisesBookingExtensionRoutes.openAPIRegistry.registerPath({
    method,
    path,
    responses: { 200: { description: "Cruise booking detail response." } },
    "x-voyant-api-id": CRUISES_BOOKING_OPENAPI_API_ID,
  })
}

// ---------- HonoExtension export ----------

const cruisesBookingExtensionDef: Extension = {
  name: "cruises-booking",
  module: "bookings",
}

export const cruisesBookingExtension: HonoExtension = {
  extension: cruisesBookingExtensionDef,
  adminRoutes: cruisesBookingExtensionRoutes,
}
