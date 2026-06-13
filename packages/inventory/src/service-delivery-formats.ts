import { and, asc, desc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { productDeliveryFormats, products } from "./schema.js"
import type {
  insertProductDeliveryFormatSchema,
  productDeliveryFormatListQuerySchema,
  updateProductDeliveryFormatSchema,
} from "./validation.js"

type ProductDeliveryFormatListQuery = z.infer<typeof productDeliveryFormatListQuerySchema>
type CreateProductDeliveryFormatInput = z.infer<typeof insertProductDeliveryFormatSchema>
type UpdateProductDeliveryFormatInput = z.infer<typeof updateProductDeliveryFormatSchema>

async function ensureProductExists(db: PostgresJsDatabase, productId: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  return product ?? null
}

export const deliveryFormatProductsService = {
  async listDeliveryFormats(db: PostgresJsDatabase, query: ProductDeliveryFormatListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productDeliveryFormats.productId, query.productId))
    }

    if (query.format) {
      conditions.push(eq(productDeliveryFormats.format, query.format))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productDeliveryFormats)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(desc(productDeliveryFormats.isDefault), asc(productDeliveryFormats.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productDeliveryFormats).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getDeliveryFormatById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productDeliveryFormats)
      .where(eq(productDeliveryFormats.id, id))
      .limit(1)

    return row ?? null
  },

  async getDeliveryFormatByProductAndFormat(
    db: PostgresJsDatabase,
    productId: string,
    format: CreateProductDeliveryFormatInput["format"],
  ) {
    const [row] = await db
      .select()
      .from(productDeliveryFormats)
      .where(
        and(
          eq(productDeliveryFormats.productId, productId),
          eq(productDeliveryFormats.format, format),
        ),
      )
      .limit(1)

    return row ?? null
  },

  async createDeliveryFormat(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductDeliveryFormatInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    if (data.isDefault) {
      await db
        .update(productDeliveryFormats)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productDeliveryFormats.productId, productId))
    }

    const [row] = await db
      .insert(productDeliveryFormats)
      .values({ productId, ...data })
      .onConflictDoUpdate({
        target: [productDeliveryFormats.productId, productDeliveryFormats.format],
        set: {
          isDefault: data.isDefault ?? false,
          updatedAt: new Date(),
        },
      })
      .returning()

    return row ?? null
  },

  async updateDeliveryFormat(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductDeliveryFormatInput,
  ) {
    const [current] = await db
      .select({ id: productDeliveryFormats.id, productId: productDeliveryFormats.productId })
      .from(productDeliveryFormats)
      .where(eq(productDeliveryFormats.id, id))
      .limit(1)

    if (!current) {
      return null
    }

    if (data.isDefault) {
      await db
        .update(productDeliveryFormats)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productDeliveryFormats.productId, current.productId))
    }

    const [row] = await db
      .update(productDeliveryFormats)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productDeliveryFormats.id, id))
      .returning()

    return row ?? null
  },

  async deleteDeliveryFormat(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productDeliveryFormats)
      .where(eq(productDeliveryFormats.id, id))
      .returning({ id: productDeliveryFormats.id })

    return row ?? null
  },
}
