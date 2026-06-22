import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import {
  productDayServices,
  productDayServiceTranslations,
  productDays,
  productItineraries,
  productItineraryTranslations,
} from "./schema.js"
import type {
  dayServiceTranslationListQuerySchema,
  insertDayServiceTranslationSchema,
  insertProductItineraryTranslationSchema,
  productItineraryTranslationListQuerySchema,
  updateDayServiceTranslationSchema,
  updateProductItineraryTranslationSchema,
} from "./validation.js"

type ProductItineraryTranslationListQuery = z.infer<
  typeof productItineraryTranslationListQuerySchema
>
type CreateProductItineraryTranslationInput = z.infer<
  typeof insertProductItineraryTranslationSchema
>
type UpdateProductItineraryTranslationInput = z.infer<
  typeof updateProductItineraryTranslationSchema
>
type DayServiceTranslationListQuery = z.infer<typeof dayServiceTranslationListQuerySchema>
type CreateDayServiceTranslationInput = z.infer<typeof insertDayServiceTranslationSchema>
type UpdateDayServiceTranslationInput = z.infer<typeof updateDayServiceTranslationSchema>

async function getItineraryById(
  db: PostgresJsDatabase,
  itineraryId: string,
): Promise<{ id: string; productId: string } | null> {
  const [itinerary] = await db
    .select({ id: productItineraries.id, productId: productItineraries.productId })
    .from(productItineraries)
    .where(eq(productItineraries.id, itineraryId))
    .limit(1)

  return itinerary ?? null
}

async function getDayServiceById(
  db: PostgresJsDatabase,
  serviceId: string,
): Promise<{ id: string; dayId: string; productId: string } | null> {
  const [service] = await db
    .select({
      id: productDayServices.id,
      dayId: productDayServices.dayId,
      productId: productItineraries.productId,
    })
    .from(productDayServices)
    .innerJoin(productDays, eq(productDayServices.dayId, productDays.id))
    .innerJoin(productItineraries, eq(productDays.itineraryId, productItineraries.id))
    .where(eq(productDayServices.id, serviceId))
    .limit(1)

  return service ?? null
}

export const itineraryTranslationProductsService = {
  async listProductItineraryTranslations(
    db: PostgresJsDatabase,
    query: ProductItineraryTranslationListQuery,
  ) {
    const conditions = []

    if (query.itineraryId) {
      conditions.push(eq(productItineraryTranslations.itineraryId, query.itineraryId))
    }

    if (query.languageTag) {
      conditions.push(eq(productItineraryTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productItineraryTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          asc(productItineraryTranslations.languageTag),
          asc(productItineraryTranslations.createdAt),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(productItineraryTranslations)
        .where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getProductItineraryTranslationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productItineraryTranslations)
      .where(eq(productItineraryTranslations.id, id))
      .limit(1)

    return row ?? null
  },

  async getItineraryTranslationForProductMutation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productItineraryTranslations)
      .where(eq(productItineraryTranslations.id, id))
      .limit(1)
    if (!row) {
      return null
    }

    const itineraryRef = await getItineraryById(db, row.itineraryId)
    return itineraryRef ? { ...row, productId: itineraryRef.productId } : null
  },

  async createProductItineraryTranslation(
    db: PostgresJsDatabase,
    productId: string,
    itineraryId: string,
    data: CreateProductItineraryTranslationInput,
  ) {
    const itineraryRef = await getItineraryById(db, itineraryId)
    if (!itineraryRef || itineraryRef.productId !== productId) {
      return null
    }

    const [row] = await db
      .insert(productItineraryTranslations)
      .values({ ...data, itineraryId })
      .returning()

    return row ?? null
  },

  async updateProductItineraryTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductItineraryTranslationInput,
  ) {
    const [row] = await db
      .update(productItineraryTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productItineraryTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductItineraryTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productItineraryTranslations)
      .where(eq(productItineraryTranslations.id, id))
      .returning({ id: productItineraryTranslations.id })

    return row ?? null
  },

  async listDayServiceTranslations(db: PostgresJsDatabase, query: DayServiceTranslationListQuery) {
    const conditions = []

    if (query.serviceId) {
      conditions.push(eq(productDayServiceTranslations.serviceId, query.serviceId))
    }

    if (query.languageTag) {
      conditions.push(eq(productDayServiceTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productDayServiceTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          asc(productDayServiceTranslations.languageTag),
          asc(productDayServiceTranslations.createdAt),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(productDayServiceTranslations)
        .where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getDayServiceTranslationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productDayServiceTranslations)
      .where(eq(productDayServiceTranslations.id, id))
      .limit(1)

    return row ?? null
  },

  async getDayServiceTranslationForProductMutation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productDayServiceTranslations)
      .where(eq(productDayServiceTranslations.id, id))
      .limit(1)
    if (!row) {
      return null
    }

    const serviceRef = await getDayServiceById(db, row.serviceId)
    return serviceRef ? { ...row, dayId: serviceRef.dayId, productId: serviceRef.productId } : null
  },

  async createDayServiceTranslation(
    db: PostgresJsDatabase,
    productId: string,
    dayId: string,
    serviceId: string,
    data: CreateDayServiceTranslationInput,
  ) {
    const serviceRef = await getDayServiceById(db, serviceId)
    if (!serviceRef || serviceRef.productId !== productId || serviceRef.dayId !== dayId) {
      return null
    }

    const [row] = await db
      .insert(productDayServiceTranslations)
      .values({ ...data, serviceId })
      .returning()

    return row ?? null
  },

  async updateDayServiceTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateDayServiceTranslationInput,
  ) {
    const [row] = await db
      .update(productDayServiceTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productDayServiceTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteDayServiceTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productDayServiceTranslations)
      .where(eq(productDayServiceTranslations.id, id))
      .returning({ id: productDayServiceTranslations.id })

    return row ?? null
  },
}
