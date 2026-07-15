import { OpenAPIHono } from "@hono/zod-openapi"
import type { Extension } from "@voyant-travel/core"
import { parseJsonBody } from "@voyant-travel/hono"
import type { ApiExtension } from "@voyant-travel/hono/module"
import { eq } from "drizzle-orm"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { z } from "zod"

// ---------- schema ----------

export const bookingQuoteDetails = pgTable(
  "booking_crm_details",
  {
    bookingId: text("booking_id").primaryKey(),
    quoteId: text("quote_id"),
    quoteVersionId: text("quote_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bcd_quote").on(t.quoteId),
    index("idx_bcd_quote_version").on(t.quoteVersionId),
  ],
)

export type BookingQuoteDetail = typeof bookingQuoteDetails.$inferSelect
export type NewBookingQuoteDetail = typeof bookingQuoteDetails.$inferInsert

// ---------- validation ----------

const bookingQuoteDetailSchema = z.object({
  quoteId: z.string().optional().nullable(),
  quoteVersionId: z.string().optional().nullable(),
})

// ---------- service ----------

export const bookingQuoteExtensionService = {
  async get(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .select()
      .from(bookingQuoteDetails)
      .where(eq(bookingQuoteDetails.bookingId, bookingId))
      .limit(1)
    return row ?? null
  },

  async upsert(
    db: PostgresJsDatabase,
    bookingId: string,
    data: z.infer<typeof bookingQuoteDetailSchema>,
  ) {
    const [row] = await db
      .insert(bookingQuoteDetails)
      .values({
        bookingId,
        quoteId: data.quoteId ?? null,
        quoteVersionId: data.quoteVersionId ?? null,
      })
      .onConflictDoUpdate({
        target: bookingQuoteDetails.bookingId,
        set: {
          quoteId: data.quoteId ?? null,
          quoteVersionId: data.quoteVersionId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row ?? null
  },

  async remove(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .delete(bookingQuoteDetails)
      .where(eq(bookingQuoteDetails.bookingId, bookingId))
      .returning({ bookingId: bookingQuoteDetails.bookingId })
    return row ?? null
  },
}

// ---------- routes ----------

type Env = {
  Variables: {
    db: PostgresJsDatabase
    userId?: string
  }
}

export const QUOTES_BOOKING_OPENAPI_API_ID = "@voyant-travel/quotes#booking-extension.api"

export const bookingQuoteExtensionRoutes = new OpenAPIHono<Env>()

bookingQuoteExtensionRoutes
  .get("/:bookingId/quote-details", async (c) => {
    const row = await bookingQuoteExtensionService.get(c.get("db"), c.req.param("bookingId"))
    if (!row) {
      return c.json({ data: null })
    }
    return c.json({ data: row })
  })

  .put("/:bookingId/quote-details", async (c) => {
    const data = await parseJsonBody(c, bookingQuoteDetailSchema)
    const row = await bookingQuoteExtensionService.upsert(
      c.get("db"),
      c.req.param("bookingId"),
      data,
    )
    return c.json({ data: row })
  })

  .delete("/:bookingId/quote-details", async (c) => {
    const row = await bookingQuoteExtensionService.remove(c.get("db"), c.req.param("bookingId"))
    if (!row) {
      return c.json({ error: "Not found" }, 404)
    }
    return c.json({ success: true })
  })

for (const [method, path] of [
  ["get", "/{bookingId}/quote-details"],
  ["put", "/{bookingId}/quote-details"],
  ["delete", "/{bookingId}/quote-details"],
] as const) {
  bookingQuoteExtensionRoutes.openAPIRegistry.registerPath({
    method,
    path,
    responses: { 200: { description: "Quote booking detail response." } },
    "x-voyant-api-id": QUOTES_BOOKING_OPENAPI_API_ID,
  })
}

// ---------- extension export ----------

const quotesBookingExtensionDef: Extension = {
  name: "quotes-booking",
  module: "bookings",
}

export const quotesBookingExtension: ApiExtension = {
  extension: quotesBookingExtensionDef,
  adminRoutes: bookingQuoteExtensionRoutes,
}
