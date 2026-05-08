import { RequestValidationError } from "@voyantjs/hono"
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"
import {
  destinations,
  destinationTranslations,
  optionUnits,
  optionUnitTranslations,
  productActivationSettings,
  productCapabilities,
  productCategories,
  productCategoryProducts,
  productDayServices,
  productDays,
  productDeliveryFormats,
  productDestinations,
  productFaqs,
  productFeatures,
  productItineraries,
  productLocations,
  productMedia,
  productNotes,
  productOptions,
  productOptionTranslations,
  products,
  productTagProducts,
  productTags,
  productTicketSettings,
  productTranslations,
  productTypes,
  productVersions,
  productVisibilitySettings,
} from "./schema.js"
import { getProductAggregates } from "./service-aggregates.js"
import type {
  destinationListQuerySchema,
  destinationTranslationListQuerySchema,
  insertDaySchema,
  insertDayServiceSchema,
  insertDestinationSchema,
  insertDestinationTranslationSchema,
  insertItinerarySchema,
  insertOptionUnitSchema,
  insertOptionUnitTranslationSchema,
  insertProductActivationSettingSchema,
  insertProductCapabilitySchema,
  insertProductCategorySchema,
  insertProductDeliveryFormatSchema,
  insertProductFaqSchema,
  insertProductFeatureSchema,
  insertProductLocationSchema,
  insertProductMediaSchema,
  insertProductNoteSchema,
  insertProductOptionSchema,
  insertProductOptionTranslationSchema,
  insertProductSchema,
  insertProductTagSchema,
  insertProductTicketSettingSchema,
  insertProductTranslationSchema,
  insertProductTypeSchema,
  insertProductVisibilitySettingSchema,
  insertVersionSchema,
  optionUnitListQuerySchema,
  optionUnitTranslationListQuerySchema,
  productActivationSettingListQuerySchema,
  productCapabilityListQuerySchema,
  productCategoryListQuerySchema,
  productDeliveryFormatListQuerySchema,
  productDestinationListQuerySchema,
  productFaqListQuerySchema,
  productFeatureListQuerySchema,
  productListQuerySchema,
  productLocationListQuerySchema,
  productMediaListQuerySchema,
  productOptionListQuerySchema,
  productOptionTranslationListQuerySchema,
  productTagListQuerySchema,
  productTicketSettingListQuerySchema,
  productTranslationListQuerySchema,
  productTypeListQuerySchema,
  productVisibilitySettingListQuerySchema,
  reorderProductMediaSchema,
  updateDaySchema,
  updateDayServiceSchema,
  updateDestinationSchema,
  updateDestinationTranslationSchema,
  updateItinerarySchema,
  updateOptionUnitSchema,
  updateOptionUnitTranslationSchema,
  updateProductActivationSettingSchema,
  updateProductCapabilitySchema,
  updateProductCategorySchema,
  updateProductDeliveryFormatSchema,
  updateProductFaqSchema,
  updateProductFeatureSchema,
  updateProductLocationSchema,
  updateProductMediaSchema,
  updateProductOptionSchema,
  updateProductOptionTranslationSchema,
  updateProductSchema,
  updateProductTagSchema,
  updateProductTicketSettingSchema,
  updateProductTranslationSchema,
  updateProductTypeSchema,
  updateProductVisibilitySettingSchema,
  upsertProductBrochureSchema,
} from "./validation.js"
import { validateMergedOptionUnit } from "./validation-core.js"

