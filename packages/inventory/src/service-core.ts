import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import {
  productCategoryProducts,
  productItineraries,
  productOptions,
  products,
  productTypes,
} from "./schema.js"
import type {
  insertProductSchema,
  productListQuerySchema,
  updateProductSchema,
} from "./validation.js"

type ProductListQuery = z.infer<typeof productListQuerySchema>
type CreateProductInput = z.infer<typeof insertProductSchema>
type UpdateProductInput = z.infer<typeof updateProductSchema>

async function getDefaultItinerary(
  db: PostgresJsDatabase,
  productId: string,
): Promise<{ id: string } | null> {
  const [itinerary] = await db
    .select({ id: productItineraries.id })
    .from(productItineraries)
    .where(and(eq(productItineraries.productId, productId), eq(productItineraries.isDefault, true)))
    .orderBy(asc(productItineraries.sortOrder), asc(productItineraries.createdAt))
    .limit(1)

  return itinerary ?? null
}

async function ensureDefaultItinerary(db: PostgresJsDatabase, productId: string) {
  const existing = await getDefaultItinerary(db, productId)
  if (existing) {
    return existing
  }

  const [row] = await db
    .insert(productItineraries)
    .values({
      productId,
      name: "Main itinerary",
      isDefault: true,
      sortOrder: 0,
    })
    .returning({ id: productItineraries.id })

  if (!row) {
    throw new Error(`Failed to create default itinerary for product ${productId}`)
  }

  return row
}

// Every product needs at least one bookable option for the operator pricing
// grid to have something to attach inventory and prices to. Seed a single
// "Standard" default option on creation so a brand-new product opens straight

async function ensureDefaultOption(db: PostgresJsDatabase, productId: string) {
  const [existing] = await db
    .select({ id: productOptions.id })
    .from(productOptions)
    .where(eq(productOptions.productId, productId))
    .limit(1)
  if (existing) {
    return existing
  }

  const [row] = await db
    .insert(productOptions)
    .values({
      productId,
      name: "Standard",
      code: "standard",
      status: "active",
      isDefault: true,
      sortOrder: 0,
    })
    .returning({ id: productOptions.id })

  if (!row) {
    throw new Error(`Failed to create default option for product ${productId}`)
  }

  return row
}

export const coreProductsService = {
  async listProducts(db: PostgresJsDatabase, query: ProductListQuery) {
    const conditions = []

    if (query.status) {
      conditions.push(eq(products.status, query.status))
    }

    if (query.bookingMode) {
      conditions.push(eq(products.bookingMode, query.bookingMode))
    }

    if (query.visibility) {
      conditions.push(eq(products.visibility, query.visibility))
    }

    if (query.activated !== undefined) {
      conditions.push(eq(products.activated, query.activated))
    }

    if (query.facilityId) {
      conditions.push(eq(products.facilityId, query.facilityId))
    }

    if (query.supplierId) {
      conditions.push(eq(products.supplierId, query.supplierId))
    }

    if (query.productTypeId) {
      conditions.push(eq(products.productTypeId, query.productTypeId))
    }

    if (query.contractTemplateId) {
      conditions.push(eq(products.contractTemplateId, query.contractTemplateId))
    }

    if (query.categoryId) {
      conditions.push(
        // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
        sql`exists (select 1 from ${productCategoryProducts}
          where ${productCategoryProducts.productId} = ${products.id}
          and ${productCategoryProducts.categoryId} = ${query.categoryId})`,
      )
    }

    if (query.tag) {
      // Postgres jsonb `@>` containment: does the array include this string?
      // Mirrors the pattern used in @voyantjs/charters and @voyantjs/cruises.
      // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      conditions.push(sql`${products.tags} @> ${JSON.stringify([query.tag])}::jsonb`)
    }

    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(products.name, term), ilike(products.description, term)))
    }

    if (query.dateFrom) {
      conditions.push(gte(products.startDate, query.dateFrom))
    }

    if (query.dateTo) {
      conditions.push(lte(products.startDate, query.dateTo))
    }

    if (query.paxMin !== undefined) {
      conditions.push(gte(products.pax, query.paxMin))
    }

    if (query.paxMax !== undefined) {
      conditions.push(lte(products.pax, query.paxMax))
    }

    if (query.sellAmountMin !== undefined) {
      conditions.push(gte(products.sellAmountCents, query.sellAmountMin))
    }

    if (query.sellAmountMax !== undefined) {
      conditions.push(lte(products.sellAmountCents, query.sellAmountMax))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = (() => {
      switch (query.sortBy) {
        case "name":
          return products.name
        case "status":
          return products.status
        case "sellAmount":
          return products.sellAmountCents
        case "pax":
          return products.pax
        case "startDate":
          return products.startDate
        case "endDate":
          return products.endDate
        default:
          return products.createdAt
      }
    })()
    const sortFn = query.sortDir === "asc" ? asc : desc

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(products)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(sortFn(sortColumn), desc(products.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getProductById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1)
    return row ?? null
  },

  /**
   * Same as `getProductById` but eagerly hydrates the `productType`
   * relation so consumers (slot detail page, etc.) can render a
   * category-style badge without a second round-trip. `productType` is
   * `null` when the product has no type assigned.
   */
  async getProductByIdWithType(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select({
        product: products,
        productType: {
          id: productTypes.id,
          name: productTypes.name,
          code: productTypes.code,
        },
      })
      .from(products)
      .leftJoin(productTypes, eq(productTypes.id, products.productTypeId))
      .where(eq(products.id, id))
      .limit(1)
    if (!row) return null
    return {
      ...row.product,
      productType: row.productType?.id ? row.productType : null,
    }
  },

  async createProduct(db: PostgresJsDatabase, data: CreateProductInput) {
    const [row] = await db.insert(products).values(data).returning()
    if (!row) {
      throw new Error("Failed to create product")
    }
    await ensureDefaultItinerary(db, row.id)
    await ensureDefaultOption(db, row.id)
    return row
  },

  async updateProduct(db: PostgresJsDatabase, id: string, data: UpdateProductInput) {
    const [row] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning()

    return row ?? null
  },

  async deleteProduct(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id })

    return row ?? null
  },
}
