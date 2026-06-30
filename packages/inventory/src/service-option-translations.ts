import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { duplicateInventoryValueError } from "./duplicate-errors.js"
import {
  optionUnits,
  optionUnitTranslations,
  productDays,
  productDayTranslations,
  productItineraries,
  productOptions,
  productOptionTranslations,
  products,
  productTranslations,
} from "./schema.js"
import type {
  insertOptionUnitTranslationSchema,
  insertProductDayTranslationSchema,
  insertProductOptionTranslationSchema,
  insertProductTranslationSchema,
  optionUnitTranslationListQuerySchema,
  productDayTranslationListQuerySchema,
  productOptionTranslationListQuerySchema,
  productTranslationListQuerySchema,
  updateOptionUnitTranslationSchema,
  updateProductDayTranslationSchema,
  updateProductOptionTranslationSchema,
  updateProductTranslationSchema,
} from "./validation.js"

type ProductTranslationListQuery = z.infer<typeof productTranslationListQuerySchema>
type CreateProductTranslationInput = z.infer<typeof insertProductTranslationSchema>
type UpdateProductTranslationInput = z.infer<typeof updateProductTranslationSchema>
type ProductDayTranslationListQuery = z.infer<typeof productDayTranslationListQuerySchema>
type CreateProductDayTranslationInput = z.infer<typeof insertProductDayTranslationSchema>
type UpdateProductDayTranslationInput = z.infer<typeof updateProductDayTranslationSchema>
type ProductOptionTranslationListQuery = z.infer<typeof productOptionTranslationListQuerySchema>
type CreateProductOptionTranslationInput = z.infer<typeof insertProductOptionTranslationSchema>
type UpdateProductOptionTranslationInput = z.infer<typeof updateProductOptionTranslationSchema>
type OptionUnitTranslationListQuery = z.infer<typeof optionUnitTranslationListQuerySchema>
type CreateOptionUnitTranslationInput = z.infer<typeof insertOptionUnitTranslationSchema>
type UpdateOptionUnitTranslationInput = z.infer<typeof updateOptionUnitTranslationSchema>

async function getDayById(
  db: PostgresJsDatabase,
  dayId: string,
): Promise<{ id: string; itineraryId: string; productId: string } | null> {
  const [day] = await db
    .select({
      id: productDays.id,
      itineraryId: productDays.itineraryId,
      productId: productItineraries.productId,
    })
    .from(productDays)
    .innerJoin(productItineraries, eq(productDays.itineraryId, productItineraries.id))
    .where(eq(productDays.id, dayId))
    .limit(1)

  return day ?? null
}