type ProductListQuery = z.infer<typeof productListQuerySchema>
type CreateProductInput = z.infer<typeof insertProductSchema>
type UpdateProductInput = z.infer<typeof updateProductSchema>
type ProductOptionListQuery = z.infer<typeof productOptionListQuerySchema>
type CreateProductOptionInput = z.infer<typeof insertProductOptionSchema>
type UpdateProductOptionInput = z.infer<typeof updateProductOptionSchema>
type OptionUnitListQuery = z.infer<typeof optionUnitListQuerySchema>
type CreateOptionUnitInput = z.infer<typeof insertOptionUnitSchema>
type UpdateOptionUnitInput = z.infer<typeof updateOptionUnitSchema>
type ProductTranslationListQuery = z.infer<typeof productTranslationListQuerySchema>
type CreateProductTranslationInput = z.infer<typeof insertProductTranslationSchema>
type UpdateProductTranslationInput = z.infer<typeof updateProductTranslationSchema>
type ProductOptionTranslationListQuery = z.infer<typeof productOptionTranslationListQuerySchema>
type CreateProductOptionTranslationInput = z.infer<typeof insertProductOptionTranslationSchema>
type UpdateProductOptionTranslationInput = z.infer<typeof updateProductOptionTranslationSchema>
type OptionUnitTranslationListQuery = z.infer<typeof optionUnitTranslationListQuerySchema>
type CreateOptionUnitTranslationInput = z.infer<typeof insertOptionUnitTranslationSchema>
type UpdateOptionUnitTranslationInput = z.infer<typeof updateOptionUnitTranslationSchema>
type ProductActivationSettingListQuery = z.infer<typeof productActivationSettingListQuerySchema>
type CreateProductActivationSettingInput = z.infer<typeof insertProductActivationSettingSchema>
type UpdateProductActivationSettingInput = z.infer<typeof updateProductActivationSettingSchema>
type ProductTicketSettingListQuery = z.infer<typeof productTicketSettingListQuerySchema>
type CreateProductTicketSettingInput = z.infer<typeof insertProductTicketSettingSchema>
type UpdateProductTicketSettingInput = z.infer<typeof updateProductTicketSettingSchema>
type ProductVisibilitySettingListQuery = z.infer<typeof productVisibilitySettingListQuerySchema>
type CreateProductVisibilitySettingInput = z.infer<typeof insertProductVisibilitySettingSchema>
type UpdateProductVisibilitySettingInput = z.infer<typeof updateProductVisibilitySettingSchema>
type ProductCapabilityListQuery = z.infer<typeof productCapabilityListQuerySchema>
type CreateProductCapabilityInput = z.infer<typeof insertProductCapabilitySchema>
type UpdateProductCapabilityInput = z.infer<typeof updateProductCapabilitySchema>
type ProductDeliveryFormatListQuery = z.infer<typeof productDeliveryFormatListQuerySchema>
type CreateProductDeliveryFormatInput = z.infer<typeof insertProductDeliveryFormatSchema>
type UpdateProductDeliveryFormatInput = z.infer<typeof updateProductDeliveryFormatSchema>
type ProductFeatureListQuery = z.infer<typeof productFeatureListQuerySchema>
type CreateProductFeatureInput = z.infer<typeof insertProductFeatureSchema>
type UpdateProductFeatureInput = z.infer<typeof updateProductFeatureSchema>
type ProductFaqListQuery = z.infer<typeof productFaqListQuerySchema>
type CreateProductFaqInput = z.infer<typeof insertProductFaqSchema>
type UpdateProductFaqInput = z.infer<typeof updateProductFaqSchema>
type ProductLocationListQuery = z.infer<typeof productLocationListQuerySchema>
type CreateProductLocationInput = z.infer<typeof insertProductLocationSchema>
type UpdateProductLocationInput = z.infer<typeof updateProductLocationSchema>
type DestinationListQuery = z.infer<typeof destinationListQuerySchema>
type CreateDestinationInput = z.infer<typeof insertDestinationSchema>
type UpdateDestinationInput = z.infer<typeof updateDestinationSchema>
type DestinationTranslationListQuery = z.infer<typeof destinationTranslationListQuerySchema>
type CreateDestinationTranslationInput = z.infer<typeof insertDestinationTranslationSchema>
type UpdateDestinationTranslationInput = z.infer<typeof updateDestinationTranslationSchema>
type ProductDestinationListQuery = z.infer<typeof productDestinationListQuerySchema>
type CreateItineraryInput = z.infer<typeof insertItinerarySchema>
type UpdateItineraryInput = z.infer<typeof updateItinerarySchema>
type CreateDayInput = z.infer<typeof insertDaySchema>
type UpdateDayInput = z.infer<typeof updateDaySchema>
type CreateDayServiceInput = z.infer<typeof insertDayServiceSchema>
type UpdateDayServiceInput = z.infer<typeof updateDayServiceSchema>
type CreateVersionInput = z.infer<typeof insertVersionSchema>
type CreateProductNoteInput = z.infer<typeof insertProductNoteSchema>
type ProductTypeListQuery = z.infer<typeof productTypeListQuerySchema>
type CreateProductTypeInput = z.infer<typeof insertProductTypeSchema>
type UpdateProductTypeInput = z.infer<typeof updateProductTypeSchema>
type ProductCategoryListQuery = z.infer<typeof productCategoryListQuerySchema>
type CreateProductCategoryInput = z.infer<typeof insertProductCategorySchema>
type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>
type ProductTagListQuery = z.infer<typeof productTagListQuerySchema>
type CreateProductTagInput = z.infer<typeof insertProductTagSchema>
type UpdateProductTagInput = z.infer<typeof updateProductTagSchema>
type ProductMediaListQuery = z.infer<typeof productMediaListQuerySchema>
type CreateProductMediaInput = z.infer<typeof insertProductMediaSchema>
type UpdateProductMediaInput = z.infer<typeof updateProductMediaSchema>
type UpsertProductBrochureInput = z.infer<typeof upsertProductBrochureSchema>
type ReorderProductMediaInput = z.infer<typeof reorderProductMediaSchema>

async function recalculateProductCost(db: PostgresJsDatabase, productId: string) {
  const [result] = await db
    .select({
      totalCost: sql<number>`coalesce(sum(${productDayServices.costAmountCents} * ${productDayServices.quantity}), 0)::int`,
    })
    .from(productDayServices)
    .innerJoin(productDays, eq(productDayServices.dayId, productDays.id))
    .innerJoin(productItineraries, eq(productDays.itineraryId, productItineraries.id))
    .where(eq(productItineraries.productId, productId))

  const costAmountCents = result?.totalCost ?? 0

  const [product] = await db
    .select({ sellAmountCents: products.sellAmountCents })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  const sellAmountCents = product?.sellAmountCents ?? 0
  const marginPercent =
    sellAmountCents > 0
      ? Math.round(((sellAmountCents - costAmountCents) / sellAmountCents) * 100)
      : 0

  await db
    .update(products)
    .set({ costAmountCents, marginPercent, updatedAt: new Date() })
    .where(eq(products.id, productId))

  return { costAmountCents, marginPercent }
}

async function ensureProductExists(db: PostgresJsDatabase, productId: string) {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  return product ?? null
}

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

async function getItineraryById(db: PostgresJsDatabase, itineraryId: string) {
  const [itinerary] = await db
    .select()
    .from(productItineraries)
    .where(eq(productItineraries.id, itineraryId))
    .limit(1)

  return itinerary ?? null
}

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

async function setDefaultItinerary(db: PostgresJsDatabase, productId: string, itineraryId: string) {
  await db
    .update(productItineraries)
    .set({
      isDefault: sql`${productItineraries.id} = ${itineraryId}`,
      updatedAt: new Date(),
    })
    .where(eq(productItineraries.productId, productId))
}

async function promoteFallbackItinerary(db: PostgresJsDatabase, productId: string) {
  const [fallback] = await db
    .select({ id: productItineraries.id })
    .from(productItineraries)
    .where(eq(productItineraries.productId, productId))
    .orderBy(asc(productItineraries.sortOrder), asc(productItineraries.createdAt))
    .limit(1)

  if (!fallback) {
    return null
  }

  await setDefaultItinerary(db, productId, fallback.id)
  return fallback
}

