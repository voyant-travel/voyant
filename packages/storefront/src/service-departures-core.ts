import type { SlotResourceAvailability } from "@voyantjs/availability"
import { availabilitySlots, availabilityStartTimes } from "@voyantjs/availability/schema"
import { productItineraries, productLocations, products } from "@voyantjs/products/schema"
import { and, asc, count, eq, gte, inArray, lte, ne } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

export type SlotRow = {
  id: string
  productId: string
  itineraryId: string | null
  optionId: string | null
  startTimeId: string | null
  dateLocal: Date | string
  startsAt: Date | string
  endsAt: Date | string | null
  timezone: string
  status: "open" | "closed" | "sold_out" | "cancelled"
  unlimited: boolean
  initialPax: number | null
  remainingPax: number | null
  remainingResources: number | null
  pastCutoff: boolean
  tooEarly: boolean
  nights: number | null
  days: number | null
  startTimeLabel: string | null
  startTimeLocal: string | null
  durationMinutes: number | null
}

export function normalizeIso(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
}

export function normalizeLocalDate(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  return String(value).slice(0, 10)
}

export async function listMeetingPointsByProductIds(db: PostgresJsDatabase, productIds: string[]) {
  if (productIds.length === 0) {
    return new Map<string, string>()
  }

  const rows = await db
    .select({
      productId: productLocations.productId,
      title: productLocations.title,
      locationType: productLocations.locationType,
    })
    .from(productLocations)
    .where(inArray(productLocations.productId, productIds))
    .orderBy(
      productLocations.locationType,
      asc(productLocations.sortOrder),
      asc(productLocations.createdAt),
    )

  const byProduct = new Map<string, string>()
  for (const row of rows) {
    if (byProduct.has(row.productId)) {
      continue
    }

    byProduct.set(row.productId, row.title)
  }

  return byProduct
}

export async function listDefaultItineraryIdsByProductIds(
  db: PostgresJsDatabase,
  productIds: string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({
      productId: productItineraries.productId,
      itineraryId: productItineraries.id,
    })
    .from(productItineraries)
    .where(
      and(
        inArray(productItineraries.productId, productIds),
        eq(productItineraries.isDefault, true),
      ),
    )
    .orderBy(asc(productItineraries.sortOrder), asc(productItineraries.createdAt))

  return new Map(rows.map((row) => [row.productId, row.itineraryId] as const))
}

export async function listSlots(
  db: PostgresJsDatabase,
  filters: {
    productId?: string
    slotId?: string
    optionId?: string
    status?: "open" | "closed" | "sold_out" | "cancelled"
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
    includeCancelled?: boolean
  } = {},
) {
  const conditions = [
    eq(products.status, "active"),
    eq(products.activated, true),
    eq(products.visibility, "public"),
  ]

  if (filters.productId) {
    conditions.push(eq(availabilitySlots.productId, filters.productId))
  }

  if (filters.slotId) {
    conditions.push(eq(availabilitySlots.id, filters.slotId))
  }

  if (filters.optionId) {
    conditions.push(eq(availabilitySlots.optionId, filters.optionId))
  }

  if (filters.status) {
    conditions.push(eq(availabilitySlots.status, filters.status))
  } else if (!filters.includeCancelled) {
    conditions.push(ne(availabilitySlots.status, "cancelled"))
  }

  if (filters.dateFrom) {
    conditions.push(gte(availabilitySlots.dateLocal, filters.dateFrom))
  }

  if (filters.dateTo) {
    conditions.push(lte(availabilitySlots.dateLocal, filters.dateTo))
  }

  return db
    .select({
      id: availabilitySlots.id,
      productId: availabilitySlots.productId,
      itineraryId: availabilitySlots.itineraryId,
      optionId: availabilitySlots.optionId,
      startTimeId: availabilitySlots.startTimeId,
      dateLocal: availabilitySlots.dateLocal,
      startsAt: availabilitySlots.startsAt,
      endsAt: availabilitySlots.endsAt,
      timezone: availabilitySlots.timezone,
      status: availabilitySlots.status,
      unlimited: availabilitySlots.unlimited,
      initialPax: availabilitySlots.initialPax,
      remainingPax: availabilitySlots.remainingPax,
      remainingResources: availabilitySlots.remainingResources,
      pastCutoff: availabilitySlots.pastCutoff,
      tooEarly: availabilitySlots.tooEarly,
      nights: availabilitySlots.nights,
      days: availabilitySlots.days,
      startTimeLabel: availabilityStartTimes.label,
      startTimeLocal: availabilityStartTimes.startTimeLocal,
      durationMinutes: availabilityStartTimes.durationMinutes,
    })
    .from(availabilitySlots)
    .innerJoin(products, eq(products.id, availabilitySlots.productId))
    .leftJoin(availabilityStartTimes, eq(availabilityStartTimes.id, availabilitySlots.startTimeId))
    .where(and(...conditions))
    .orderBy(asc(availabilitySlots.startsAt))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
}

