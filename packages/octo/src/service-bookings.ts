import {
  type BookingOrigin,
  bookingsService,
  getBookingOriginByBookingId,
} from "@voyant-travel/bookings"
import {
  bookingAllocations,
  bookingFulfillments,
  bookingItems,
  bookingItemTravelers,
  bookingRedemptionEvents,
  bookingSupplierStatuses,
  bookings,
  bookingTravelers,
} from "@voyant-travel/bookings/schema"
import { asc, eq, inArray } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import {
  mapBookingArtifact,
  mapBookingStatus,
  type OctoBookingListQuery,
  pickBookingContact,
  toIsoString,
} from "./service-shared.js"

function readLegacyOriginId(origin: BookingOrigin | null, key: "offerId" | "orderId") {
  if (!origin) return null
  const direct =
    key === "offerId" ? origin.legacyTransactionOfferId : origin.legacyTransactionOrderId
  if (typeof direct === "string" && direct.length > 0) return direct
  const fromJson = origin.legacyTransactionIds?.[key]
  return typeof fromJson === "string" && fromJson.length > 0 ? fromJson : null
}

export async function getProjectedBookingById(db: PostgresJsDatabase, id: string) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1)
  if (!booking) return null

  const [participants, items, allocations, fulfillments, redemptions, supplierStatuses, origin] =
    await Promise.all([
      db
        .select()
        .from(bookingTravelers)
        .where(eq(bookingTravelers.bookingId, booking.id))
        .orderBy(asc(bookingTravelers.createdAt)),
      db
        .select()
        .from(bookingItems)
        .where(eq(bookingItems.bookingId, booking.id))
        .orderBy(asc(bookingItems.createdAt)),
      db
        .select()
        .from(bookingAllocations)
        .where(eq(bookingAllocations.bookingId, booking.id))
        .orderBy(asc(bookingAllocations.createdAt)),
      db
        .select()
        .from(bookingFulfillments)
        .where(eq(bookingFulfillments.bookingId, booking.id))
        .orderBy(asc(bookingFulfillments.createdAt)),
      db
        .select()
        .from(bookingRedemptionEvents)
        .where(eq(bookingRedemptionEvents.bookingId, booking.id))
        .orderBy(asc(bookingRedemptionEvents.redeemedAt), asc(bookingRedemptionEvents.createdAt)),
      db
        .select()
        .from(bookingSupplierStatuses)
        .where(eq(bookingSupplierStatuses.bookingId, booking.id))
        .orderBy(asc(bookingSupplierStatuses.createdAt)),
      getBookingOriginByBookingId(db, booking.id),
    ])

  const itemParticipants =
    items.length > 0
      ? await db
          .select()
          .from(bookingItemTravelers)
          .where(
            inArray(
              bookingItemTravelers.bookingItemId,
              items.map((item) => item.id),
            ),
          )
          .orderBy(asc(bookingItemTravelers.createdAt))
      : []

  const activeAllocation =
    allocations.find((allocation) => allocation.status === "confirmed") ??
    allocations.find((allocation) => allocation.status === "held") ??
    allocations[0]

  const legacyOfferId = readLegacyOriginId(origin, "offerId")
  const legacyOrderId = readLegacyOriginId(origin, "orderId")
  const providerOrderRef = origin?.providerOrderRef ?? null

  return {
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    status: mapBookingStatus(booking.status),
    availabilityId: activeAllocation?.availabilitySlotId ?? null,
    contact: pickBookingContact({ booking, participants }),
    unitItems: items.map((item) => {
      const itemAllocation =
        allocations.find((allocation) => allocation.bookingItemId === item.id) ?? null
      return {
        bookingItemId: item.id,
        title: item.title,
        itemType: item.itemType,
        status: item.status,
        quantity: item.quantity,
        productId: item.productId,
        optionId: item.optionId,
        unitId: item.optionUnitId,
        pricingCategoryId: item.pricingCategoryId,
        availabilityId: itemAllocation?.availabilitySlotId ?? null,
        travelerIds: itemParticipants
          .filter((link) => link.bookingItemId === item.id)
          .map((link) => link.travelerId),
      }
    }),
    fulfillments: fulfillments.map((fulfillment) => ({
      id: fulfillment.id,
      bookingItemId: fulfillment.bookingItemId,
      travelerId: fulfillment.travelerId,
      type: fulfillment.fulfillmentType,
      deliveryChannel: fulfillment.deliveryChannel,
      status: fulfillment.status,
      artifactUrl: fulfillment.artifactUrl,
      payload: fulfillment.payload ?? null,
      issuedAt: toIsoString(fulfillment.issuedAt),
      revokedAt: toIsoString(fulfillment.revokedAt),
    })),
    artifacts: fulfillments.map(mapBookingArtifact),
    redemptions: redemptions.map((event) => ({
      id: event.id,
      bookingItemId: event.bookingItemId,
      travelerId: event.travelerId,
      redeemedAt: event.redeemedAt.toISOString(),
      redeemedBy: event.redeemedBy,
      location: event.location,
      method: event.method,
      metadata: event.metadata ?? null,
    })),
    references: {
      resellerReference: booking.externalBookingRef,
      offerId: legacyOfferId,
      offerNumber: null,
      orderId: providerOrderRef ?? legacyOrderId,
      orderNumber: null,
      supplierReferences: supplierStatuses.map((status) => ({
        id: status.id,
        supplierServiceId: status.supplierServiceId,
        serviceName: status.serviceName,
        status: status.status,
        supplierReference: status.supplierReference,
        confirmedAt: toIsoString(status.confirmedAt),
      })),
    },
    holdExpiresAt: toIsoString(booking.holdExpiresAt),
    confirmedAt: toIsoString(booking.confirmedAt),
    cancelledAt: toIsoString(booking.cancelledAt),
    expiredAt: toIsoString(booking.expiredAt),
    utcRedeemedAt: toIsoString(booking.redeemedAt),
    extensions: {
      sourceType: booking.sourceType,
      externalBookingRef: booking.externalBookingRef,
      communicationLanguage: booking.communicationLanguage,
      personId: booking.personId,
      organizationId: booking.organizationId,
      sellCurrency: booking.sellCurrency,
      baseCurrency: booking.baseCurrency,
      originSource: origin?.originSource ?? null,
      providerSourceRef: origin?.providerSourceRef ?? null,
      providerOrderRef,
    },
  }
}

