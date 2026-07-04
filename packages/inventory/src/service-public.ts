// agent-quality: file-size exception -- owner: inventory; existing service module stays co-located until a dedicated split preserves behavior and tests.
import { and, asc, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  destinations,
  destinationTranslations,
  productCategories,
  productCategoryProducts,
  productDestinations,
  productLocations,
  products,
  productTagProducts,
  productTags,
  productTranslations,
  productVisibilitySettings,
} from "./schema.js"
import {
  catalogProductsService,
  DEFAULT_CATALOG_SEARCH_FALLBACK_LANGUAGE_TAGS,
} from "./service-catalog.js"
import type {
  PublicCatalogCategoryListQuery,
  PublicCatalogDestinationListQuery,
  PublicCatalogProductListQuery,
  PublicCatalogProductLookupBySlugQuery,
  PublicCatalogTagListQuery,
} from "./validation-public.js"

type PublicCatalogProductRow = typeof products.$inferSelect

function impossibleCondition() {
  return sql`1 = 0`
}

function normalizeLanguageTag(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return normalized || null
}

function normalizeLanguageTagList(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeLanguageTag(value))
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

async function listProductIdsForCategory(db: PostgresJsDatabase, categoryId: string) {
  const rows = await db
    .select({ productId: productCategoryProducts.productId })
    .from(productCategoryProducts)
    .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
    .where(
      and(eq(productCategoryProducts.categoryId, categoryId), eq(productCategories.active, true)),
    )

  return rows.map((row) => row.productId)
}

async function listProductIdsForTag(db: PostgresJsDatabase, tagId: string) {
  const rows = await db
    .select({ productId: productTagProducts.productId })
    .from(productTagProducts)
    .where(eq(productTagProducts.tagId, tagId))

  return rows.map((row) => row.productId)
}

async function listProductIdsForDestinationId(db: PostgresJsDatabase, destinationId: string) {
  const rows = await db
    .select({ productId: productDestinations.productId })
    .from(productDestinations)
    .where(eq(productDestinations.destinationId, destinationId))

  return rows.map((row) => row.productId)
}

async function listProductIdsForDestinationSlug(db: PostgresJsDatabase, slug: string) {
  const rows = await db
    .select({ productId: productDestinations.productId })
    .from(productDestinations)
    .innerJoin(destinations, eq(destinations.id, productDestinations.destinationId))
    .where(eq(destinations.slug, slug))

  return rows.map((row) => row.productId)
}

async function listFeaturedProductIds(db: PostgresJsDatabase) {
  const rows = await db
    .select({ productId: productVisibilitySettings.productId })
    .from(productVisibilitySettings)
    .where(eq(productVisibilitySettings.isFeatured, true))

  return rows.map((row) => row.productId)
}

async function listProductIdsForLocationTitle(db: PostgresJsDatabase, title: string) {
  const rows = await db
    .select({ productId: productLocations.productId })
    .from(productLocations)
    .where(ilike(productLocations.title, title))

  return rows.map((row) => row.productId)
}

async function listProductIdsForLocationCity(db: PostgresJsDatabase, city: string) {
  const rows = await db
    .select({ productId: productLocations.productId })
    .from(productLocations)
    .where(ilike(productLocations.city, city))

  return rows.map((row) => row.productId)
}

async function listProductIdsForLocationCountryCode(db: PostgresJsDatabase, countryCode: string) {
  const rows = await db
    .select({ productId: productLocations.productId })
    .from(productLocations)
    .where(eq(productLocations.countryCode, countryCode))

  return rows.map((row) => row.productId)
}

async function listProductIdsForLocationType(
  db: PostgresJsDatabase,
  locationType: NonNullable<PublicCatalogProductListQuery["locationType"]>,
) {
  const rows = await db
    .select({ productId: productLocations.productId })
    .from(productLocations)
    .where(eq(productLocations.locationType, locationType))

  return rows.map((row) => row.productId)
}

async function hydrateCatalogProducts(
  db: PostgresJsDatabase,
  productRows: PublicCatalogProductRow[],
  options?: { includeContent?: boolean; includeItinerary?: boolean; languageTag?: string | null },
) {
  return catalogProductsService.hydrateProducts(db, productRows, {
    includeContent: options?.includeContent,
    includeItinerary: options?.includeItinerary,
    languageTag: options?.languageTag,
    fallbackLanguageTags: options?.languageTag ? [options.languageTag] : [],
  })
}

