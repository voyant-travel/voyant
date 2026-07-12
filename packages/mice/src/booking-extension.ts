import { OpenAPIHono } from "@hono/zod-openapi"
import type { Extension } from "@voyant-travel/core"
import { parseJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { eq } from "drizzle-orm"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

/**
 * MICE booking extension — a 1:1 sidecar that links a booking to its program +
 * delegate, following the established HonoExtension pattern (precedent:
 * inventory's booking-extension). `booking_id` is a loose text PK (no
 * cross-package FK), so this package doesn't depend on bookings. See RFC
 * voyant#1489 (Phase 3) §4.2.
 */
export const bookingMiceDetails = pgTable(
  "booking_mice_details",
  {
    bookingId: text("booking_id").primaryKey(),
    programId: text("program_id"),
    delegateId: text("delegate_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bkmd_program").on(t.programId), index("idx_bkmd_delegate").on(t.delegateId)],
)

export type BookingMiceDetail = typeof bookingMiceDetails.$inferSelect
export type NewBookingMiceDetail = typeof bookingMiceDetails.$inferInsert

const bookingMiceDetailSchema = z.object({
  programId: z.string().optional().nullable(),
  delegateId: z.string().optional().nullable(),
})

export const miceBookingExtensionService = {
  async getDetails(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .select()
      .from(bookingMiceDetails)
      .where(eq(bookingMiceDetails.bookingId, bookingId))
      .limit(1)
    return row ?? null
  },

  async upsertDetails(
    db: PostgresJsDatabase,
    bookingId: string,
    data: z.infer<typeof bookingMiceDetailSchema>,
  ) {
    const [row] = await db
      .insert(bookingMiceDetails)
      .values({
        bookingId,
        programId: data.programId ?? null,
        delegateId: data.delegateId ?? null,
      })
      .onConflictDoUpdate({
        target: bookingMiceDetails.bookingId,
        set: {
          programId: data.programId ?? null,
          delegateId: data.delegateId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row ?? null
  },

  async removeDetails(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .delete(bookingMiceDetails)
      .where(eq(bookingMiceDetails.bookingId, bookingId))
      .returning({ bookingId: bookingMiceDetails.bookingId })
    return row ?? null
  },
}

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const MICE_BOOKING_OPENAPI_API_ID = "@voyant-travel/mice#booking-extension.api.admin"

export const miceBookingExtensionRoutes = new OpenAPIHono<Env>()
  .get("/:bookingId/mice-details", async (c) => {
    const row = await miceBookingExtensionService.getDetails(c.get("db"), c.req.param("bookingId"))
    return c.json({ data: row })
  })

  .put("/:bookingId/mice-details", async (c) => {
    const data = await parseJsonBody(c, bookingMiceDetailSchema)
    const row = await miceBookingExtensionService.upsertDetails(
      c.get("db"),
      c.req.param("bookingId"),
      data,
    )
    return c.json({ data: row })
  })
  .delete("/:bookingId/mice-details", async (c) => {
    const row = await miceBookingExtensionService.removeDetails(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!row) return c.json({ error: "Not found" }, 404)
    return c.json({ success: true })
  })

for (const [method, path] of [
  ["get", "/{bookingId}/mice-details"],
  ["put", "/{bookingId}/mice-details"],
  ["delete", "/{bookingId}/mice-details"],
] as const) {
  miceBookingExtensionRoutes.openAPIRegistry.registerPath({
    method,
    path,
    responses: { 200: { description: "MICE booking detail response." } },
    "x-voyant-api-id": MICE_BOOKING_OPENAPI_API_ID,
  })
}

const miceBookingExtensionDef: Extension = {
  name: "mice-booking",
  module: "bookings",
}

export const miceBookingExtension: HonoExtension = {
  extension: miceBookingExtensionDef,
  adminRoutes: miceBookingExtensionRoutes,
}
