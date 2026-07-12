import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi"
import type { Extension } from "@voyant-travel/core"
import { openApiValidationHook } from "@voyant-travel/hono"
import type { HonoExtension } from "@voyant-travel/hono/module"
import { eq } from "drizzle-orm"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

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

const bookingProductDetailSchema = z
  .object({
    productId: z.string().optional().nullable(),
    optionId: z.string().optional().nullable(),
  })
  .openapi("BookingProductDetailsInput")

const bookingItemProductDetailSchema = z
  .object({
    productId: z.string().optional().nullable(),
    optionId: z.string().optional().nullable(),
    unitId: z.string().optional().nullable(),
    supplierServiceId: z.string().optional().nullable(),
  })
  .openapi("BookingItemProductDetailsInput")

const bookingExtensionApiId = "@voyant-travel/inventory#booking-extension.api"
const bookingIdParamsSchema = z.object({ bookingId: z.string() })
const bookingItemIdParamsSchema = bookingIdParamsSchema.extend({ itemId: z.string() })

const getBookingProductDetailsRoute = createRoute({
  method: "get",
  path: "/{bookingId}/product-details",
  summary: "Get product details attached to a booking",
  "x-voyant-api-id": bookingExtensionApiId,
  request: { params: bookingIdParamsSchema },
  responses: {
    200: { description: "Booking product details, or null when absent" },
  },
})

const putBookingProductDetailsRoute = createRoute({
  method: "put",
  path: "/{bookingId}/product-details",
  summary: "Create or replace product details on a booking",
  "x-voyant-api-id": bookingExtensionApiId,
  request: {
    params: bookingIdParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: bookingProductDetailSchema } },
    },
  },
  responses: {
    200: { description: "Booking product details were stored" },
  },
})

const deleteBookingProductDetailsRoute = createRoute({
  method: "delete",
  path: "/{bookingId}/product-details",
  summary: "Remove product details from a booking",
  "x-voyant-api-id": bookingExtensionApiId,
  request: { params: bookingIdParamsSchema },
  responses: {
    200: { description: "Booking product details were removed" },
    404: { description: "No product details exist for the booking" },
  },
})

const getBookingItemProductDetailsRoute = createRoute({
  method: "get",
  path: "/{bookingId}/items/{itemId}/product-details",
  summary: "Get product details attached to a booking item",
  "x-voyant-api-id": bookingExtensionApiId,
  request: { params: bookingItemIdParamsSchema },
  responses: {
    200: { description: "Booking item product details, or null when absent" },
  },
})

const putBookingItemProductDetailsRoute = createRoute({
  method: "put",
  path: "/{bookingId}/items/{itemId}/product-details",
  summary: "Create or replace product details on a booking item",
  "x-voyant-api-id": bookingExtensionApiId,
  request: {
    params: bookingItemIdParamsSchema,
    body: {
      required: true,
      content: { "application/json": { schema: bookingItemProductDetailSchema } },
    },
  },
  responses: {
    200: { description: "Booking item product details were stored" },
  },
})

const deleteBookingItemProductDetailsRoute = createRoute({
  method: "delete",
  path: "/{bookingId}/items/{itemId}/product-details",
  summary: "Remove product details from a booking item",
  "x-voyant-api-id": bookingExtensionApiId,
  request: { params: bookingItemIdParamsSchema },
  responses: {
    200: { description: "Booking item product details were removed" },
    404: { description: "No product details exist for the booking item" },
  },
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

export const bookingProductExtensionRoutes = new OpenAPIHono<Env>({
  defaultHook: openApiValidationHook,
})

  .openapi(getBookingProductDetailsRoute, async (c) => {
    const row = await bookingProductExtensionService.getBookingDetails(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!row) {
      return c.json({ data: null })
    }
    return c.json({ data: row })
  })

  .openapi(putBookingProductDetailsRoute, async (c) => {
    const data = c.req.valid("json")
    const row = await bookingProductExtensionService.upsertBookingDetails(
      c.get("db"),
      c.req.param("bookingId"),
      data,
    )
    return c.json({ data: row })
  })

  .openapi(deleteBookingProductDetailsRoute, async (c) => {
    const row = await bookingProductExtensionService.removeBookingDetails(
      c.get("db"),
      c.req.param("bookingId"),
    )
    if (!row) {
      return c.json({ error: "Not found" }, 404)
    }
    return c.json({ success: true })
  })

  .openapi(getBookingItemProductDetailsRoute, async (c) => {
    const row = await bookingProductExtensionService.getItemDetails(
      c.get("db"),
      c.req.param("itemId"),
    )
    if (!row) {
      return c.json({ data: null })
    }
    return c.json({ data: row })
  })

  .openapi(putBookingItemProductDetailsRoute, async (c) => {
    const data = c.req.valid("json")
    const row = await bookingProductExtensionService.upsertItemDetails(
      c.get("db"),
      c.req.param("itemId"),
      data,
    )
    return c.json({ data: row })
  })

  .openapi(deleteBookingItemProductDetailsRoute, async (c) => {
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
  adminRoutes: bookingProductExtensionRoutes,
}