function orderProducts(query: PublicCatalogProductListQuery) {
  const direction = query.direction === "desc" ? desc : asc

  switch (query.sort) {
    case "createdAt":
      return direction(products.createdAt)
    case "startDate":
      return direction(products.startDate)
    case "price":
      return direction(products.sellAmountCents)
    default:
      return direction(products.name)
  }
}

export const publicProductsService = {
  async listCatalogProducts(
    db: PostgresJsDatabase,
    query: PublicCatalogProductListQuery & { includeContent?: boolean },
  ) {
    const conditions = [
      eq(products.status, "active"),
      eq(products.activated, true),
      eq(products.visibility, "public"),
    ]

    if (query.search) {
      const term = `%${query.search}%`
      const searchCondition = or(ilike(products.name, term), ilike(products.description, term))
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    if (query.bookingMode) {
      conditions.push(eq(products.bookingMode, query.bookingMode))
    }

    if (query.capacityMode) {
      conditions.push(eq(products.capacityMode, query.capacityMode))
    }

    if (query.productTypeId) {
      conditions.push(eq(products.productTypeId, query.productTypeId))
    }

    if (query.categoryId) {
      const productIds = await listProductIdsForCategory(db, query.categoryId)
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    if (query.tagId) {
      const productIds = await listProductIdsForTag(db, query.tagId)
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    if (query.destinationId) {
      const productIds = await listProductIdsForDestinationId(db, query.destinationId)
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    if (query.destinationSlug) {
      const productIds = await listProductIdsForDestinationSlug(db, query.destinationSlug)
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    if (query.featured !== undefined) {
      const productIds = await listFeaturedProductIds(db)
      conditions.push(
        query.featured
          ? productIds.length > 0
            ? inArray(products.id, productIds)
            : impossibleCondition()
          : productIds.length > 0
            ? notInArray(products.id, productIds)
            : sql`1 = 1`,
      )
    }

    if (query.locationTitle) {
      const productIds = await listProductIdsForLocationTitle(db, query.locationTitle)
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    if (query.locationCity) {
      const productIds = await listProductIdsForLocationCity(db, query.locationCity)
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    if (query.locationCountryCode) {
      const productIds = await listProductIdsForLocationCountryCode(
        db,
        query.locationCountryCode.toUpperCase(),
      )
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    if (query.locationType) {
      const productIds = await listProductIdsForLocationType(db, query.locationType)
      conditions.push(
        productIds.length > 0 ? inArray(products.id, productIds) : impossibleCondition(),
      )
    }

    const where = and(...conditions)

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(products)
        .where(where)
        .orderBy(orderProducts(query), asc(products.id))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ])

    return {
      data: await hydrateCatalogProducts(db, rows, {
        includeContent: query.includeContent === true,
        languageTag: normalizeLanguageTag(query.languageTag),
      }),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getCatalogProductById(
    db: PostgresJsDatabase,
    id: string,
    query: { languageTag?: string | null; includeItinerary?: boolean } = {},
  ) {
    const [row] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, id),
          eq(products.status, "active"),
          eq(products.activated, true),
          eq(products.visibility, "public"),
        ),
      )
      .limit(1)

    if (!row) {
      return null
    }

    const [product] = await hydrateCatalogProducts(db, [row], {
      includeContent: true,
      includeItinerary: query.includeItinerary === true,
      languageTag: normalizeLanguageTag(query.languageTag),
    })
    return product ?? null
  },

  async getCatalogProductBySlug(
    db: PostgresJsDatabase,
    slug: string,
    query: PublicCatalogProductLookupBySlugQuery = {},
  ) {
    const normalizedSlug = slug.trim().toLowerCase()
    const normalizedLanguageTag = normalizeLanguageTag(query.languageTag)
    const candidateLanguageTags = normalizedLanguageTag
      ? normalizeLanguageTagList([
          normalizedLanguageTag,
          ...DEFAULT_CATALOG_SEARCH_FALLBACK_LANGUAGE_TAGS,
        ])
      : []
    const conditions = [
      // agent-quality: raw-sql reviewed -- owner: inventory; dynamic SQL interpolation uses Drizzle parameter binding or vetted SQL identifiers.
      sql`lower(${productTranslations.slug}) = ${normalizedSlug}`,
      eq(products.status, "active"),
      eq(products.activated, true),
      eq(products.visibility, "public"),
    ]

    if (normalizedLanguageTag) {
      conditions.push(inArray(productTranslations.languageTag, candidateLanguageTags))
    }

    const rows = await db
      .select({
        productId: products.id,
        languageTag: productTranslations.languageTag,
      })
      .from(productTranslations)
      .innerJoin(products, eq(products.id, productTranslations.productId))
      .where(and(...conditions))
      .orderBy(desc(productTranslations.updatedAt))
      .limit(candidateLanguageTags.length || 1)

    const row =
      candidateLanguageTags.length > 0
        ? (candidateLanguageTags
            .map((languageTag) =>
              rows.find((item) => normalizeLanguageTag(item.languageTag) === languageTag),
            )
            .find(Boolean) ?? null)
        : (rows[0] ?? null)

    if (!row) {
      return null
    }

    return this.getCatalogProductById(db, row.productId, {
      languageTag: row.languageTag,
    })
  },

  async getCatalogProductBrochure(
    db: PostgresJsDatabase,
    productId: string,
    query: { languageTag?: string | null } = {},
  ) {
    const product = await this.getCatalogProductById(db, productId, query)
    return product && "brochure" in product ? product.brochure : null
  },

  async listCatalogCategories(db: PostgresJsDatabase, query: PublicCatalogCategoryListQuery) {
    const conditions = [eq(productCategories.active, true)]

    if (query.parentId) {
      conditions.push(eq(productCategories.parentId, query.parentId))
    }

    if (query.search) {
      const term = `%${query.search}%`
      const searchCondition = or(
        ilike(productCategories.name, term),
        ilike(productCategories.slug, term),
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    const where = and(...conditions)

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: productCategories.id,
          parentId: productCategories.parentId,
          name: productCategories.name,
          slug: productCategories.slug,
          description: productCategories.description,
          sortOrder: productCategories.sortOrder,
        })
        .from(productCategories)
        .where(where)
        .orderBy(asc(productCategories.sortOrder), asc(productCategories.name))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)::int` }).from(productCategories).where(where),
    ])

    return {
      data: rows.map((row) => ({
        ...row,
        parentId: row.parentId ?? null,
        description: row.description ?? null,
      })),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async listCatalogTags(db: PostgresJsDatabase, query: PublicCatalogTagListQuery) {
    const conditions = []

    if (query.search) {
      conditions.push(ilike(productTags.name, `%${query.search}%`))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: productTags.id,
          name: productTags.name,
        })
        .from(productTags)
        .where(where)
        .orderBy(asc(productTags.name))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)::int` }).from(productTags).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async listCatalogDestinations(db: PostgresJsDatabase, query: PublicCatalogDestinationListQuery) {
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
      const translationRows = await db
        .select({ destinationId: destinationTranslations.destinationId })
        .from(destinationTranslations)
        .where(
          and(
            ...(query.languageTag
              ? [eq(destinationTranslations.languageTag, query.languageTag)]
              : []),
            or(
              ilike(destinationTranslations.name, `%${query.search}%`),
              ilike(destinationTranslations.description, `%${query.search}%`),
            ),
          ),
        )
      const destinationIds = translationRows.map((row) => row.destinationId)
      conditions.push(
        destinationIds.length > 0
          ? inArray(destinations.id, destinationIds)
          : impossibleCondition(),
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
        : []

    const translationByDestination = new Map<string, (typeof translations)[number]>()
    for (const row of translations) {
      if (!translationByDestination.has(row.destinationId)) {
        translationByDestination.set(row.destinationId, row)
      }
    }

    return {
      data: rows.map((row) => {
        const translation = translationByDestination.get(row.id)
        return {
          id: row.id,
          parentId: row.parentId ?? null,
          slug: row.slug,
          canonicalPlaceId: row.canonicalPlaceId ?? null,
          name: translation?.name ?? row.slug,
          description: translation?.description ?? null,
          seoTitle: translation?.seoTitle ?? null,
          seoDescription: translation?.seoDescription ?? null,
          destinationType: row.destinationType,
          latitude: row.latitude ?? null,
          longitude: row.longitude ?? null,
          sortOrder: row.sortOrder,
        }
      }),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },
}