export async function countSlots(
  db: PostgresJsDatabase,
  filters: {
    productId?: string
    slotId?: string
    optionId?: string
    status?: "open" | "closed" | "sold_out" | "cancelled"
    dateFrom?: string
    dateTo?: string
    includeCancelled?: boolean
  } = {},
) {
  const conditions = [
    eq(products.status, "active"),
    eq(products.activated, true),
    eq(products.visibility, "public"),
  ]

  if (filters.productId) {
    conditions.push(eq(availabilitySlots.productId, filters.productId))
  }

  if (filters.slotId) {
    conditions.push(eq(availabilitySlots.id, filters.slotId))
  }

  if (filters.optionId) {
    conditions.push(eq(availabilitySlots.optionId, filters.optionId))
  }

  if (filters.status) {
    conditions.push(eq(availabilitySlots.status, filters.status))
  } else if (!filters.includeCancelled) {
    conditions.push(ne(availabilitySlots.status, "cancelled"))
  }

  if (filters.dateFrom) {
    conditions.push(gte(availabilitySlots.dateLocal, filters.dateFrom))
  }

  if (filters.dateTo) {
    conditions.push(lte(availabilitySlots.dateLocal, filters.dateTo))
  }

  const [result] = await db
    .select({ value: count() })
    .from(availabilitySlots)
    .innerJoin(products, eq(products.id, availabilitySlots.productId))
    .where(and(...conditions))

  return result?.value ?? 0
}

export function buildResourceManifest(resources: SlotResourceAvailability[]) {
  if (resources.length === 0) return null
  const totals = new Map<string, { capacity: number; assigned: number; available: number }>()
  for (const resource of resources) {
    const bucket = totals.get(resource.kind) ?? { capacity: 0, assigned: 0, available: 0 }
    bucket.capacity += resource.capacity
    bucket.assigned += resource.assigned
    bucket.available += resource.available
    totals.set(resource.kind, bucket)
  }
  return {
    kinds: [...totals.entries()].map(([kind, totals]) => ({ kind, ...totals })),
    resources: resources.map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      label: resource.label,
      refType: resource.refType,
      refId: resource.refId,
      capacity: resource.capacity,
      assigned: resource.assigned,
      available: resource.available,
      parentId: resource.parentId,
      flags: resource.flags,
    })),
  }
}

export type StorefrontProductAvailabilityState =
  | "available"
  | "sold_out"
  | "closed"
  | "cancelled"
  | "on_request"
  | "past_cutoff"
  | "too_early"
  | "unavailable"

export function todayLocalDate() {
  return new Date().toISOString().slice(0, 10)
}

export function buildAvailabilityState(args: {
  status: "open" | "closed" | "sold_out" | "cancelled" | "on_request"
  remaining: number | null
  capacity: number | null
  pastCutoff: boolean
  tooEarly: boolean
}): StorefrontProductAvailabilityState {
  if (args.status === "cancelled") return "cancelled"
  if (args.status === "closed") return "closed"
  if (args.status === "sold_out") return "sold_out"
  if (args.status === "on_request") return "on_request"
  if (args.pastCutoff) return "past_cutoff"
  if (args.tooEarly) return "too_early"
  if (args.capacity != null && args.remaining === 0) return "sold_out"

  return "available"
}

export function summarizeProductAvailability(
  departures: Array<{
    availabilityState: StorefrontProductAvailabilityState
    status: "open" | "closed" | "sold_out" | "cancelled" | "on_request"
  }>,
): StorefrontProductAvailabilityState {
  if (departures.some((departure) => departure.availabilityState === "available")) {
    return "available"
  }
  if (departures.some((departure) => departure.availabilityState === "on_request")) {
    return "on_request"
  }
  if (departures.some((departure) => departure.availabilityState === "too_early")) {
    return "too_early"
  }
  if (departures.some((departure) => departure.availabilityState === "past_cutoff")) {
    return "past_cutoff"
  }
  if (departures.some((departure) => departure.availabilityState === "sold_out")) {
    return "sold_out"
  }
  if (departures.some((departure) => departure.availabilityState === "closed")) {
    return "closed"
  }
  if (departures.some((departure) => departure.availabilityState === "cancelled")) {
    return "cancelled"
  }

  return "unavailable"
}
