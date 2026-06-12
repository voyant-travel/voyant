import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import {
  destinations,
  destinationTranslations,
  productCategories,
  productCategoryTranslations,
  productTags,
  productTagTranslations,
} from "./schema.js"
import type {
  destinationListQuerySchema,
  destinationTranslationListQuerySchema,
  insertDestinationSchema,
  insertDestinationTranslationSchema,
  insertProductCategoryTranslationSchema,
  insertProductTagTranslationSchema,
  productCategoryTranslationListQuerySchema,
  productTagTranslationListQuerySchema,
  updateDestinationSchema,
  updateDestinationTranslationSchema,
  updateProductCategoryTranslationSchema,
  updateProductTagTranslationSchema,
} from "./validation.js"

type DestinationListQuery = z.infer<typeof destinationListQuerySchema>
type CreateDestinationInput = z.infer<typeof insertDestinationSchema>
type UpdateDestinationInput = z.infer<typeof updateDestinationSchema>
type DestinationTranslationListQuery = z.infer<typeof destinationTranslationListQuerySchema>
type CreateDestinationTranslationInput = z.infer<typeof insertDestinationTranslationSchema>
type UpdateDestinationTranslationInput = z.infer<typeof updateDestinationTranslationSchema>
type ProductCategoryTranslationListQuery = z.infer<typeof productCategoryTranslationListQuerySchema>
type CreateProductCategoryTranslationInput = z.infer<typeof insertProductCategoryTranslationSchema>
type UpdateProductCategoryTranslationInput = z.infer<typeof updateProductCategoryTranslationSchema>
type ProductTagTranslationListQuery = z.infer<typeof productTagTranslationListQuerySchema>
type CreateProductTagTranslationInput = z.infer<typeof insertProductTagTranslationSchema>
type UpdateProductTagTranslationInput = z.infer<typeof updateProductTagTranslationSchema>