export async function listProjectedBookings(db: PostgresJsDatabase, query: OctoBookingListQuery) {
  const result = await bookingsService.listBookings(db, {
    ...query,
    sortBy: "createdAt",
    sortDir: "desc",
  })
  const data = await Promise.all(
    result.data.map(async (booking) => getProjectedBookingById(db, booking.id)),
  )

  return {
    data: data.filter((row): row is NonNullable<typeof row> => Boolean(row)),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  }
}

async function projectBookingMutationResult(
  db: PostgresJsDatabase,
  result:
    | Awaited<ReturnType<typeof bookingsService.reserveBooking>>
    | Awaited<ReturnType<typeof bookingsService.confirmBooking>>
    | Awaited<ReturnType<typeof bookingsService.extendBookingHold>>
    | Awaited<ReturnType<typeof bookingsService.expireBooking>>
    | Awaited<ReturnType<typeof bookingsService.cancelBooking>>,
) {
  if (!("booking" in result) || !result.booking) {
    return result
  }

  const projected = await getProjectedBookingById(db, result.booking.id)
  return { status: "ok" as const, booking: projected }
}

export async function reserveProjectedBooking(
  db: PostgresJsDatabase,
  data: Parameters<typeof bookingsService.reserveBooking>[1],
  userId?: string,
) {
  return projectBookingMutationResult(db, await bookingsService.reserveBooking(db, data, userId))
}

export async function confirmProjectedBooking(
  db: PostgresJsDatabase,
  id: string,
  data: Parameters<typeof bookingsService.confirmBooking>[2],
  userId?: string,
) {
  return projectBookingMutationResult(
    db,
    await bookingsService.confirmBooking(db, id, data, userId),
  )
}

export async function extendProjectedBookingHold(
  db: PostgresJsDatabase,
  id: string,
  data: Parameters<typeof bookingsService.extendBookingHold>[2],
  userId?: string,
) {
  return projectBookingMutationResult(
    db,
    await bookingsService.extendBookingHold(db, id, data, userId),
  )
}

export async function expireProjectedBooking(
  db: PostgresJsDatabase,
  id: string,
  data: Parameters<typeof bookingsService.expireBooking>[2],
  userId?: string,
) {
  return projectBookingMutationResult(db, await bookingsService.expireBooking(db, id, data, userId))
}

export async function cancelProjectedBooking(
  db: PostgresJsDatabase,
  id: string,
  data: Parameters<typeof bookingsService.cancelBooking>[2],
  userId?: string,
) {
  return projectBookingMutationResult(db, await bookingsService.cancelBooking(db, id, data, userId))
}

export async function listProjectedRedemptions(db: PostgresJsDatabase, bookingId: string) {
  const events = await bookingsService.listRedemptionEvents(db, bookingId)
  return events.map((event) => ({
    id: event.id,
    bookingItemId: event.bookingItemId,
    travelerId: event.travelerId,
    redeemedAt: event.redeemedAt.toISOString(),
    redeemedBy: event.redeemedBy,
    location: event.location,
    method: event.method,
    metadata: event.metadata ?? null,
  }))
}

export async function recordProjectedRedemption(
  db: PostgresJsDatabase,
  bookingId: string,
  data: Parameters<typeof bookingsService.recordRedemption>[2],
  userId?: string,
) {
  const event = await bookingsService.recordRedemption(db, bookingId, data, userId)
  if (!event) {
    return null
  }

  const booking = await getProjectedBookingById(db, bookingId)
  return {
    event: {
      id: event.id,
      bookingItemId: event.bookingItemId,
      travelerId: event.travelerId,
      redeemedAt: event.redeemedAt.toISOString(),
      redeemedBy: event.redeemedBy,
      location: event.location,
      method: event.method,
      metadata: event.metadata ?? null,
    },
    booking,
  }
}