export const optionTranslationProductsService = {
  async listProductTranslations(db: PostgresJsDatabase, query: ProductTranslationListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productTranslations.productId, query.productId))
    }

    if (query.languageTag) {
      conditions.push(eq(productTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productTranslations.languageTag), asc(productTranslations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productTranslations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getProductTranslationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productTranslations)
      .where(eq(productTranslations.id, id))
      .limit(1)

    return row ?? null
  },

  async createProductTranslation(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductTranslationInput,
  ) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productTranslations)
      .values({ ...data, productId })
      .onConflictDoNothing({
        target: [productTranslations.productId, productTranslations.languageTag],
      })
      .returning()

    if (!row) {
      throw duplicateInventoryValueError({
        code: "duplicate_product_translation_language",
        message: "Product translation already exists for this product and language",
        resource: "product_translation",
        fields: [["productId"], ["languageTag"]],
      })
    }

    return row ?? null
  },

  async updateProductTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductTranslationInput,
  ) {
    const [row] = await db
      .update(productTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productTranslations)
      .where(eq(productTranslations.id, id))
      .returning({ id: productTranslations.id })

    return row ?? null
  },

  async listProductDayTranslations(db: PostgresJsDatabase, query: ProductDayTranslationListQuery) {
    const conditions = []

    if (query.dayId) {
      conditions.push(eq(productDayTranslations.dayId, query.dayId))
    }

    if (query.languageTag) {
      conditions.push(eq(productDayTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productDayTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productDayTranslations.languageTag), asc(productDayTranslations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productDayTranslations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getProductDayTranslationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productDayTranslations)
      .where(eq(productDayTranslations.id, id))
      .limit(1)

    return row ?? null
  },

  async getDayTranslationForProductMutation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productDayTranslations)
      .where(eq(productDayTranslations.id, id))
      .limit(1)
    if (!row) {
      return null
    }

    const dayRef = await getDayById(db, row.dayId)
    return dayRef ? { ...row, productId: dayRef.productId } : null
  },

  async createProductDayTranslation(
    db: PostgresJsDatabase,
    productId: string,
    dayId: string,
    data: CreateProductDayTranslationInput,
  ) {
    const dayRef = await getDayById(db, dayId)
    if (!dayRef || dayRef.productId !== productId) {
      return null
    }

    const [row] = await db
      .insert(productDayTranslations)
      .values({ ...data, dayId })
      .returning()

    return row ?? null
  },

  async updateProductDayTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductDayTranslationInput,
  ) {
    const [row] = await db
      .update(productDayTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productDayTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductDayTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productDayTranslations)
      .where(eq(productDayTranslations.id, id))
      .returning({ id: productDayTranslations.id })

    return row ?? null
  },

  async listOptionTranslations(db: PostgresJsDatabase, query: ProductOptionTranslationListQuery) {
    const conditions = []

    if (query.optionId) {
      conditions.push(eq(productOptionTranslations.optionId, query.optionId))
    }

    if (query.languageTag) {
      conditions.push(eq(productOptionTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productOptionTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          asc(productOptionTranslations.languageTag),
          asc(productOptionTranslations.createdAt),
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(productOptionTranslations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getOptionTranslationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productOptionTranslations)
      .where(eq(productOptionTranslations.id, id))
      .limit(1)

    return row ?? null
  },

  async getOptionTranslationForProductMutation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select({ translation: productOptionTranslations, productId: productOptions.productId })
      .from(productOptionTranslations)
      .innerJoin(productOptions, eq(productOptionTranslations.optionId, productOptions.id))
      .where(eq(productOptionTranslations.id, id))
      .limit(1)

    return row ? { ...row.translation, productId: row.productId } : null
  },

  async createOptionTranslation(
    db: PostgresJsDatabase,
    optionId: string,
    data: CreateProductOptionTranslationInput,
  ) {
    const [option] = await db
      .select({ id: productOptions.id })
      .from(productOptions)
      .where(eq(productOptions.id, optionId))
      .limit(1)

    if (!option) {
      return null
    }

    const [row] = await db
      .insert(productOptionTranslations)
      .values({ ...data, optionId })
      .returning()

    return row ?? null
  },

  async updateOptionTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductOptionTranslationInput,
  ) {
    const [row] = await db
      .update(productOptionTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productOptionTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteOptionTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productOptionTranslations)
      .where(eq(productOptionTranslations.id, id))
      .returning({ id: productOptionTranslations.id })

    return row ?? null
  },

  async listUnitTranslations(db: PostgresJsDatabase, query: OptionUnitTranslationListQuery) {
    const conditions = []

    if (query.unitId) {
      conditions.push(eq(optionUnitTranslations.unitId, query.unitId))
    }

    if (query.languageTag) {
      conditions.push(eq(optionUnitTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(optionUnitTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(optionUnitTranslations.languageTag), asc(optionUnitTranslations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(optionUnitTranslations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getUnitTranslationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(optionUnitTranslations)
      .where(eq(optionUnitTranslations.id, id))
      .limit(1)

    return row ?? null
  },

  async getUnitTranslationForProductMutation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select({ translation: optionUnitTranslations, productId: productOptions.productId })
      .from(optionUnitTranslations)
      .innerJoin(optionUnits, eq(optionUnitTranslations.unitId, optionUnits.id))
      .innerJoin(productOptions, eq(optionUnits.optionId, productOptions.id))
      .where(eq(optionUnitTranslations.id, id))
      .limit(1)

    return row ? { ...row.translation, productId: row.productId } : null
  },

  async createUnitTranslation(
    db: PostgresJsDatabase,
    unitId: string,
    data: CreateOptionUnitTranslationInput,
  ) {
    const [unit] = await db
      .select({ id: optionUnits.id })
      .from(optionUnits)
      .where(eq(optionUnits.id, unitId))
      .limit(1)

    if (!unit) {
      return null
    }

    const [row] = await db
      .insert(optionUnitTranslations)
      .values({ ...data, unitId })
      .returning()

    return row ?? null
  },

  async updateUnitTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateOptionUnitTranslationInput,
  ) {
    const [row] = await db
      .update(optionUnitTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(optionUnitTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteUnitTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(optionUnitTranslations)
      .where(eq(optionUnitTranslations.id, id))
      .returning({ id: optionUnitTranslations.id })

    return row ?? null
  },
}