export const destinationProductsService = {
  async listDestinations(db: PostgresJsDatabase, query: DestinationListQuery) {
    const conditions = []

    if (query.parentId) {
      conditions.push(eq(destinations.parentId, query.parentId))
    }

    if (query.active !== undefined) {
      conditions.push(eq(destinations.active, query.active))
    }

    if (query.destinationType) {
      conditions.push(eq(destinations.destinationType, query.destinationType))
    }

    if (query.canonicalPlaceId) {
      conditions.push(eq(destinations.canonicalPlaceId, query.canonicalPlaceId))
    }

    if (query.search) {
      const term = `%${query.search}%`
      const translationRows = await db
        .select({ destinationId: destinationTranslations.destinationId })
        .from(destinationTranslations)
        .where(
          and(
            query.languageTag
              ? eq(destinationTranslations.languageTag, query.languageTag)
              : undefined,
            or(
              ilike(destinationTranslations.name, term),
              ilike(destinationTranslations.description, term),
            ),
          ),
        )

      const destinationIds = translationRows.map((row) => row.destinationId)
      conditions.push(
        destinationIds.length > 0 ? inArray(destinations.id, destinationIds) : sql`1 = 0`,
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(destinations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(destinations.sortOrder), asc(destinations.slug)),
      db.select({ count: sql<number>`count(*)::int` }).from(destinations).where(where),
    ])

    const destinationIds = rows.map((row) => row.id)
    const translations =
      destinationIds.length > 0
        ? await db
            .select()
            .from(destinationTranslations)
            .where(
              and(
                inArray(destinationTranslations.destinationId, destinationIds),
                ...(query.languageTag
                  ? [eq(destinationTranslations.languageTag, query.languageTag)]
                  : []),
              ),
            )
            .orderBy(
              asc(destinationTranslations.languageTag),
              asc(destinationTranslations.createdAt),
            )
        : []

    const translationsByDestination = new Map<string, Array<(typeof translations)[number]>>()
    for (const row of translations) {
      const existing = translationsByDestination.get(row.destinationId) ?? []
      existing.push(row)
      translationsByDestination.set(row.destinationId, existing)
    }

    return {
      data: rows.map((row) => ({
        ...row,
        translation: (translationsByDestination.get(row.id) ?? [])[0] ?? null,
      })),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getDestinationById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(destinations).where(eq(destinations.id, id)).limit(1)
    if (!row) {
      return null
    }

    const translations = await db
      .select()
      .from(destinationTranslations)
      .where(eq(destinationTranslations.destinationId, id))
      .orderBy(asc(destinationTranslations.languageTag), asc(destinationTranslations.createdAt))

    return {
      ...row,
      translations,
    }
  },

  async createDestination(db: PostgresJsDatabase, data: CreateDestinationInput) {
    const [row] = await db.insert(destinations).values(data).returning()
    return row ?? null
  },

  async updateDestination(db: PostgresJsDatabase, id: string, data: UpdateDestinationInput) {
    const [row] = await db
      .update(destinations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(destinations.id, id))
      .returning()

    return row ?? null
  },

  async deleteDestination(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(destinations)
      .where(eq(destinations.id, id))
      .returning({ id: destinations.id })

    return row ?? null
  },

  async listDestinationTranslations(
    db: PostgresJsDatabase,
    query: DestinationTranslationListQuery,
  ) {
    const conditions = []

    if (query.destinationId) {
      conditions.push(eq(destinationTranslations.destinationId, query.destinationId))
    }

    if (query.languageTag) {
      conditions.push(eq(destinationTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(destinationTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(destinationTranslations.languageTag), asc(destinationTranslations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(destinationTranslations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async upsertDestinationTranslation(
    db: PostgresJsDatabase,
    destinationId: string,
    data: CreateDestinationTranslationInput,
  ) {
    const [destination] = await db
      .select({ id: destinations.id })
      .from(destinations)
      .where(eq(destinations.id, destinationId))
      .limit(1)

    if (!destination) {
      return null
    }

    const [existing] = await db
      .select()
      .from(destinationTranslations)
      .where(
        and(
          eq(destinationTranslations.destinationId, destinationId),
          eq(destinationTranslations.languageTag, data.languageTag),
        ),
      )
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(destinationTranslations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(destinationTranslations.id, existing.id))
        .returning()
      return row ?? null
    }

    const [row] = await db
      .insert(destinationTranslations)
      .values({ destinationId, ...data })
      .returning()
    return row ?? null
  },

  async updateDestinationTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateDestinationTranslationInput,
  ) {
    const [row] = await db
      .update(destinationTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(destinationTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteDestinationTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(destinationTranslations)
      .where(eq(destinationTranslations.id, id))
      .returning({ id: destinationTranslations.id })

    return row ?? null
  },

  async listProductCategoryTranslations(
    db: PostgresJsDatabase,
    query: ProductCategoryTranslationListQuery,
  ) {
    const conditions = []

    if (query.categoryId) {
      conditions.push(eq(productCategoryTranslations.categoryId, query.categoryId))
    }

    if (query.languageTag) {
      conditions.push(eq(productCategoryTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productCategoryTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          asc(productCategoryTranslations.languageTag),
          asc(productCategoryTranslations.createdAt),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(productCategoryTranslations)
        .where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async upsertProductCategoryTranslation(
    db: PostgresJsDatabase,
    categoryId: string,
    data: CreateProductCategoryTranslationInput,
  ) {
    const [category] = await db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(eq(productCategories.id, categoryId))
      .limit(1)

    if (!category) {
      return null
    }

    const [existing] = await db
      .select()
      .from(productCategoryTranslations)
      .where(
        and(
          eq(productCategoryTranslations.categoryId, categoryId),
          eq(productCategoryTranslations.languageTag, data.languageTag),
        ),
      )
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(productCategoryTranslations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(productCategoryTranslations.id, existing.id))
        .returning()
      return row ?? null
    }

    const [row] = await db
      .insert(productCategoryTranslations)
      .values({ categoryId, ...data })
      .returning()
    return row ?? null
  },

  async updateProductCategoryTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductCategoryTranslationInput,
  ) {
    const [row] = await db
      .update(productCategoryTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productCategoryTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductCategoryTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productCategoryTranslations)
      .where(eq(productCategoryTranslations.id, id))
      .returning({ id: productCategoryTranslations.id })

    return row ?? null
  },

  async listProductTagTranslations(db: PostgresJsDatabase, query: ProductTagTranslationListQuery) {
    const conditions = []

    if (query.tagId) {
      conditions.push(eq(productTagTranslations.tagId, query.tagId))
    }

    if (query.languageTag) {
      conditions.push(eq(productTagTranslations.languageTag, query.languageTag))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productTagTranslations)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productTagTranslations.languageTag), asc(productTagTranslations.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productTagTranslations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async upsertProductTagTranslation(
    db: PostgresJsDatabase,
    tagId: string,
    data: CreateProductTagTranslationInput,
  ) {
    const [tag] = await db
      .select({ id: productTags.id })
      .from(productTags)
      .where(eq(productTags.id, tagId))
      .limit(1)

    if (!tag) {
      return null
    }

    const [existing] = await db
      .select()
      .from(productTagTranslations)
      .where(
        and(
          eq(productTagTranslations.tagId, tagId),
          eq(productTagTranslations.languageTag, data.languageTag),
        ),
      )
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(productTagTranslations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(productTagTranslations.id, existing.id))
        .returning()
      return row ?? null
    }

    const [row] = await db
      .insert(productTagTranslations)
      .values({ tagId, ...data })
      .returning()
    return row ?? null
  },

  async updateProductTagTranslation(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductTagTranslationInput,
  ) {
    const [row] = await db
      .update(productTagTranslations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productTagTranslations.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductTagTranslation(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productTagTranslations)
      .where(eq(productTagTranslations.id, id))
      .returning({ id: productTagTranslations.id })

    return row ?? null
  },
}