export const productsService = {
  getProductAggregates,

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

    if (query.categoryId) {
      conditions.push(
        sql`exists (select 1 from ${productCategoryProducts}
          where ${productCategoryProducts.productId} = ${products.id}
          and ${productCategoryProducts.categoryId} = ${query.categoryId})`,
      )
    }

    if (query.tag) {
      // Postgres jsonb `@>` containment: does the array include this string?
      // Mirrors the pattern used in @voyantjs/charters and @voyantjs/cruises.
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

  async createProduct(db: PostgresJsDatabase, data: CreateProductInput) {
    const [row] = await db.insert(products).values(data).returning()
    if (!row) {
      throw new Error("Failed to create product")
    }
    await ensureDefaultItinerary(db, row.id)
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

  async listActivationSettings(db: PostgresJsDatabase, query: ProductActivationSettingListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productActivationSettings.productId, query.productId))
    }

    if (query.activationMode) {
      conditions.push(eq(productActivationSettings.activationMode, query.activationMode))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productActivationSettings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productActivationSettings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productActivationSettings).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getActivationSettingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productActivationSettings)
      .where(eq(productActivationSettings.id, id))
      .limit(1)

    return row ?? null
  },

  async upsertActivationSetting(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductActivationSettingInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productActivationSettings)
      .values({
        productId,
        ...data,
        activateAt: data.activateAt ? new Date(data.activateAt) : null,
        deactivateAt: data.deactivateAt ? new Date(data.deactivateAt) : null,
        sellAt: data.sellAt ? new Date(data.sellAt) : null,
        stopSellAt: data.stopSellAt ? new Date(data.stopSellAt) : null,
      })
      .onConflictDoUpdate({
        target: productActivationSettings.productId,
        set: {
          ...data,
          activateAt: data.activateAt ? new Date(data.activateAt) : null,
          deactivateAt: data.deactivateAt ? new Date(data.deactivateAt) : null,
          sellAt: data.sellAt ? new Date(data.sellAt) : null,
          stopSellAt: data.stopSellAt ? new Date(data.stopSellAt) : null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return row ?? null
  },

  async updateActivationSetting(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductActivationSettingInput,
  ) {
    const [row] = await db
      .update(productActivationSettings)
      .set({
        ...data,
        activateAt:
          data.activateAt === undefined
            ? undefined
            : data.activateAt
              ? new Date(data.activateAt)
              : null,
        deactivateAt:
          data.deactivateAt === undefined
            ? undefined
            : data.deactivateAt
              ? new Date(data.deactivateAt)
              : null,
        sellAt: data.sellAt === undefined ? undefined : data.sellAt ? new Date(data.sellAt) : null,
        stopSellAt:
          data.stopSellAt === undefined
            ? undefined
            : data.stopSellAt
              ? new Date(data.stopSellAt)
              : null,
        updatedAt: new Date(),
      })
      .where(eq(productActivationSettings.id, id))
      .returning()

    return row ?? null
  },

  async deleteActivationSetting(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productActivationSettings)
      .where(eq(productActivationSettings.id, id))
      .returning({ id: productActivationSettings.id })

    return row ?? null
  },

  async listTicketSettings(db: PostgresJsDatabase, query: ProductTicketSettingListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productTicketSettings.productId, query.productId))
    }

    if (query.fulfillmentMode) {
      conditions.push(eq(productTicketSettings.fulfillmentMode, query.fulfillmentMode))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productTicketSettings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productTicketSettings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productTicketSettings).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getTicketSettingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productTicketSettings)
      .where(eq(productTicketSettings.id, id))
      .limit(1)

    return row ?? null
  },

  async upsertTicketSetting(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductTicketSettingInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productTicketSettings)
      .values({ productId, ...data })
      .onConflictDoUpdate({
        target: productTicketSettings.productId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()

    return row ?? null
  },

  async updateTicketSetting(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductTicketSettingInput,
  ) {
    const [row] = await db
      .update(productTicketSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productTicketSettings.id, id))
      .returning()

    return row ?? null
  },

  async deleteTicketSetting(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productTicketSettings)
      .where(eq(productTicketSettings.id, id))
      .returning({ id: productTicketSettings.id })

    return row ?? null
  },

  async listVisibilitySettings(db: PostgresJsDatabase, query: ProductVisibilitySettingListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productVisibilitySettings.productId, query.productId))
    }

    if (query.isSearchable !== undefined) {
      conditions.push(eq(productVisibilitySettings.isSearchable, query.isSearchable))
    }

    if (query.isBookable !== undefined) {
      conditions.push(eq(productVisibilitySettings.isBookable, query.isBookable))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productVisibilitySettings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productVisibilitySettings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productVisibilitySettings).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getVisibilitySettingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productVisibilitySettings)
      .where(eq(productVisibilitySettings.id, id))
      .limit(1)

    return row ?? null
  },

  async upsertVisibilitySetting(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductVisibilitySettingInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productVisibilitySettings)
      .values({ productId, ...data })
      .onConflictDoUpdate({
        target: productVisibilitySettings.productId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning()

    return row ?? null
  },

  async updateVisibilitySetting(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductVisibilitySettingInput,
  ) {
    const [row] = await db
      .update(productVisibilitySettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productVisibilitySettings.id, id))
      .returning()

    return row ?? null
  },

  async deleteVisibilitySetting(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productVisibilitySettings)
      .where(eq(productVisibilitySettings.id, id))
      .returning({ id: productVisibilitySettings.id })

    return row ?? null
  },

  async listCapabilities(db: PostgresJsDatabase, query: ProductCapabilityListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productCapabilities.productId, query.productId))
    }

    if (query.capability) {
      conditions.push(eq(productCapabilities.capability, query.capability))
    }

    if (query.enabled !== undefined) {
      conditions.push(eq(productCapabilities.enabled, query.enabled))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productCapabilities)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productCapabilities.capability), asc(productCapabilities.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productCapabilities).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getCapabilityById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productCapabilities)
      .where(eq(productCapabilities.id, id))
      .limit(1)

    return row ?? null
  },

  async createCapability(
    db: PostgresJsDatabase,
    productId: string,
    data: CreateProductCapabilityInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [row] = await db
      .insert(productCapabilities)
      .values({ productId, ...data })
      .onConflictDoUpdate({
        target: [productCapabilities.productId, productCapabilities.capability],
        set: {
          enabled: data.enabled,
          notes: data.notes ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return row ?? null
  },

  async updateCapability(db: PostgresJsDatabase, id: string, data: UpdateProductCapabilityInput) {
    const [row] = await db
      .update(productCapabilities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productCapabilities.id, id))
      .returning()

    return row ?? null
  },

  async deleteCapability(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productCapabilities)
      .where(eq(productCapabilities.id, id))
      .returning({ id: productCapabilities.id })

    return row ?? null
  },

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

  async listDestinations(db: PostgresJsDatabase, query: DestinationListQuery) {
    const conditions = []

    if (query.parentId) {
      conditions.push(eq(destinations.parentId, query.parentId))
    }

    if (query.active !== undefined) {
      conditions.push(eq(destinations.active, query.active))
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

  async listOptions(db: PostgresJsDatabase, query: ProductOptionListQuery) {
    const conditions = []

    if (query.productId) {
      conditions.push(eq(productOptions.productId, query.productId))
    }

    if (query.status) {
      conditions.push(eq(productOptions.status, query.status))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productOptions)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productOptions.sortOrder), asc(productOptions.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(productOptions).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getOptionById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productOptions).where(eq(productOptions.id, id)).limit(1)
    return row ?? null
  },

  async createOption(db: PostgresJsDatabase, productId: string, data: CreateProductOptionInput) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product) {
      return null
    }

    if (data.isDefault) {
      await db
        .update(productOptions)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productOptions.productId, productId))
    }

    const [row] = await db
      .insert(productOptions)
      .values({ ...data, productId })
      .returning()

    return row
  },

  async updateOption(db: PostgresJsDatabase, id: string, data: UpdateProductOptionInput) {
    const [current] = await db
      .select({ id: productOptions.id, productId: productOptions.productId })
      .from(productOptions)
      .where(eq(productOptions.id, id))
      .limit(1)

    if (!current) {
      return null
    }

    if (data.isDefault) {
      await db
        .update(productOptions)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(productOptions.productId, current.productId))
    }

    const [row] = await db
      .update(productOptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productOptions.id, id))
      .returning()

    return row ?? null
  },

  async deleteOption(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productOptions)
      .where(eq(productOptions.id, id))
      .returning({ id: productOptions.id })

    return row ?? null
  },

  async listUnits(db: PostgresJsDatabase, query: OptionUnitListQuery) {
    const conditions = []

    if (query.optionId) {
      conditions.push(eq(optionUnits.optionId, query.optionId))
    }

    if (query.unitType) {
      conditions.push(eq(optionUnits.unitType, query.unitType))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(optionUnits)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(optionUnits).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getUnitById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(optionUnits).where(eq(optionUnits.id, id)).limit(1)
    return row ?? null
  },

  async createUnit(db: PostgresJsDatabase, optionId: string, data: CreateOptionUnitInput) {
    const [option] = await db
      .select({ id: productOptions.id })
      .from(productOptions)
      .where(eq(productOptions.id, optionId))
      .limit(1)

    if (!option) {
      return null
    }

    const [row] = await db
      .insert(optionUnits)
      .values({ ...data, optionId })
      .returning()

    return row
  },

  async updateUnit(db: PostgresJsDatabase, id: string, data: UpdateOptionUnitInput) {
    const [existing] = await db
      .select({
        unitType: optionUnits.unitType,
        occupancyMin: optionUnits.occupancyMin,
        occupancyMax: optionUnits.occupancyMax,
      })
      .from(optionUnits)
      .where(eq(optionUnits.id, id))
      .limit(1)

    if (!existing) {
      return null
    }

    const merged = {
      unitType: "unitType" in data ? data.unitType : existing.unitType,
      occupancyMin: "occupancyMin" in data ? data.occupancyMin : existing.occupancyMin,
      occupancyMax: "occupancyMax" in data ? data.occupancyMax : existing.occupancyMax,
    }

    const validation = validateMergedOptionUnit(merged)
    if (!validation.ok) {
      const first = validation.issues[0]
      throw new RequestValidationError(first?.message ?? "Invalid option unit", {
        issues: validation.issues,
      })
    }

    const [row] = await db
      .update(optionUnits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(optionUnits.id, id))
      .returning()

    return row ?? null
  },

  async deleteUnit(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(optionUnits)
      .where(eq(optionUnits.id, id))
      .returning({ id: optionUnits.id })

    return row ?? null
  },

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
      .returning()

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

  listItineraries(db: PostgresJsDatabase, productId: string) {
    return db
      .select()
      .from(productItineraries)
      .where(eq(productItineraries.productId, productId))
      .orderBy(desc(productItineraries.isDefault), asc(productItineraries.sortOrder))
  },

  async createItinerary(db: PostgresJsDatabase, productId: string, data: CreateItineraryInput) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const [existingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productItineraries)
      .where(eq(productItineraries.productId, productId))

    const shouldBeDefault = (existingCount?.count ?? 0) === 0 || data.isDefault
    const insertAsDefault = (existingCount?.count ?? 0) === 0
    const [row] = await db
      .insert(productItineraries)
      .values({
        productId,
        name: data.name,
        isDefault: insertAsDefault,
        sortOrder: data.sortOrder,
      })
      .returning()

    if (!row) {
      throw new Error(`Failed to create itinerary for product ${productId}`)
    }

    if (shouldBeDefault && !insertAsDefault) {
      await setDefaultItinerary(db, productId, row.id)
    }

    return shouldBeDefault && !insertAsDefault ? ((await getItineraryById(db, row.id)) ?? row) : row
  },

  async updateItinerary(db: PostgresJsDatabase, itineraryId: string, data: UpdateItineraryInput) {
    const itinerary = await getItineraryById(db, itineraryId)
    if (!itinerary) {
      return null
    }

    const { isDefault, ...rest } = data
    const [row] = await db
      .update(productItineraries)
      .set({
        ...rest,
        ...(isDefault === false ? { isDefault: false } : {}),
        updatedAt: new Date(),
      })
      .where(eq(productItineraries.id, itineraryId))
      .returning()

    if (!row) {
      return null
    }

    if (isDefault === true) {
      await setDefaultItinerary(db, itinerary.productId, itineraryId)
      return (await getItineraryById(db, itineraryId)) as typeof row
    }

    if (isDefault === false && itinerary.isDefault) {
      const [fallback] = await db
        .select({ id: productItineraries.id })
        .from(productItineraries)
        .where(
          and(
            eq(productItineraries.productId, itinerary.productId),
            sql`${productItineraries.id} <> ${itineraryId}`,
          ),
        )
        .orderBy(asc(productItineraries.sortOrder), asc(productItineraries.createdAt))
        .limit(1)

      if (fallback) {
        await setDefaultItinerary(db, itinerary.productId, fallback.id)
      } else {
        await setDefaultItinerary(db, itinerary.productId, itineraryId)
      }

      return (await getItineraryById(db, itineraryId)) as typeof row
    }

    return row
  },

  async deleteItinerary(db: PostgresJsDatabase, itineraryId: string) {
    const itinerary = await getItineraryById(db, itineraryId)
    if (!itinerary) {
      return null
    }

    const [row] = await db
      .delete(productItineraries)
      .where(eq(productItineraries.id, itineraryId))
      .returning({ id: productItineraries.id })

    if (!row) {
      return null
    }

    if (itinerary.isDefault) {
      await promoteFallbackItinerary(db, itinerary.productId)
    }

    return row
  },

  async duplicateItinerary(
    db: PostgresJsDatabase,
    itineraryId: string,
    options?: { name?: string },
  ) {
    const source = await getItineraryById(db, itineraryId)
    if (!source) {
      return null
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productItineraries)
      .where(eq(productItineraries.productId, source.productId))

    const name = options?.name?.trim() || `${source.name} (Copy)`
    const sortOrder = countRow?.count ?? 0

    const [created] = await db
      .insert(productItineraries)
      .values({
        productId: source.productId,
        name,
        isDefault: false,
        sortOrder,
      })
      .returning()

    if (!created) {
      throw new Error(`Failed to duplicate itinerary ${itineraryId}`)
    }

    const sourceDays = await db
      .select()
      .from(productDays)
      .where(eq(productDays.itineraryId, source.id))
      .orderBy(asc(productDays.dayNumber))

    if (sourceDays.length === 0) {
      return created
    }

    const dayIdMap = new Map<string, string>()
    const insertedDays = await db
      .insert(productDays)
      .values(
        sourceDays.map((day) => ({
          itineraryId: created.id,
          dayNumber: day.dayNumber,
          title: day.title,
          description: day.description,
          location: day.location,
        })),
      )
      .returning({ id: productDays.id, dayNumber: productDays.dayNumber })

    for (const sourceDay of sourceDays) {
      const match = insertedDays.find((day) => day.dayNumber === sourceDay.dayNumber)
      if (match) {
        dayIdMap.set(sourceDay.id, match.id)
      }
    }

    const sourceDayIds = sourceDays.map((day) => day.id)
    const sourceServices = await db
      .select()
      .from(productDayServices)
      .where(inArray(productDayServices.dayId, sourceDayIds))
      .orderBy(asc(productDayServices.sortOrder))

    if (sourceServices.length > 0) {
      await db.insert(productDayServices).values(
        sourceServices
          .map((service) => {
            const newDayId = dayIdMap.get(service.dayId)
            if (!newDayId) return null
            return {
              dayId: newDayId,
              supplierServiceId: service.supplierServiceId,
              serviceType: service.serviceType,
              name: service.name,
              description: service.description,
              countryCode: service.countryCode,
              costCurrency: service.costCurrency,
              costAmountCents: service.costAmountCents,
              quantity: service.quantity,
              sortOrder: service.sortOrder,
              notes: service.notes,
            }
          })
          .filter((value): value is NonNullable<typeof value> => value !== null),
      )
    }

    const sourceDayMedia = await db
      .select()
      .from(productMedia)
      .where(inArray(productMedia.dayId, sourceDayIds))
      .orderBy(asc(productMedia.sortOrder))

    if (sourceDayMedia.length > 0) {
      await db.insert(productMedia).values(
        sourceDayMedia
          .map((media) => {
            const newDayId = media.dayId ? dayIdMap.get(media.dayId) : null
            if (!newDayId) return null
            return {
              productId: media.productId,
              dayId: newDayId,
              mediaType: media.mediaType,
              name: media.name,
              url: media.url,
              storageKey: media.storageKey,
              mimeType: media.mimeType,
              fileSize: media.fileSize,
              altText: media.altText,
              sortOrder: media.sortOrder,
              isCover: media.isCover,
              isBrochure: false,
              isBrochureCurrent: false,
              brochureVersion: null,
            }
          })
          .filter((value): value is NonNullable<typeof value> => value !== null),
      )
    }

    return created
  },

  async listDays(db: PostgresJsDatabase, productId: string) {
    const itinerary = await ensureDefaultItinerary(db, productId)
    return productsService.listItineraryDays(db, itinerary.id)
  },

  listItineraryDays(db: PostgresJsDatabase, itineraryId: string) {
    return db
      .select()
      .from(productDays)
      .where(eq(productDays.itineraryId, itineraryId))
      .orderBy(asc(productDays.dayNumber))
  },

  async createDay(db: PostgresJsDatabase, productId: string, data: CreateDayInput) {
    const itinerary = await ensureDefaultItinerary(db, productId)
    return productsService.createItineraryDay(db, productId, itinerary.id, data)
  },

  async createItineraryDay(
    db: PostgresJsDatabase,
    productId: string,
    itineraryId: string,
    data: CreateDayInput,
  ) {
    const itinerary = await getItineraryById(db, itineraryId)
    if (!itinerary || itinerary.productId !== productId) {
      return null
    }

    const [row] = await db
      .insert(productDays)
      .values({ ...data, itineraryId })
      .returning()

    return row
  },

  async updateDay(db: PostgresJsDatabase, dayId: string, data: UpdateDayInput) {
    const [row] = await db
      .update(productDays)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productDays.id, dayId))
      .returning()

    return row ?? null
  },

  async deleteDay(db: PostgresJsDatabase, dayId: string) {
    const [row] = await db
      .delete(productDays)
      .where(eq(productDays.id, dayId))
      .returning({ id: productDays.id })

    return row ?? null
  },

  listDayServices(db: PostgresJsDatabase, dayId: string) {
    return db
      .select()
      .from(productDayServices)
      .where(eq(productDayServices.dayId, dayId))
      .orderBy(asc(productDayServices.sortOrder))
  },

  async createDayService(
    db: PostgresJsDatabase,
    productId: string,
    dayId: string,
    data: CreateDayServiceInput,
  ) {
    const day = await getDayById(db, dayId)

    if (!day || day.productId !== productId) {
      return null
    }

    const [row] = await db
      .insert(productDayServices)
      .values({ ...data, dayId })
      .returning()

    await recalculateProductCost(db, productId)

    return row
  },

  async updateDayService(
    db: PostgresJsDatabase,
    productId: string,
    serviceId: string,
    data: UpdateDayServiceInput,
  ) {
    const [row] = await db
      .update(productDayServices)
      .set(data)
      .where(eq(productDayServices.id, serviceId))
      .returning()

    if (!row) {
      return null
    }

    await recalculateProductCost(db, productId)
    return row
  },

  async deleteDayService(db: PostgresJsDatabase, productId: string, serviceId: string) {
    const [row] = await db
      .delete(productDayServices)
      .where(eq(productDayServices.id, serviceId))
      .returning({ id: productDayServices.id })

    if (!row) {
      return null
    }

    await recalculateProductCost(db, productId)
    return row
  },

  listVersions(db: PostgresJsDatabase, productId: string) {
    return db
      .select()
      .from(productVersions)
      .where(eq(productVersions.productId, productId))
      .orderBy(desc(productVersions.versionNumber))
  },

  async createVersion(
    db: PostgresJsDatabase,
    productId: string,
    userId: string,
    data: CreateVersionInput,
  ) {
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1)

    if (!product) {
      return null
    }

    const itineraries = await db
      .select()
      .from(productItineraries)
      .where(eq(productItineraries.productId, productId))
      .orderBy(desc(productItineraries.isDefault), asc(productItineraries.sortOrder))

    const defaultItinerary = itineraries.find((itinerary) => itinerary.isDefault) ?? null

    const options = await db
      .select()
      .from(productOptions)
      .where(eq(productOptions.productId, productId))
      .orderBy(asc(productOptions.sortOrder), asc(productOptions.createdAt))

    const optionsWithUnits = await Promise.all(
      options.map(async (option) => {
        const units = await db
          .select()
          .from(optionUnits)
          .where(eq(optionUnits.optionId, option.id))
          .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.createdAt))

        return { ...option, units }
      }),
    )

    const itinerariesWithDays = await Promise.all(
      itineraries.map(async (itinerary) => {
        const days = await db
          .select()
          .from(productDays)
          .where(eq(productDays.itineraryId, itinerary.id))
          .orderBy(asc(productDays.dayNumber))

        const daysWithServices = await Promise.all(
          days.map(async (day) => {
            const services = await db
              .select()
              .from(productDayServices)
              .where(eq(productDayServices.dayId, day.id))
              .orderBy(asc(productDayServices.sortOrder))

            return { ...day, services }
          }),
        )

        return { ...itinerary, days: daysWithServices }
      }),
    )

    const defaultDays =
      itinerariesWithDays.find((itinerary) => itinerary.id === defaultItinerary?.id)?.days ?? []

    const [maxVersion] = await db
      .select({ max: sql<number>`coalesce(max(${productVersions.versionNumber}), 0)` })
      .from(productVersions)
      .where(eq(productVersions.productId, productId))

    const [row] = await db
      .insert(productVersions)
      .values({
        productId,
        versionNumber: (maxVersion?.max ?? 0) + 1,
        snapshot: {
          ...product,
          options: optionsWithUnits,
          itineraries: itinerariesWithDays,
          days: defaultDays,
        },
        authorId: userId,
        notes: data.notes,
      })
      .returning()

    return row
  },

  listNotes(db: PostgresJsDatabase, productId: string) {
    return db
      .select()
      .from(productNotes)
      .where(eq(productNotes.productId, productId))
      .orderBy(productNotes.createdAt)
  },

  async createNote(
    db: PostgresJsDatabase,
    productId: string,
    userId: string,
    data: CreateProductNoteInput,
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
      .insert(productNotes)
      .values({
        productId,
        authorId: userId,
        content: data.content,
      })
      .returning()

    return row
  },

  async recalculate(db: PostgresJsDatabase, productId: string) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (!product) {
      return null
    }

    return recalculateProductCost(db, productId)
  },

  // ==========================================================================
  // Product Types
  // ==========================================================================

  async listProductTypes(db: PostgresJsDatabase, query: ProductTypeListQuery) {
    const conditions = []

    if (query.active !== undefined) {
      conditions.push(eq(productTypes.active, query.active))
    }

    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(productTypes.name, term), ilike(productTypes.code, term)))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productTypes)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productTypes.sortOrder), asc(productTypes.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(productTypes).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getProductTypeById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productTypes).where(eq(productTypes.id, id)).limit(1)
    return row ?? null
  },

  async createProductType(db: PostgresJsDatabase, data: CreateProductTypeInput) {
    const [row] = await db.insert(productTypes).values(data).returning()
    return row
  },

  async updateProductType(db: PostgresJsDatabase, id: string, data: UpdateProductTypeInput) {
    const [row] = await db
      .update(productTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productTypes.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductType(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productTypes)
      .where(eq(productTypes.id, id))
      .returning({ id: productTypes.id })

    return row ?? null
  },

  // ==========================================================================
  // Product Categories
  // ==========================================================================

  async listProductCategories(db: PostgresJsDatabase, query: ProductCategoryListQuery) {
    const conditions = []

    if (query.parentId) {
      conditions.push(eq(productCategories.parentId, query.parentId))
    }

    if (query.active !== undefined) {
      conditions.push(eq(productCategories.active, query.active))
    }

    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(productCategories.name, term), ilike(productCategories.slug, term)))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productCategories)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productCategories.sortOrder), asc(productCategories.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(productCategories).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getProductCategoryById(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, id))
      .limit(1)
    return row ?? null
  },

  async createProductCategory(db: PostgresJsDatabase, data: CreateProductCategoryInput) {
    const [row] = await db.insert(productCategories).values(data).returning()
    return row
  },

  async updateProductCategory(
    db: PostgresJsDatabase,
    id: string,
    data: UpdateProductCategoryInput,
  ) {
    const [row] = await db
      .update(productCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productCategories.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductCategory(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productCategories)
      .where(eq(productCategories.id, id))
      .returning({ id: productCategories.id })

    return row ?? null
  },

  // ==========================================================================
  // Product Tags
  // ==========================================================================

  async listProductTags(db: PostgresJsDatabase, query: ProductTagListQuery) {
    const conditions = []

    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(ilike(productTags.name, term))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productTags)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(asc(productTags.name)),
      db.select({ count: sql<number>`count(*)::int` }).from(productTags).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getProductTagById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productTags).where(eq(productTags.id, id)).limit(1)
    return row ?? null
  },

  async createProductTag(db: PostgresJsDatabase, data: CreateProductTagInput) {
    const [row] = await db.insert(productTags).values(data).returning()
    return row
  },

  async updateProductTag(db: PostgresJsDatabase, id: string, data: UpdateProductTagInput) {
    const [row] = await db
      .update(productTags)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productTags.id, id))
      .returning()

    return row ?? null
  },

  async deleteProductTag(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(productTags)
      .where(eq(productTags.id, id))
      .returning({ id: productTags.id })

    return row ?? null
  },

  // ==========================================================================
  // Product <-> Category associations
  // ==========================================================================

  async addProductToCategory(
    db: PostgresJsDatabase,
    productId: string,
    categoryId: string,
    sortOrder = 0,
  ) {
    const [row] = await db
      .insert(productCategoryProducts)
      .values({ productId, categoryId, sortOrder })
      .onConflictDoNothing()
      .returning()

    return row ?? null
  },

  async removeProductFromCategory(db: PostgresJsDatabase, productId: string, categoryId: string) {
    const [row] = await db
      .delete(productCategoryProducts)
      .where(
        and(
          eq(productCategoryProducts.productId, productId),
          eq(productCategoryProducts.categoryId, categoryId),
        ),
      )
      .returning({ productId: productCategoryProducts.productId })

    return row ?? null
  },

  async listProductCategories_(db: PostgresJsDatabase, productId: string) {
    const rows = await db
      .select({ category: productCategories })
      .from(productCategoryProducts)
      .innerJoin(productCategories, eq(productCategoryProducts.categoryId, productCategories.id))
      .where(eq(productCategoryProducts.productId, productId))
      .orderBy(asc(productCategoryProducts.sortOrder))

    return rows.map((r) => r.category)
  },

  // ==========================================================================
  // Product <-> Tag associations
  // ==========================================================================

  async addProductTag(db: PostgresJsDatabase, productId: string, tagId: string) {
    const [row] = await db
      .insert(productTagProducts)
      .values({ productId, tagId })
      .onConflictDoNothing()
      .returning()

    return row ?? null
  },

  async removeProductTag(db: PostgresJsDatabase, productId: string, tagId: string) {
    const [row] = await db
      .delete(productTagProducts)
      .where(and(eq(productTagProducts.productId, productId), eq(productTagProducts.tagId, tagId)))
      .returning({ productId: productTagProducts.productId })

    return row ?? null
  },

  async listProductTags_(db: PostgresJsDatabase, productId: string) {
    const rows = await db
      .select({ tag: productTags })
      .from(productTagProducts)
      .innerJoin(productTags, eq(productTagProducts.tagId, productTags.id))
      .where(eq(productTagProducts.productId, productId))
      .orderBy(asc(productTags.name))

    return rows.map((r) => r.tag)
  },

  // ==========================================================================
  // Product Media
  // ==========================================================================

  async listMedia(db: PostgresJsDatabase, productId: string, query: ProductMediaListQuery) {
    const conditions = [eq(productMedia.productId, productId)]

    if (query.dayId !== undefined) {
      conditions.push(eq(productMedia.dayId, query.dayId))
    }

    if (query.mediaType) {
      conditions.push(eq(productMedia.mediaType, query.mediaType))
    }

    if (query.isBrochure !== undefined) {
      conditions.push(eq(productMedia.isBrochure, query.isBrochure))
    }

    if (query.isBrochureCurrent !== undefined) {
      conditions.push(eq(productMedia.isBrochureCurrent, query.isBrochureCurrent))
    }

    const where = and(...conditions)

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productMedia)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          desc(productMedia.isCover),
          asc(productMedia.sortOrder),
          asc(productMedia.createdAt),
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(productMedia).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async listProductLevelMedia(
    db: PostgresJsDatabase,
    productId: string,
    query: ProductMediaListQuery,
  ) {
    const conditions = [eq(productMedia.productId, productId), sql`${productMedia.dayId} is null`]

    if (query.mediaType) {
      conditions.push(eq(productMedia.mediaType, query.mediaType))
    }

    if (query.isBrochure !== undefined) {
      conditions.push(eq(productMedia.isBrochure, query.isBrochure))
    }

    if (query.isBrochureCurrent !== undefined) {
      conditions.push(eq(productMedia.isBrochureCurrent, query.isBrochureCurrent))
    }

    const where = and(...conditions)

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(productMedia)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(
          desc(productMedia.isCover),
          asc(productMedia.sortOrder),
          asc(productMedia.createdAt),
        ),
      db.select({ count: sql<number>`count(*)::int` }).from(productMedia).where(where),
    ])

    return {
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async getMediaById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(productMedia).where(eq(productMedia.id, id)).limit(1)
    return row ?? null
  },

  async createMedia(db: PostgresJsDatabase, productId: string, data: CreateProductMediaInput) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    if (data.dayId) {
      if (data.isBrochure) {
        return null
      }

      const day = await getDayById(db, data.dayId)

      if (!day || day.productId !== productId) {
        return null
      }
    }

    if (data.isBrochure) {
      await db
        .update(productMedia)
        .set({ isBrochureCurrent: false, updatedAt: new Date() })
        .where(
          and(
            eq(productMedia.productId, productId),
            eq(productMedia.isBrochure, true),
            sql`${productMedia.dayId} is null`,
          ),
        )
    }

    const [row] = await db
      .insert(productMedia)
      .values({
        productId,
        dayId: data.dayId ?? null,
        mediaType: data.mediaType,
        name: data.name,
        url: data.url,
        storageKey: data.storageKey ?? null,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? null,
        altText: data.altText ?? null,
        sortOrder: data.sortOrder,
        isCover: data.isCover,
        isBrochure: data.isBrochure,
        isBrochureCurrent: data.isBrochureCurrent,
        brochureVersion: data.brochureVersion ?? null,
      })
      .returning()

    return row ?? null
  },

  async updateMedia(db: PostgresJsDatabase, id: string, data: UpdateProductMediaInput) {
    const existing = await this.getMediaById(db, id)
    if (!existing) {
      return null
    }

    if (data.isBrochure === true && existing.dayId) {
      return null
    }

    if (data.isBrochure === true) {
      await db
        .update(productMedia)
        .set({ isBrochureCurrent: false, updatedAt: new Date() })
        .where(
          and(
            eq(productMedia.productId, existing.productId),
            eq(productMedia.isBrochure, true),
            sql`${productMedia.dayId} is null`,
            sql`${productMedia.id} <> ${id}`,
          ),
        )
    }

    const [row] = await db
      .update(productMedia)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productMedia.id, id))
      .returning()

    return row ?? null
  },

  async deleteMedia(db: PostgresJsDatabase, id: string) {
    const [row] = await db.delete(productMedia).where(eq(productMedia.id, id)).returning()

    return row ?? null
  },

  async setCoverMedia(
    db: PostgresJsDatabase,
    productId: string,
    mediaId: string,
    dayId?: string | null,
  ) {
    // Unset existing cover in the same scope (product-level or day-level)
    const scopeConditions = [eq(productMedia.productId, productId)]
    if (dayId) {
      scopeConditions.push(eq(productMedia.dayId, dayId))
    } else {
      scopeConditions.push(sql`${productMedia.dayId} is null`)
    }

    await db
      .update(productMedia)
      .set({ isCover: false, updatedAt: new Date() })
      .where(and(...scopeConditions))

    const [row] = await db
      .update(productMedia)
      .set({ isCover: true, updatedAt: new Date() })
      .where(eq(productMedia.id, mediaId))
      .returning()

    return row ?? null
  },

  async reorderMedia(db: PostgresJsDatabase, data: ReorderProductMediaInput) {
    const results = await Promise.all(
      data.items.map(async (item) => {
        const [row] = await db
          .update(productMedia)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(eq(productMedia.id, item.id))
          .returning({ id: productMedia.id })

        return row
      }),
    )

    return results.filter((r) => r != null)
  },

  async getBrochure(db: PostgresJsDatabase, productId: string) {
    const [row] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          eq(productMedia.isBrochureCurrent, true),
          sql`${productMedia.dayId} is null`,
        ),
      )
      .orderBy(
        desc(productMedia.brochureVersion),
        desc(productMedia.updatedAt),
        desc(productMedia.createdAt),
      )
      .limit(1)

    return row ?? null
  },

  async listBrochures(db: PostgresJsDatabase, productId: string) {
    return db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          sql`${productMedia.dayId} is null`,
        ),
      )
      .orderBy(
        desc(productMedia.isBrochureCurrent),
        desc(productMedia.brochureVersion),
        desc(productMedia.updatedAt),
        desc(productMedia.createdAt),
      )
  },

  async upsertBrochure(
    db: PostgresJsDatabase,
    productId: string,
    data: UpsertProductBrochureInput,
  ) {
    const product = await ensureProductExists(db, productId)
    if (!product) {
      return null
    }

    const brochures = await this.listBrochures(db, productId)
    const nextVersion =
      brochures.reduce((maxVersion, brochure) => {
        const version = brochure.brochureVersion ?? 0
        return version > maxVersion ? version : maxVersion
      }, 0) + 1

    return this.createMedia(db, productId, {
      mediaType: "document",
      dayId: null,
      name: data.name,
      url: data.url,
      storageKey: data.storageKey ?? null,
      mimeType: data.mimeType ?? "application/pdf",
      fileSize: data.fileSize ?? null,
      altText: data.altText ?? null,
      sortOrder: data.sortOrder,
      isCover: false,
      isBrochure: true,
      isBrochureCurrent: true,
      brochureVersion: nextVersion,
    })
  },

  async deleteBrochure(db: PostgresJsDatabase, productId: string) {
    const brochure = await this.getBrochure(db, productId)
    if (!brochure) {
      return null
    }

    const [row] = await db.delete(productMedia).where(eq(productMedia.id, brochure.id)).returning()

    const [previous] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          sql`${productMedia.dayId} is null`,
        ),
      )
      .orderBy(
        desc(productMedia.brochureVersion),
        desc(productMedia.updatedAt),
        desc(productMedia.createdAt),
      )
      .limit(1)

    if (previous) {
      await db
        .update(productMedia)
        .set({ isBrochureCurrent: true, updatedAt: new Date() })
        .where(eq(productMedia.id, previous.id))
    }

    return row ?? null
  },

  async setCurrentBrochure(db: PostgresJsDatabase, productId: string, brochureId: string) {
    const [brochure] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.id, brochureId),
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          sql`${productMedia.dayId} is null`,
        ),
      )
      .limit(1)

    if (!brochure) {
      return null
    }

    await db
      .update(productMedia)
      .set({ isBrochureCurrent: false, updatedAt: new Date() })
      .where(
        and(
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          sql`${productMedia.dayId} is null`,
        ),
      )

    const [row] = await db
      .update(productMedia)
      .set({ isBrochureCurrent: true, updatedAt: new Date() })
      .where(eq(productMedia.id, brochureId))
      .returning()

    return row ?? null
  },

  async deleteBrochureVersion(db: PostgresJsDatabase, productId: string, brochureId: string) {
    const [brochure] = await db
      .select()
      .from(productMedia)
      .where(
        and(
          eq(productMedia.id, brochureId),
          eq(productMedia.productId, productId),
          eq(productMedia.isBrochure, true),
          sql`${productMedia.dayId} is null`,
        ),
      )
      .limit(1)

    if (!brochure) {
      return null
    }

    const [row] = await db.delete(productMedia).where(eq(productMedia.id, brochureId)).returning()

    if (brochure.isBrochureCurrent) {
      const [previous] = await db
        .select()
        .from(productMedia)
        .where(
          and(
            eq(productMedia.productId, productId),
            eq(productMedia.isBrochure, true),
            sql`${productMedia.dayId} is null`,
          ),
        )
        .orderBy(
          desc(productMedia.brochureVersion),
          desc(productMedia.updatedAt),
          desc(productMedia.createdAt),
        )
        .limit(1)

      if (previous) {
        await db
          .update(productMedia)
          .set({ isBrochureCurrent: true, updatedAt: new Date() })
          .where(eq(productMedia.id, previous.id))
      }
    }

    return row ?? null
  },
}
