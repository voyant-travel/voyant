import type { Extension } from "@voyantjs/core"
import { parseJsonBody } from "@voyantjs/hono"
import type { HonoExtension } from "@voyantjs/hono/module"
import { eq } from "drizzle-orm"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { Hono } from "hono"
import { z } from "zod"

// ---------- schemas ----------

export const bookingProductDetails = pgTable(
  "booking_product_details",
  {
    bookingId: text("booking_id").primaryKey(),
    productId: text("product_id"),
    optionId: text("option_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_bpd_product").on(t.productId), index("idx_bpd_option").on(t.optionId)],
)

export type BookingProductDetail = typeof bookingProductDetails.$inferSelect
export type NewBookingProductDetail = typeof bookingProductDetails.$inferInsert

export const bookingItemProductDetails = pgTable(
  "booking_item_product_details",
  {
    bookingItemId: text("booking_item_id").primaryKey(),
    productId: text("product_id"),
    optionId: text("option_id"),
    unitId: text("unit_id"),
    supplierServiceId: text("supplier_service_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_bipd_product").on(t.productId),
    index("idx_bipd_option").on(t.optionId),
    index("idx_bipd_unit").on(t.unitId),
    index("idx_bipd_supplier_service").on(t.supplierServiceId),
  ],
)

export type BookingItemProductDetail = typeof bookingItemProductDetails.$inferSelect
export type NewBookingItemProductDetail = typeof bookingItemProductDetails.$inferInsert

// ---------- validation ----------

const bookingProductDetailSchema = z.object({
  productId: z.string().optional().nullable(),
  optionId: z.string().optional().nullable(),
})

const bookingItemProductDetailSchema = z.object({
  productId: z.string().optional().nullable(),
  optionId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  supplierServiceId: z.string().optional().nullable(),
})

// ---------- service ----------

export const bookingProductExtensionService = {
  async getBookingDetails(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .select()
      .from(bookingProductDetails)
      .where(eq(bookingProductDetails.bookingId, bookingId))
      .limit(1)
    return row ?? null
  },

  async upsertBookingDetails(
    db: PostgresJsDatabase,
    bookingId: string,
    data: z.infer<typeof bookingProductDetailSchema>,
  ) {
    const [row] = await db
      .insert(bookingProductDetails)
      .values({
        bookingId,
        productId: data.productId ?? null,
        optionId: data.optionId ?? null,
      })
      .onConflictDoUpdate({
        target: bookingProductDetails.bookingId,
        set: {
          productId: data.productId ?? null,
          optionId: data.optionId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row ?? null
  },

  async removeBookingDetails(db: PostgresJsDatabase, bookingId: string) {
    const [row] = await db
      .delete(bookingProductDetails)
      .where(eq(bookingProductDetails.bookingId, bookingId))
      .returning({ bookingId: bookingProductDetails.bookingId })
    return row ?? null
  },

  async getItemDetails(db: PostgresJsDatabase, bookingItemId: string) {
    const [row] = await db
      .select()
      .from(bookingItemProductDetails)
      .where(eq(bookingItemProductDetails.bookingItemId, bookingItemId))
      .limit(1)
    return row ?? null
  },

  async upsertItemDetails(
    db: PostgresJsDatabase,
    bookingItemId: string,
    data: z.infer<typeof bookingItemProductDetailSchema>,
  ) {
    const [row] = await db
      .insert(bookingItemProductDetails)
      .values({
        bookingItemId,
        productId: data.productId ?? null,
        optionId: data.optionId ?? null,
        unitId: data.unitId ?? null,
        supplierServiceId: data.supplierServiceId ?? null,
      })
      .onConflictDoUpdate({
        target: bookingItemProductDetails.bookingItemId,
        set: {
          productId: data.productId ?? null,
          optionId: data.optionId ?? null,
          unitId: data.unitId ?? null,
          supplierServiceId: data.supplierServiceId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row ?? null
  },

  async removeItemDetails(db: PostgresJsDatabase, bookingItemId: string) {
    const [row] = await db
      .delete(bookingItemProductDetails)
      .where(eq(bookingItemProductDetails.bookingItemId, bookingItemId))
      .returning({ bookingItemId: bookingItemProductDetails.bookingItemId })
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

const bookingProductExtensionRoutes = new Hono<Env>()

  .get("/:bookingId/product-details", async (c) => {
    const row = await bookingProductExtensionService.getBookingDetails(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!row) {
      return c.json({ data: null })
    }
    return c.json({ data: row })
  })

  .put("/:bookingId/product-details", async (c) => {
    const data = await parseJsonBody(c, bookingProductDetailSchema)
    const row = await bookingProductExtensionService.upsertBookingDetails(
      c.get("db"),
      c.req.param("bookingId"),
      data,
    )
    return c.json({ data: row })
  })

  .delete("/:bookingId/product-details", async (c) => {
    const row = await bookingProductExtensionService.removeBookingDetails(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!row) {
      return c.json({ error: "Not found" }, 404)
    }
    return c.json({ success: true })
  })

  .get("/:bookingId/items/:itemId/product-details", async (c) => {
    const row = await bookingProductExtensionService.getItemDetails(
      c.get("db"),
      c.req.param("itemId"),
    )
    if (!row) {
      return c.json({ data: null })
    }
    return c.json({ data: row })
  })

  .put("/:bookingId/items/:itemId/product-details", async (c) => {
    const data = await parseJsonBody(c, bookingItemProductDetailSchema)
    const row = await bookingProductExtensionService.upsertItemDetails(
      c.get("db"),
      c.req.param("itemId"),
      data,
    )
    return c.json({ data: row })
  })

  .delete("/:bookingId/items/:itemId/product-details", async (c) => {
    const row = await bookingProductExtensionService.removeItemDetails(
      c.get("db"),
      c.req.param("itemId"),
    )
    if (!row) {
      return c.json({ error: "Not found" }, 404)
    }
    return c.json({ success: true })
  })

// ---------- extension export ----------

const productsBookingExtensionDef: Extension = {
  name: "products-booking",
  module: "bookings",
}

export const productsBookingExtension: HonoExtension = {
  extension: productsBookingExtensionDef,
  routes: bookingProductExtensionRoutes,
}
