import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  destinations,
  destinationTranslations,
  productCapabilities,
  productCategories,
  productCategoryProducts,
  productDestinations,
  productFaqs,
  productFeatures,
  productLocations,
  productMedia,
  products,
  productTagProducts,
  productTags,
  productTranslations,
  productTypes,
  productVisibilitySettings,
} from "./schema.js"
import { inferProductSellableKind } from "./sellable-kind.js"
import type {
  CatalogSearchDocument,
  CatalogSearchDocumentListQuery,
  LocalizedCatalogProductDetail,
} from "./validation-catalog.js"

type CatalogProductRow = typeof products.$inferSelect

type HydrateCatalogProductOptions = {
  includeContent?: boolean
  languageTag?: string | null
  fallbackLanguageTags?: string[]
}

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : value
}

function normalizeDateTime(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value instanceof Date ? value.toISOString() : value
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

function resolveFallbackLanguageTags(languageTag?: string | null, fallbackLanguageTags?: string[]) {
  const normalizedPrimary = normalizeLanguageTag(languageTag)
  return normalizeLanguageTagList([normalizedPrimary, ...(fallbackLanguageTags ?? [])])
}

async function loadCatalogHydrationData(
  db: PostgresJsDatabase,
  productRows: CatalogProductRow[],
  options: HydrateCatalogProductOptions = {},
) {
  const productIds = productRows.map((product) => product.id)
  const productTypeIds = Array.from(
    new Set(
      productRows
        .map((product) => product.productTypeId)
        .filter((value): value is string => Boolean(value)),
    ),
  )
  const fallbackLanguageTags = resolveFallbackLanguageTags(
    options.languageTag,
    options.fallbackLanguageTags,
  )

  const [
    categoryRows,
    tagRows,
    translationRows,
    typeRows,
    capabilityRows,
    mediaRows,
    featuredRows,
    featureRows,
    faqRows,
    destinationRows,
    locationRows,
  ] = await Promise.all([
    db
      .select({
        productId: productCategoryProducts.productId,
        id: productCategories.id,
        parentId: productCategories.parentId,
        name: productCategories.name,
        slug: productCategories.slug,
        description: productCategories.description,
        sortOrder: productCategories.sortOrder,
      })
      .from(productCategoryProducts)
      .innerJoin(productCategories, eq(productCategories.id, productCategoryProducts.categoryId))
      .where(
        and(
          inArray(productCategoryProducts.productId, productIds),
          eq(productCategories.active, true),
        ),
      )
      .orderBy(
        asc(productCategoryProducts.sortOrder),
        asc(productCategories.sortOrder),
        asc(productCategories.name),
      ),
    db
      .select({
        productId: productTagProducts.productId,
        id: productTags.id,
        name: productTags.name,
      })
      .from(productTagProducts)
      .innerJoin(productTags, eq(productTags.id, productTagProducts.tagId))
      .where(inArray(productTagProducts.productId, productIds))
      .orderBy(asc(productTags.name)),
    fallbackLanguageTags.length > 0
      ? db
          .select({
            productId: productTranslations.productId,
            languageTag: productTranslations.languageTag,
            slug: productTranslations.slug,
            name: productTranslations.name,
            shortDescription: productTranslations.shortDescription,
            description: productTranslations.description,
            inclusionsHtml: productTranslations.inclusionsHtml,
            exclusionsHtml: productTranslations.exclusionsHtml,
            termsHtml: productTranslations.termsHtml,
            seoTitle: productTranslations.seoTitle,
            seoDescription: productTranslations.seoDescription,
            updatedAt: productTranslations.updatedAt,
          })
          .from(productTranslations)
          .where(
            and(
              inArray(productTranslations.productId, productIds),
              inArray(productTranslations.languageTag, fallbackLanguageTags),
            ),
          )
      : Promise.resolve([]),
    productTypeIds.length > 0
      ? db
          .select({
            id: productTypes.id,
            code: productTypes.code,
            name: productTypes.name,
            description: productTypes.description,
          })
          .from(productTypes)
          .where(and(inArray(productTypes.id, productTypeIds), eq(productTypes.active, true)))
      : Promise.resolve([]),
    db
      .select({
        productId: productCapabilities.productId,
        capability: productCapabilities.capability,
      })
      .from(productCapabilities)
      .where(
        and(
          inArray(productCapabilities.productId, productIds),
          eq(productCapabilities.enabled, true),
        ),
      )
      .orderBy(asc(productCapabilities.capability)),
    db
      .select({
        productId: productMedia.productId,
        id: productMedia.id,
        mediaType: productMedia.mediaType,
        name: productMedia.name,
        url: productMedia.url,
        mimeType: productMedia.mimeType,
        altText: productMedia.altText,
        sortOrder: productMedia.sortOrder,
        isCover: productMedia.isCover,
        isBrochure: productMedia.isBrochure,
        isBrochureCurrent: productMedia.isBrochureCurrent,
        brochureVersion: productMedia.brochureVersion,
      })
      .from(productMedia)
      .where(inArray(productMedia.productId, productIds))
      .orderBy(
        desc(productMedia.isCover),
        asc(productMedia.sortOrder),
        asc(productMedia.createdAt),
      ),
    db
      .select({ productId: productVisibilitySettings.productId })
      .from(productVisibilitySettings)
      .where(
        and(
          inArray(productVisibilitySettings.productId, productIds),
          eq(productVisibilitySettings.isFeatured, true),
        ),
      ),
    options.includeContent
      ? db
          .select({
            productId: productFeatures.productId,
            id: productFeatures.id,
            featureType: productFeatures.featureType,
            title: productFeatures.title,
            description: productFeatures.description,
            sortOrder: productFeatures.sortOrder,
          })
          .from(productFeatures)
          .where(inArray(productFeatures.productId, productIds))
          .orderBy(asc(productFeatures.sortOrder), asc(productFeatures.createdAt))
      : Promise.resolve([]),
    options.includeContent
      ? db
          .select({
            productId: productFaqs.productId,
            id: productFaqs.id,
            question: productFaqs.question,
            answer: productFaqs.answer,
            sortOrder: productFaqs.sortOrder,
          })
          .from(productFaqs)
          .where(inArray(productFaqs.productId, productIds))
          .orderBy(asc(productFaqs.sortOrder), asc(productFaqs.createdAt))
      : Promise.resolve([]),
    db
      .select({
        productId: productDestinations.productId,
        destinationId: destinations.id,
        parentId: destinations.parentId,
        slug: destinations.slug,
        canonicalPlaceId: destinations.canonicalPlaceId,
        destinationType: destinations.destinationType,
        latitude: destinations.latitude,
        longitude: destinations.longitude,
        sortOrder: productDestinations.sortOrder,
        fallbackSortOrder: destinations.sortOrder,
        translationLanguageTag: destinationTranslations.languageTag,
        translationName: destinationTranslations.name,
        translationDescription: destinationTranslations.description,
        translationSeoTitle: destinationTranslations.seoTitle,
        translationSeoDescription: destinationTranslations.seoDescription,
      })
      .from(productDestinations)
      .innerJoin(destinations, eq(destinations.id, productDestinations.destinationId))
      .leftJoin(
        destinationTranslations,
        and(
          eq(destinationTranslations.destinationId, destinations.id),
          fallbackLanguageTags.length > 0
            ? inArray(destinationTranslations.languageTag, fallbackLanguageTags)
            : sql`true`,
        ),
      )
      .where(inArray(productDestinations.productId, productIds))
      .orderBy(
        asc(productDestinations.sortOrder),
        asc(destinations.sortOrder),
        asc(destinationTranslations.languageTag),
      ),
    db
      .select({
        productId: productLocations.productId,
        id: productLocations.id,
        locationType: productLocations.locationType,
        title: productLocations.title,
        address: productLocations.address,
        city: productLocations.city,
        countryCode: productLocations.countryCode,
        latitude: productLocations.latitude,
        longitude: productLocations.longitude,
        sortOrder: productLocations.sortOrder,
      })
      .from(productLocations)
      .where(inArray(productLocations.productId, productIds))
      .orderBy(asc(productLocations.sortOrder), asc(productLocations.createdAt)),
  ])

  const categoriesByProduct = new Map<string, Array<(typeof categoryRows)[number]>>()
  for (const row of categoryRows) {
    const existing = categoriesByProduct.get(row.productId) ?? []
    existing.push(row)
    categoriesByProduct.set(row.productId, existing)
  }

  const tagsByProduct = new Map<string, Array<(typeof tagRows)[number]>>()
  for (const row of tagRows) {
    const existing = tagsByProduct.get(row.productId) ?? []
    existing.push(row)
    tagsByProduct.set(row.productId, existing)
  }

  const translationsByProduct = new Map<string, Array<(typeof translationRows)[number]>>()
  for (const row of translationRows) {
    const existing = translationsByProduct.get(row.productId) ?? []
    existing.push(row)
    translationsByProduct.set(row.productId, existing)
  }

  const capabilitiesByProduct = new Map<string, string[]>()
  for (const row of capabilityRows) {
    const existing = capabilitiesByProduct.get(row.productId) ?? []
    existing.push(row.capability)
    capabilitiesByProduct.set(row.productId, existing)
  }

  const mediaByProduct = new Map<string, Array<(typeof mediaRows)[number]>>()
  for (const row of mediaRows) {
    const existing = mediaByProduct.get(row.productId) ?? []
    existing.push(row)
    mediaByProduct.set(row.productId, existing)
  }

  const featuresByProduct = new Map<string, Array<(typeof featureRows)[number]>>()
  for (const row of featureRows) {
    const existing = featuresByProduct.get(row.productId) ?? []
    existing.push(row)
    featuresByProduct.set(row.productId, existing)
  }

  const faqsByProduct = new Map<string, Array<(typeof faqRows)[number]>>()
  for (const row of faqRows) {
    const existing = faqsByProduct.get(row.productId) ?? []
    existing.push(row)
    faqsByProduct.set(row.productId, existing)
  }

  const destinationsByProduct = new Map<
    string,
    Array<{
      id: string
      parentId: string | null
      slug: string
      canonicalPlaceId: string | null
      destinationType: string
      latitude: number | null
      longitude: number | null
      sortOrder: number
      name: string
      description: string | null
      seoTitle: string | null
      seoDescription: string | null
    }>
  >()
  const destinationRowsByProductAndDestination = new Map<
    string,
    Array<(typeof destinationRows)[number]>
  >()
  for (const row of destinationRows) {
    const key = `${row.productId}:${row.destinationId}`
    const existing = destinationRowsByProductAndDestination.get(key) ?? []
    existing.push(row)
    destinationRowsByProductAndDestination.set(key, existing)
  }
  for (const rows of destinationRowsByProductAndDestination.values()) {
    const first = rows[0]
    if (!first) {
      continue
    }

    const translated =
      fallbackLanguageTags.length === 0
        ? rows[0]
        : (fallbackLanguageTags
            .map((languageTag) =>
              rows.find((row) => normalizeLanguageTag(row.translationLanguageTag) === languageTag),
            )
            .find(Boolean) ?? rows[0])

    const mapped = {
      id: first.destinationId,
      parentId: first.parentId ?? null,
      slug: first.slug,
      canonicalPlaceId: first.canonicalPlaceId ?? null,
      destinationType: first.destinationType,
      latitude: first.latitude ?? null,
      longitude: first.longitude ?? null,
      sortOrder: first.sortOrder ?? first.fallbackSortOrder ?? 0,
      name: translated?.translationName ?? first.slug,
      description: translated?.translationDescription ?? null,
      seoTitle: translated?.translationSeoTitle ?? null,
      seoDescription: translated?.translationSeoDescription ?? null,
    }

    const existing = destinationsByProduct.get(first.productId) ?? []
    existing.push(mapped)
    destinationsByProduct.set(first.productId, existing)
  }

  const locationsByProduct = new Map<string, Array<(typeof locationRows)[number]>>()
  for (const row of locationRows) {
    const existing = locationsByProduct.get(row.productId) ?? []
    existing.push(row)
    locationsByProduct.set(row.productId, existing)
  }

  const typeById = new Map(typeRows.map((row) => [row.id, row] as const))
  const featuredIds = new Set(featuredRows.map((row) => row.productId))

  const translationByProduct = new Map<string, (typeof translationRows)[number] | null>()
  for (const productId of productIds) {
    const rows = translationsByProduct.get(productId) ?? []
    const selected =
      fallbackLanguageTags.length === 0
        ? null
        : (fallbackLanguageTags
            .map((languageTag) =>
              rows.find((row) => normalizeLanguageTag(row.languageTag) === languageTag),
            )
            .find(Boolean) ?? null)
    translationByProduct.set(productId, selected)
  }

  return {
    categoriesByProduct,
    tagsByProduct,
    translationByProduct,
    capabilitiesByProduct,
    mediaByProduct,
    featuresByProduct,
    faqsByProduct,
    destinationsByProduct,
    locationsByProduct,
    typeById,
    featuredIds,
  }
}

export const catalogProductsService = {
  async hydrateProducts(
    db: PostgresJsDatabase,
    productRows: CatalogProductRow[],
    options: HydrateCatalogProductOptions = {},
  ) {
    if (productRows.length === 0) {
      return []
    }

    const hydrationData = await loadCatalogHydrationData(db, productRows, options)

    return productRows.map((product) => {
      const translation = hydrationData.translationByProduct.get(product.id) ?? null
      const allMedia = (hydrationData.mediaByProduct.get(product.id) ?? []).map((row) => ({
        id: row.id,
        mediaType: row.mediaType,
        name: row.name,
        url: row.url,
        mimeType: row.mimeType ?? null,
        altText: row.altText ?? null,
        sortOrder: row.sortOrder,
        isCover: row.isCover,
        isBrochure: row.isBrochure,
        isBrochureCurrent: row.isBrochureCurrent,
        brochureVersion: row.brochureVersion ?? null,
      }))
      const brochure =
        allMedia.find((item) => item.isBrochure && item.isBrochureCurrent) ??
        allMedia.find((item) => item.isBrochure) ??
        null
      const media = allMedia.filter((item) => !item.isBrochure)
      const productType = product.productTypeId
        ? (hydrationData.typeById.get(product.productTypeId) ?? null)
        : null
      const capabilities = hydrationData.capabilitiesByProduct.get(product.id) ?? []

      const base = {
        id: product.id,
        name: translation?.name ?? product.name,
        description: translation?.description ?? product.description ?? null,
        inclusionsHtml: translation?.inclusionsHtml ?? product.inclusionsHtml ?? null,
        exclusionsHtml: translation?.exclusionsHtml ?? product.exclusionsHtml ?? null,
        termsHtml: translation?.termsHtml ?? product.termsHtml ?? null,
        contentLanguageTag: translation?.languageTag ?? null,
        slug: translation?.slug ?? null,
        shortDescription: translation?.shortDescription ?? null,
        seoTitle: translation?.seoTitle ?? null,
        seoDescription: translation?.seoDescription ?? null,
        bookingMode: product.bookingMode,
        capacityMode: product.capacityMode,
        visibility: product.visibility,
        sellCurrency: product.sellCurrency,
        sellAmountCents: product.sellAmountCents ?? null,
        startDate: normalizeDate(product.startDate),
        endDate: normalizeDate(product.endDate),
        pax: product.pax ?? null,
        contractTemplateId: product.contractTemplateId ?? null,
        sellableKind: inferProductSellableKind({
          bookingMode: product.bookingMode,
          productTypeCode: productType?.code ?? null,
          productTypeName: productType?.name ?? null,
          tags: Array.isArray(product.tags) ? product.tags : [],
          capabilities,
        }),
        productType,
        categories: (hydrationData.categoriesByProduct.get(product.id) ?? []).map((row) => ({
          id: row.id,
          parentId: row.parentId ?? null,
          name: row.name,
          slug: row.slug,
          description: row.description ?? null,
          sortOrder: row.sortOrder,
        })),
        tags: (hydrationData.tagsByProduct.get(product.id) ?? []).map((row) => ({
          id: row.id,
          name: row.name,
        })),
        capabilities,
        destinations: (hydrationData.destinationsByProduct.get(product.id) ?? []).map((row) => ({
          id: row.id,
          parentId: row.parentId,
          slug: row.slug,
          canonicalPlaceId: row.canonicalPlaceId,
          name: row.name,
          description: row.description,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
          destinationType: row.destinationType,
          latitude: row.latitude,
          longitude: row.longitude,
          sortOrder: row.sortOrder,
        })),
        locations: (hydrationData.locationsByProduct.get(product.id) ?? []).map((row) => ({
          id: row.id,
          locationType: row.locationType,
          title: row.title,
          address: row.address ?? null,
          city: row.city ?? null,
          countryCode: row.countryCode ?? null,
          latitude: row.latitude ?? null,
          longitude: row.longitude ?? null,
          sortOrder: row.sortOrder,
        })),
        coverMedia: media.find((item) => item.isCover) ?? media[0] ?? null,
        isFeatured: hydrationData.featuredIds.has(product.id),
      }

      if (!options.includeContent) {
        return base
      }

      return {
        ...base,
        brochure,
        media,
        features: (hydrationData.featuresByProduct.get(product.id) ?? []).map((row) => ({
          id: row.id,
          featureType: row.featureType,
          title: row.title,
          description: row.description ?? null,
          sortOrder: row.sortOrder,
        })),
        faqs: (hydrationData.faqsByProduct.get(product.id) ?? []).map((row) => ({
          id: row.id,
          question: row.question,
          answer: row.answer,
          sortOrder: row.sortOrder,
        })),
      }
    })
  },

  async listSearchDocuments(
    db: PostgresJsDatabase,
    query: CatalogSearchDocumentListQuery,
  ): Promise<{
    data: CatalogSearchDocument[]
    total: number
    limit: number
    offset: number
  }> {
    const conditions = []

    if (query.status === "active") {
      conditions.push(eq(products.status, "active"), eq(products.activated, true))
    }

    if (query.visibility === "public") {
      conditions.push(eq(products.visibility, "public"))
    }

    if (query.productIds && query.productIds.length > 0) {
      conditions.push(inArray(products.id, query.productIds))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(products)
        .where(where)
        .orderBy(asc(products.createdAt), asc(products.id))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: sql<number>`count(*)::int` }).from(products).where(where),
    ])

    const localizedProducts = (await this.hydrateProducts(db, rows, {
      includeContent: true,
      languageTag: query.languageTag,
      fallbackLanguageTags: query.fallbackLanguageTags ?? (query.languageTag ? ["en", "ro"] : []),
    })) as LocalizedCatalogProductDetail[]

    const rowById = new Map(rows.map((row) => [row.id, row] as const))

    return {
      data: localizedProducts.map<CatalogSearchDocument>((product) => ({
        id: `${product.id}:${product.contentLanguageTag ?? "default"}`,
        productId: product.id,
        languageTag: product.contentLanguageTag,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        description: product.description,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        sellCurrency: product.sellCurrency,
        sellAmountCents: product.sellAmountCents,
        startDate: product.startDate,
        endDate: product.endDate,
        pax: product.pax,
        productTypeCode: product.productType?.code ?? null,
        productTypeName: product.productType?.name ?? null,
        sellableKind: product.sellableKind,
        categoryIds: product.categories.map((category) => category.id),
        categoryNames: product.categories.map((category) => category.name),
        categorySlugs: product.categories.map((category) => category.slug),
        tagIds: product.tags.map((tag) => tag.id),
        tagNames: product.tags.map((tag) => tag.name),
        capabilities: product.capabilities,
        destinationIds: product.destinations.map((destination) => destination.id),
        destinationNames: product.destinations.map((destination) => destination.name),
        destinationSlugs: product.destinations.map((destination) => destination.slug),
        locationTitles: product.locations.map((location) => location.title),
        locationCities: product.locations
          .map((location) => location.city)
          .filter((value): value is string => Boolean(value)),
        locationCountryCodes: product.locations
          .map((location) => location.countryCode)
          .filter((value): value is string => Boolean(value)),
        coverMediaUrl: product.coverMedia?.url ?? null,
        isFeatured: product.isFeatured,
        createdAt: normalizeDateTime(rowById.get(product.id)?.createdAt),
        updatedAt: normalizeDateTime(rowById.get(product.id)?.updatedAt),
      })),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getSearchDocumentByProductId(
    db: PostgresJsDatabase,
    productId: string,
    query: Partial<Omit<CatalogSearchDocumentListQuery, "productIds" | "limit" | "offset">> = {},
  ) {
    const result = await this.listSearchDocuments(db, {
      visibility: query.visibility ?? "public",
      status: query.status ?? "active",
      ...query,
      productIds: [productId],
      limit: 1,
      offset: 0,
    })

    return result.data[0] ?? null
  },
}
