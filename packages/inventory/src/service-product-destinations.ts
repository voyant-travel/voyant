import { and, asc, eq, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import { destinations, productDestinations, products } from "./schema.js"
import type { productDestinationListQuerySchema } from "./validation.js"

type ProductDestinationListQuery = z.infer<typeof productDestinationListQuerySchema>

async function ensureProductExists(db: PostgresJsDatabase, productId: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  return product ?? null
}

export const productDestinationProductsService = {
  async listProductDestinations(db: PostgresJsDatabase, query: ProductDestinationListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productDestinations.productId, query.productId))
    }

    if (query.destinationId) {
      conditions.push(eq(productDestinations.destinationId, query.destinationId))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select({
          productId: productDestinations.productId,
          destinationId: productDestinations.destinationId,
          sortOrder: productDestinations.sortOrder,
          createdAt: productDestinations.createdAt,
          updatedAt: productDestinations.updatedAt,
          destinationSlug: destinations.slug,
          destinationType: destinations.destinationType,
          destinationActive: destinations.active,
        })
        .from(productDestinations)
        .innerJoin(destinations, eq(destinations.id, productDestinations.destinationId))
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productDestinations.sortOrder), asc(destinations.slug)),
      db.select({ count: sql<number>`count(*)::int` }).from(productDestinations).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async assignProductDestination(
    db: PostgresJsDatabase,
    productId: string,
    input: { destinationId: string; sortOrder?: number },
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [destination] = await db
      .select({ id: destinations.id })
      .from(destinations)
      .where(eq(destinations.id, input.destinationId))
      .limit(1)

    if (!destination) {
      return null
    }

    const [existing] = await db
      .select()
      .from(productDestinations)
      .where(
        and(
          eq(productDestinations.productId, productId),
          eq(productDestinations.destinationId, input.destinationId),
        ),
      )
      .limit(1)

    if (existing) {
      const [row] = await db
        .update(productDestinations)
        .set({ sortOrder: input.sortOrder ?? existing.sortOrder, updatedAt: new Date() })
        .where(
          and(
            eq(productDestinations.productId, productId),
            eq(productDestinations.destinationId, input.destinationId),
          ),
        )
        .returning()
      return row ?? null
    }

    const [row] = await db
      .insert(productDestinations)
      .values({
        productId,
        destinationId: input.destinationId,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning()
    return row ?? null
  },

  async removeProductDestination(db: PostgresJsDatabase, productId: string, destinationId: string) {
    const [row] = await db
      .delete(productDestinations)
      .where(
        and(
          eq(productDestinations.productId, productId),
          eq(productDestinations.destinationId, destinationId),
        ),
      )
      .returning({
        productId: productDestinations.productId,
        destinationId: productDestinations.destinationId,
      })

    return row ?? null
  },
}
