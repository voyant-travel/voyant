import type { Extension } from "@voyant-travel/core"
import { parseJsonBody } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { eq } from "drizzle-orm"
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

// ---------- schema ----------

export const bookingPaymentOwnerEnum = pgEnum("booking_dist_payment_owner", [
  "operator",
  "channel",
  "split",
])

export const bookingDistributionDetails = pgTable(
  "booking_distribution_details",
  {
    bookingId: text("booking_id").primaryKey(),
    marketId: text("market_id"),
    sourceChannelId: text("source_channel_id"),
    fxRateSetId: text("fx_rate_set_id"),
    paymentOwner: bookingPaymentOwnerEnum("payment_owner").notNull().default("operator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bdd_market").on(t.marketId),
    index("idx_bdd_source_channel").on(t.sourceChannelId),
    index("idx_bdd_fx_rate_set").on(t.fxRateSetId),
  ],
)

export type BookingDistributionDetail = typeof bookingDistributionDetails.$inferSelect
export type NewBookingDistributionDetail = typeof bookingDistributionDetails.$inferInsert

// ---------- validation ----------

const bookingDistPaymentOwnerSchema = z.enum(["operator", "channel", "split"])

const bookingDistributionDetailSchema = z.object({
  marketId: z.string().optional().nullable(),
  sourceChannelId: z.string().optional().nullable(),
  fxRateSetId: z.string().optional().nullable(),
  paymentOwner: bookingDistPaymentOwnerSchema.default("operator"),
})

// ---------- service ----------

export const bookingDistributionExtensionService = {
  async get(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .select()
      .from(bookingDistributionDetails)
      .where(eq(bookingDistributionDetails.bookingId, bookingId))
      .limit(1)
    return row ?? null
  },

  async upsert(
    db: PostgresJsDatabase,
    bookingId: string,
    data: z.infer<typeof bookingDistributionDetailSchema>,
  ) {
    const [row] = await db
      .insert(bookingDistributionDetails)
      .values({
        bookingId,
        marketId: data.marketId ?? null,
        sourceChannelId: data.sourceChannelId ?? null,
        fxRateSetId: data.fxRateSetId ?? null,
        paymentOwner: data.paymentOwner ?? "operator",
      })
      .onConflictDoUpdate({
        target: bookingDistributionDetails.bookingId,
        set: {
          marketId: data.marketId ?? null,
          sourceChannelId: data.sourceChannelId ?? null,
          fxRateSetId: data.fxRateSetId ?? null,
          paymentOwner: data.paymentOwner ?? "operator",
          updatedAt: new Date(),
        },
      })
      .returning()
    return row ?? null
  },

  async remove(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .delete(bookingDistributionDetails)
      .where(eq(bookingDistributionDetails.bookingId, bookingId))
      .returning({ bookingId: bookingDistributionDetails.bookingId })
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

const bookingDistributionExtensionRoutes = new Hono<Env>()

  .get("/:bookingId/distribution-details", async (c) => {
    const row = await bookingDistributionExtensionService.get(c.get("db"), c.req.param("bookingId"))
    if (!row) {
      return c.json({ data: null })
    }
    return c.json({ data: row })
  })

  .put("/:bookingId/distribution-details", async (c) => {
    const data = await parseJsonBody(c, bookingDistributionDetailSchema)
    const row = await bookingDistributionExtensionService.upsert(
      c.get("db"),
      c.req.param("bookingId"),
      data,
    )
    return c.json({ data: row })
  })

  .delete("/:bookingId/distribution-details", async (c) => {
    const row = await bookingDistributionExtensionService.remove(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!row) {
      return c.json({ error: "Not found" }, 404)
    }
    return c.json({ success: true })
  })

// ---------- extension export ----------

const distributionBookingExtensionDef: Extension = {
  name: "distribution-booking",
  module: "bookings",
}

export const distributionBookingExtension: HonoExtension = {
  extension: distributionBookingExtensionDef,
  routes: bookingDistributionExtensionRoutes,
}
