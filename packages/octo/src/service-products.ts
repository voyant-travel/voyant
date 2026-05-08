import { availabilitySlots, availabilityStartTimes } from "@voyantjs/availability/schema"
import { productsService } from "@voyantjs/products"
import {
  optionUnits,
  productCapabilities,
  productDeliveryFormats,
  productFaqs,
  productFeatures,
  productLocations,
  productOptions,
  products,
} from "@voyantjs/products/schema"
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import {
  buildProductContent,
  buildProjectedAvailability,
  inferOctoAvailabilityType,
  mapUnit,
  type OctoAvailabilityCalendarQuery,
  type OctoAvailabilityListQuery,
  type OctoProductListQuery,
  pickOptionStartTimes,
} from "./service-shared.js"
import type { OctoAvailabilityStatus, OctoProjectedProduct } from "./types.js"

export async function getProjectedProductById(
  db: PostgresJsDatabase,
  id: string,
): Promise<OctoProjectedProduct | null> {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  if (!product) return null

  const [options, startTimes, capabilities, deliveryFormats, features, faqs, locations] =
    await Promise.all([
      db
        .select()
        .from(productOptions)
        .where(eq(productOptions.productId, product.id))
        .orderBy(asc(productOptions.sortOrder), asc(productOptions.createdAt)),
      db
        .select()
        .from(availabilityStartTimes)
        .where(eq(availabilityStartTimes.productId, product.id))
        .orderBy(asc(availabilityStartTimes.sortOrder), asc(availabilityStartTimes.createdAt)),
      db
        .select()
        .from(productCapabilities)
        .where(eq(productCapabilities.productId, product.id))
        .orderBy(asc(productCapabilities.createdAt)),
      db
        .select()
        .from(productDeliveryFormats)
        .where(eq(productDeliveryFormats.productId, product.id))
        .orderBy(asc(productDeliveryFormats.createdAt)),
      db
        .select()
        .from(productFeatures)
        .where(eq(productFeatures.productId, product.id))
        .orderBy(asc(productFeatures.sortOrder), asc(productFeatures.createdAt)),
      db
        .select()
        .from(productFaqs)
        .where(eq(productFaqs.productId, product.id))
        .orderBy(asc(productFaqs.sortOrder), asc(productFaqs.createdAt)),
      db
        .select()
        .from(productLocations)
        .where(eq(productLocations.productId, product.id))
        .orderBy(asc(productLocations.sortOrder), asc(productLocations.createdAt)),
    ])

  const optionIds = options.map((option) => option.id)
  const units =
    optionIds.length > 0
      ? await db
          .select()
          .from(optionUnits)
          .where(inArray(optionUnits.optionId, optionIds))
          .orderBy(asc(optionUnits.sortOrder), asc(optionUnits.createdAt))
      : []

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    timeZone: product.timezone,
    availabilityType: inferOctoAvailabilityType(product.bookingMode),
    allowFreesale: product.capacityMode === "free_sale",
    instantConfirmation: capabilities.some(
      (capability) => capability.capability === "instant_confirmation" && capability.enabled,
    ),
    options: options.map((option) => ({
      id: option.id,
      name: option.name,
      code: option.code,
      default: option.isDefault,
      availabilityLocalStartTimes: pickOptionStartTimes(option, startTimes),
      units: units.filter((unit) => unit.optionId === option.id).map(mapUnit),
    })),
    content: buildProductContent({ features, faqs, locations }),
    extensions: {
      status: product.status,
      visibility: product.visibility,
      activated: product.activated,
      facilityId: product.facilityId ?? null,
      bookingMode: product.bookingMode,
      capabilityCodes: capabilities
        .filter((capability) => capability.enabled)
        .map((capability) => capability.capability),
      deliveryFormats: deliveryFormats.map((format) => format.format),
    },
  }
}

export async function getProjectedAvailabilityById(db: PostgresJsDatabase, id: string) {
  const [row] = await db
    .select()
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, id))
    .limit(1)
  if (!row) return null

  const [product] = await db
    .select({ capacityMode: products.capacityMode, timezone: products.timezone })
    .from(products)
    .where(eq(products.id, row.productId))
    .limit(1)

  return buildProjectedAvailability(row, product)
}

export async function listProjectedAvailability(
  db: PostgresJsDatabase,
  query: OctoAvailabilityListQuery,
) {
  const conditions = []
  if (query.productId) conditions.push(eq(availabilitySlots.productId, query.productId))
  if (query.optionId) conditions.push(eq(availabilitySlots.optionId, query.optionId))
  if (query.localDateStart) conditions.push(gte(availabilitySlots.dateLocal, query.localDateStart))
  if (query.localDateEnd) conditions.push(lte(availabilitySlots.dateLocal, query.localDateEnd))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(availabilitySlots)
      .where(where)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(asc(availabilitySlots.startsAt)),
    db.select({ count: sql<number>`count(*)::int` }).from(availabilitySlots).where(where),
  ])

  const productIds = [...new Set(rows.map((row) => row.productId))]
  const productRows =
    productIds.length > 0
      ? await db
          .select({
            id: products.id,
            capacityMode: products.capacityMode,
            timezone: products.timezone,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : []

  const productsById = new Map(productRows.map((product) => [product.id, product]))

  return {
    data: rows.map((row) => buildProjectedAvailability(row, productsById.get(row.productId))),
    total: countResult[0]?.count ?? 0,
    limit: query.limit,
    offset: query.offset,
  }
}

export async function getProjectedAvailabilityCalendar(
  db: PostgresJsDatabase,
  productId: string,
  query: OctoAvailabilityCalendarQuery,
) {
  const result = await listProjectedAvailability(db, {
    productId,
    optionId: query.optionId,
    localDateStart: query.localDateStart,
    localDateEnd: query.localDateEnd,
    limit: 200,
    offset: 0,
  })

  const days = new Map<
    string,
    {
      localDate: string
      status: OctoAvailabilityStatus
      vacancies: number | null
      capacity: number | null
      availabilityIds: string[]
    }
  >()

  const rank: Record<OctoAvailabilityStatus, number> = {
    FREESALE: 5,
    AVAILABLE: 4,
    LIMITED: 3,
    SOLD_OUT: 2,
    CLOSED: 1,
  }

  for (const availability of result.data) {
    const localDate = availability.localDateTimeStart.slice(0, 10)
    const existing = days.get(localDate)
    const nextStatus =
      !existing || rank[availability.status] > rank[existing.status]
        ? availability.status
        : existing.status

    days.set(localDate, {
      localDate,
      status: nextStatus,
      vacancies:
        existing?.vacancies === null || availability.vacancies === null
          ? null
          : Math.max(existing?.vacancies ?? 0, availability.vacancies),
      capacity:
        existing?.capacity === null || availability.capacity === null
          ? null
          : Math.max(existing?.capacity ?? 0, availability.capacity),
      availabilityIds: [...(existing?.availabilityIds ?? []), availability.id],
    })
  }

  return {
    data: [...days.values()].sort((left, right) => left.localDate.localeCompare(right.localDate)),
    total: days.size,
  }
}

export async function listProjectedProducts(db: PostgresJsDatabase, query: OctoProductListQuery) {
  const result = await productsService.listProducts(db, {
    ...query,
    sortBy: "createdAt",
    sortDir: "desc",
  })
  const data = await Promise.all(
    result.data.map(async (product) => getProjectedProductById(db, product.id)),
  )

  return {
    data: data.filter((row): row is OctoProjectedProduct => Boolean(row)),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  }
}
