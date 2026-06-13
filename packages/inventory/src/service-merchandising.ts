import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { productFaqs, productFeatures, productLocations, products } from "./schema.js"
import type {
  insertProductFaqSchema,
  insertProductFeatureSchema,
  insertProductLocationSchema,
  productFaqListQuerySchema,
  productFeatureListQuerySchema,
  productLocationListQuerySchema,
  updateProductFaqSchema,
  updateProductFeatureSchema,
  updateProductLocationSchema,
} from "./validation.js"

type ProductFeatureListQuery = z.infer<typeof productFeatureListQuerySchema>
type CreateProductFeatureInput = z.infer<typeof insertProductFeatureSchema>
type UpdateProductFeatureInput = z.infer<typeof updateProductFeatureSchema>
type ProductFaqListQuery = z.infer<typeof productFaqListQuerySchema>
type CreateProductFaqInput = z.infer<typeof insertProductFaqSchema>
type UpdateProductFaqInput = z.infer<typeof updateProductFaqSchema>
type ProductLocationListQuery = z.infer<typeof productLocationListQuerySchema>
type CreateProductLocationInput = z.infer<typeof insertProductLocationSchema>
type UpdateProductLocationInput = z.infer<typeof updateProductLocationSchema>

async function ensureProductExists(db: PostgresJsDatabase, productId: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  return product ?? null
}

export const merchandisingProductsService = {
  async listFeatures(db: PostgresJsDatabase, query: ProductFeatureListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productFeatures.productId, query.productId))
    }

    if (query.featureType) {
      conditions.push(eq(productFeatures.featureType, query.featureType))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productFeatures)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productFeatures.sortOrder), asc(productFeatures.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productFeatures).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getFeatureById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productFeatures).where(eq(productFeatures.id, id)).limit(1)
    return row ?? null
  },

  async createFeature(db: PostgresJsDatabase, productId: string, data: CreateProductFeatureInput) {
    const product = await ensureProductExists(db, productId)

    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productFeatures)
      .values({ productId, ...data })
      .returning()
    return row ?? null
  },

  async updateFeature(db: PostgresJsDatabase, id: string, data: UpdateProductFeatureInput) {
    const [row] = await db
      .update(productFeatures)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productFeatures.id, id))
      .returning()

    return row ?? null
  },

  async deleteFeature(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productFeatures)
      .where(eq(productFeatures.id, id))
      .returning({ id: productFeatures.id })

    return row ?? null
  },

  async listFaqs(db: PostgresJsDatabase, query: ProductFaqListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productFaqs.productId, query.productId))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productFaqs)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productFaqs.sortOrder), asc(productFaqs.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productFaqs).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getFaqById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productFaqs).where(eq(productFaqs.id, id)).limit(1)
    return row ?? null
  },

  async createFaq(db: PostgresJsDatabase, productId: string, data: CreateProductFaqInput) {
    const product = await ensureProductExists(db, productId)

    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productFaqs)
      .values({ productId, ...data })
      .returning()
    return row ?? null
  },

  async updateFaq(db: PostgresJsDatabase, id: string, data: UpdateProductFaqInput) {
    const [row] = await db
      .update(productFaqs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productFaqs.id, id))
      .returning()

    return row ?? null
  },

  async deleteFaq(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productFaqs)
      .where(eq(productFaqs.id, id))
      .returning({ id: productFaqs.id })

    return row ?? null
  },

  async listLocations(db: PostgresJsDatabase, query: ProductLocationListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productLocations.productId, query.productId))
    }

    if (query.locationType) {
      conditions.push(eq(productLocations.locationType, query.locationType))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productLocations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productLocations.sortOrder), asc(productLocations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productLocations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getLocationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productLocations)
      .where(eq(productLocations.id, id))
      .limit(1)
    return row ?? null
  },

  async createLocation(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductLocationInput,
  ) {
    const product = await ensureProductExists(db, productId)

    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productLocations)
      .values({ productId, ...data })
      .returning()
    return row ?? null
  },

  async updateLocation(db: PostgresJsDatabase, id: string, data: UpdateProductLocationInput) {
    const [row] = await db
      .update(productLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productLocations.id, id))
      .returning()

    return row ?? null
  },

  async deleteLocation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productLocations)
      .where(eq(productLocations.id, id))
      .returning({ id: productLocations.id })

    return row ?? null
  },
}
