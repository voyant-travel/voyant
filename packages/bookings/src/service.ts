import type { EventBus } from "@voyantjs/core"
import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, ne, or, sql } from "drizzle-orm"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type { z } from "zod"

import { availabilitySlotsRef } from "./availability-ref.js"
import { exchangeRatesRef } from "./markets-ref.js"
import {
  applyTravelDetailSnapshot,
  type BookingPiiService,
  type BookingTravelerSnapshot,
  type UpsertBookingTravelerTravelDetailInput,
} from "./pii.js"
import {
  bookingItemProductDetailsRef,
  bookingProductDetailsRef,
  optionUnitsRef,
  productDayServicesRef,
  productDaysRef,
  productItinerariesRef,
  productOptionsRef,
  productsRef,
  productTicketSettingsRef,
  suppliersRef,
} from "./products-ref.js"
import {
  bookingActivityLog,
  bookingAllocations,
  bookingDocuments,
  bookingFulfillments,
  bookingItems,
  bookingItemTravelers,
  bookingNotes,
  bookingRedemptionEvents,
  bookingStaffAssignments,
  bookingSupplierStatuses,
  bookings,
  bookingTravelers,
} from "./schema.js"
import { cleanupGroupOnBookingCancelled } from "./service-groups.js"
import { type BookingStatus, canTransitionBooking, transitionBooking } from "./state-machine.js"
import {
  bookingTransactionDetailsRef,
  offerItemParticipantsRef,
  offerItemsRef,
  offerParticipantsRef,
  offerStaffAssignmentsRef,
  offersRef,
  orderItemParticipantsRef,
  orderItemsRef,
  orderParticipantsRef,
  orderStaffAssignmentsRef,
  ordersRef,
} from "./transactions-ref.js"
import type {
  bookingListQuerySchema,
  cancelBookingSchema,
  completeBookingSchema,
  confirmBookingSchema,
  convertProductSchema,
  createTravelerWithTravelDetailsSchema,
  expireBookingSchema,
  expireStaleBookingsSchema,
  extendBookingHoldSchema,
  insertBookingDocumentSchema,
  insertBookingFulfillmentSchema,
  insertBookingItemParticipantSchema,
  insertBookingItemSchema,
  insertBookingNoteSchema,
  insertBookingSchema,
  insertTravelerRecordSchema,
  insertTravelerSchema,
  overrideBookingStatusSchema,
  recordBookingRedemptionSchema,
  reserveBookingFromTransactionSchema,
  reserveBookingSchema,
  startBookingSchema,
  updateBookingFulfillmentSchema,
  updateBookingItemSchema,
  updateBookingSchema,
  updateTravelerRecordSchema,
  updateTravelerSchema,
  updateTravelerWithTravelDetailsSchema,
} from "./validation.js"

type BookingListQuery = z.infer<typeof bookingListQuerySchema>
type ConvertProductInput = z.infer<typeof convertProductSchema>
type CreateBookingInput = z.infer<typeof insertBookingSchema>
type UpdateBookingInput = z.infer<typeof updateBookingSchema>
type ReserveBookingInput = z.infer<typeof reserveBookingSchema>
type ExtendBookingHoldInput = z.infer<typeof extendBookingHoldSchema>
type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>
type CancelBookingInput = z.infer<typeof cancelBookingSchema>
type ExpireBookingInput = z.infer<typeof expireBookingSchema>
type ExpireStaleBookingsInput = z.infer<typeof expireStaleBookingsSchema>
type StartBookingInput = z.infer<typeof startBookingSchema>
type CompleteBookingInput = z.infer<typeof completeBookingSchema>
type OverrideBookingStatusInput = z.infer<typeof overrideBookingStatusSchema>
type CreateTravelerInput = z.infer<typeof insertTravelerSchema>
type UpdateTravelerInput = z.infer<typeof updateTravelerSchema>
type CreateTravelerRecordInput = z.infer<typeof insertTravelerRecordSchema>
type UpdateTravelerRecordInput = z.infer<typeof updateTravelerRecordSchema>
export type CreateTravelerWithTravelDetailsInput = z.infer<
  typeof createTravelerWithTravelDetailsSchema
>
export type UpdateTravelerWithTravelDetailsInput = z.infer<
  typeof updateTravelerWithTravelDetailsSchema
>

function pickTravelDetailFields(
  data: CreateTravelerWithTravelDetailsInput | UpdateTravelerWithTravelDetailsInput,
): UpsertBookingTravelerTravelDetailInput {
  return {
    nationality: data.nationality,
    passportNumber: data.passportNumber,
    passportExpiry: data.passportExpiry,
    passportIssuingCountry: data.passportIssuingCountry,
    passportIssuingAuthority: data.passportIssuingAuthority,
    passportPersonDocumentId: data.passportPersonDocumentId,
    dateOfBirth: data.dateOfBirth,
    dietaryRequirements: data.dietaryRequirements,
    accessibilityNeeds: data.accessibilityNeeds,
    isLeadTraveler: data.isLeadTraveler,
  }
}
type CreateBookingItemInput = z.infer<typeof insertBookingItemSchema>
type UpdateBookingItemInput = z.infer<typeof updateBookingItemSchema>
type CreateBookingItemParticipantInput = z.infer<typeof insertBookingItemParticipantSchema>
type CreateBookingNoteInput = z.infer<typeof insertBookingNoteSchema>
type CreateBookingDocumentInput = z.infer<typeof insertBookingDocumentSchema>
type CreateBookingFulfillmentInput = z.infer<typeof insertBookingFulfillmentSchema>
type UpdateBookingFulfillmentInput = z.infer<typeof updateBookingFulfillmentSchema>
type RecordBookingRedemptionInput = z.infer<typeof recordBookingRedemptionSchema>
type ReserveBookingFromTransactionInput = z.infer<typeof reserveBookingFromTransactionSchema>

/** Product data needed for convertProductToBooking — supplied by the caller (template). */
export interface ConvertProductData {
  product: {
    id: string
    name: string
    description: string | null
    sellCurrency: string
    sellAmountCents: number | null
    costAmountCents: number | null
    marginPercent: number | null
    startDate: string | null
    endDate: string | null
    pax: number | null
  }
  option: { id: string; name: string } | null
  /**
   * Availability slot the caller chose, if any. When set, the resulting booking
   * pins its startDate/endDate to the slot so recurring/scheduled products don't
   * land with null dates.
   */
  slot?: {
    id: string
    dateLocal: string
    startsAt: Date
    endsAt: Date | null
    timezone: string
  } | null
  dayServices: Array<{
    supplierServiceId: string | null
    name: string
    costCurrency: string
    costAmountCents: number
  }>
  units: Array<{
    id: string
    name: string
    description: string | null
    unitType: string | null
    isRequired: boolean
    minQuantity: number | null
    sortOrder: number
  }>
}

type ProductOptionReference = typeof productOptionsRef.$inferSelect
type OptionUnitReference = typeof optionUnitsRef.$inferSelect

/**
 * Optional runtime hooks for status-transition flows. Keeps the service
 * decoupled from delivery concerns — bookings only has to emit, never know
 * what listens.
 */
export interface BookingServiceRuntime {
  eventBus?: EventBus
  expirePaymentSessionsForBooking?: (
    db: PostgresJsDatabase,
    bookingId: string,
  ) => Promise<void> | void
}

/**
 * Payload shape for `availability.slot.changed`. Mirrors the canonical
 * `AvailabilitySlotChangedEvent` from `@voyantjs/availability` — defined
 * locally to avoid a runtime dep on availability (we already mirror its
 * schema via `availabilitySlotsRef` for the same reason). Subscribers
 * (e.g. channel-push) can import the canonical type directly.
 *
 * Per docs/architecture/channel-push-architecture.md §5.1.
 */
export interface AvailabilitySlotChangedEventPayload {
  slotId: string
  productId: string
  optionId: string | null
  startsAt: Date | string
  remainingPax: number | null
  unlimited: boolean
  source: "booking" | "cancel" | "expire" | "modify" | "manual" | "refresh"
}

/** Stable string identifier for the event. */
export const AVAILABILITY_SLOT_CHANGED_EVENT = "availability.slot.changed" as const

/**
 * Emit a batch of slot-change events through the runtime's EventBus.
 * No-op when no event bus is wired (the common test path). Each emit is
 * fire-and-forget per the EventBus contract — subscriber errors are
 * logged, not rethrown — but we await to keep ordering deterministic in
 * tests that drain the bus before assertions.
 */
async function emitSlotChanges(
  runtime: BookingServiceRuntime,
  changes: ReadonlyArray<AvailabilitySlotChangedEventPayload>,
): Promise<void> {
  const eventBus = runtime.eventBus
  if (!eventBus || changes.length === 0) return
  for (const change of changes) {
    await eventBus.emit(AVAILABILITY_SLOT_CHANGED_EVENT, change, {
      category: "domain",
      source: "service",
    })
  }
}

/**
 * Payload shape for `booking.confirmed`. Subscribers should treat unknown
 * fields as forward-compatible additions.
 */
export interface BookingConfirmedEvent {
  bookingId: string
  bookingNumber: string
  actorId: string | null
}

/**
 * Payload for `booking.cancelled`. `previousStatus` is the state the booking
 * transitioned *out of* — useful for subscribers that care about cancelling a
 * confirmed booking (refund flow) vs cancelling a draft/hold (no side effects).
 */
export interface BookingCancelledEvent {
  bookingId: string
  bookingNumber: string
  previousStatus: "draft" | "on_hold" | "confirmed" | "in_progress"
  actorId: string | null
}

/**
 * Payload for `booking.expired`. Fires when an on-hold booking's timer runs
 * out. `cause` flags whether it was the explicit route call or the sweep job —
 * subscribers that want to email the customer should probably skip
 * sweep-originated events to avoid pager noise during backfills.
 */
export interface BookingExpiredEvent {
  bookingId: string
  bookingNumber: string
  cause: "route" | "sweep"
  actorId: string | null
}

/** Payload for `booking.started` — confirmed → in_progress. */
export interface BookingStartedEvent {
  bookingId: string
  bookingNumber: string
  actorId: string | null
}

/** Payload for `booking.completed` — in_progress → completed. */
export interface BookingCompletedEvent {
  bookingId: string
  bookingNumber: string
  actorId: string | null
}

/**
 * Payload for `booking.status_overridden`. Fires when an admin bypasses the
 * transition graph. Subscribers should treat this as a privileged audit signal
 * distinct from the normal lifecycle events — e.g. compliance dashboards.
 */
export interface BookingStatusOverriddenEvent {
  bookingId: string
  bookingNumber: string
  fromStatus: BookingStatus
  toStatus: BookingStatus
  reason: string
  actorId: string | null
}

const travelerParticipantTypes = ["traveler", "occupant"] as const

class BookingServiceError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code)
    this.name = "BookingServiceError"
  }
}

function toTimestamp(value?: string | null) {
  return value ? new Date(value) : null
}

function toDateValue(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}

function toDateValueOrNull(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function toTravelerResponse(participant: typeof bookingTravelers.$inferSelect) {
  return {
    id: participant.id,
    bookingId: participant.bookingId,
    participantType: participant.participantType,
    travelerCategory: participant.travelerCategory,
    firstName: participant.firstName,
    lastName: participant.lastName,
    email: participant.email,
    phone: participant.phone,
    preferredLanguage: participant.preferredLanguage,
    specialRequests: participant.specialRequests,
    isPrimary: participant.isPrimary,
    notes: participant.notes,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
  }
}

async function ensureParticipantFlags(
  db: PostgresJsDatabase,
  bookingId: string,
  travelerId: string,
  data: { isPrimary?: boolean | null },
) {
  if (data.isPrimary) {
    await db
      .update(bookingTravelers)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(bookingTravelers.bookingId, bookingId), ne(bookingTravelers.id, travelerId)))
  }
}

async function ensureBookingScopedLinks(
  db: PostgresJsDatabase,
  bookingId: string,
  data: { bookingItemId?: string | null; travelerId?: string | null },
) {
  if (data.bookingItemId) {
    const [item] = await db
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .where(and(eq(bookingItems.id, data.bookingItemId), eq(bookingItems.bookingId, bookingId)))
      .limit(1)

    if (!item) {
      return { ok: false as const, reason: "booking_item_not_found" as const }
    }
  }

  if (data.travelerId) {
    const [traveler] = await db
      .select({ id: bookingTravelers.id })
      .from(bookingTravelers)
      .where(
        and(eq(bookingTravelers.id, data.travelerId), eq(bookingTravelers.bookingId, bookingId)),
      )
      .limit(1)

    if (!traveler) {
      return { ok: false as const, reason: "traveler_not_found" as const }
    }
  }

  return { ok: true as const }
}

type TransactionParticipantRecord = {
  id: string
  personId: string | null
  participantType: string
  travelerCategory: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  preferredLanguage: string | null
  isPrimary: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

function isStaffParticipantType(participantType: string) {
  return participantType === "staff"
}

function toStaffAssignmentRole(role: string | null | undefined) {
  return role === "service_assignee" ? "service_assignee" : "other"
}

type TransactionItemRecord = {
  id: string
  productId: string | null
  optionId: string | null
  unitId: string | null
  slotId: string | null
  title: string
  description: string | null
  itemType: string
  status: string
  serviceDate: string | null
  startsAt: Date | null
  endsAt: Date | null
  quantity: number
  sellCurrency: string
  unitSellAmountCents: number | null
  totalSellAmountCents: number | null
  costCurrency: string | null
  unitCostAmountCents: number | null
  totalCostAmountCents: number | null
  notes: string | null
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

type TransactionItemParticipantRecord = {
  travelerId: string
  role: string
  isPrimary: boolean
  offerItemId?: string
  orderItemId?: string
}

type ReservationSourceBundle = {
  kind: "offer" | "order"
  sourceId: string
  offerId: string | null
  orderId: string | null
  personId: string | null
  organizationId: string | null
  contactFirstName: string | null
  contactLastName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactPreferredLanguage: string | null
  contactCountry: string | null
  contactRegion: string | null
  contactCity: string | null
  contactAddressLine1: string | null
  contactPostalCode: string | null
  currency: string
  baseCurrency: string | null
  totalAmountCents: number | null
  costAmountCents: number | null
  notes: string | null
  participants: TransactionParticipantRecord[]
  items: TransactionItemRecord[]
  itemParticipants: TransactionItemParticipantRecord[]
}

function deriveBookingDateRange(items: TransactionItemRecord[]) {
  const dates = items
    .flatMap((item) => [item.serviceDate, item.startsAt?.toISOString().slice(0, 10) ?? null])
    .filter((value): value is string => Boolean(value))
    .sort()

  return {
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
  }
}

function deriveBookingPax(
  participants: TransactionParticipantRecord[],
  items: TransactionItemRecord[],
) {
  const pax = participants.filter((participant) =>
    ["traveler", "occupant"].includes(participant.participantType),
  ).length

  if (pax > 0) {
    return pax
  }

  return items
    .filter((item) => item.itemType === "unit")
    .reduce((sum, item) => sum + item.quantity, 0)
}

function getTransactionItemParticipantItemId(link: TransactionItemParticipantRecord) {
  return "offerItemId" in link ? link.offerItemId : link.orderItemId
}

function toStaffReservationParticipant(
  assignment: {
    id: string
    personId: string | null
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    preferredLanguage: string | null
    isPrimary: boolean
    notes: string | null
  },
  suffix: string,
): TransactionParticipantRecord {
  return {
    id: `staff:${suffix}:${assignment.id}`,
    personId: assignment.personId,
    participantType: "staff",
    travelerCategory: null,
    firstName: assignment.firstName,
    lastName: assignment.lastName,
    email: assignment.email,
    phone: assignment.phone,
    preferredLanguage: assignment.preferredLanguage,
    isPrimary: assignment.isPrimary,
    notes: assignment.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function mapDeliveryFormatToFulfillment(format: string) {
  switch (format) {
    case "pdf":
      return { fulfillmentType: "pdf" as const, deliveryChannel: "download" as const }
    case "qr_code":
      return { fulfillmentType: "qr_code" as const, deliveryChannel: "download" as const }
    case "barcode":
      return { fulfillmentType: "barcode" as const, deliveryChannel: "download" as const }
    case "mobile":
      return { fulfillmentType: "mobile" as const, deliveryChannel: "wallet" as const }
    case "email":
      return { fulfillmentType: "voucher" as const, deliveryChannel: "email" as const }
    case "ticket":
      return { fulfillmentType: "ticket" as const, deliveryChannel: "download" as const }
    default:
      return { fulfillmentType: "voucher" as const, deliveryChannel: "download" as const }
  }
}

async function getConvertProductData(
  db: PostgresJsDatabase,
  data: ConvertProductInput,
): Promise<ConvertProductData | null> {
  const [product] = await db
    .select()
    .from(productsRef)
    .where(eq(productsRef.id, data.productId))
    .limit(1)

  if (!product) {
    return null
  }

  let option: ProductOptionReference | null = null
  if (data.optionId) {
    const [selectedOption] = await db
      .select()
      .from(productOptionsRef)
      .where(
        and(eq(productOptionsRef.id, data.optionId), eq(productOptionsRef.productId, product.id)),
      )
      .limit(1)

    if (!selectedOption) {
      return null
    }

    option = selectedOption
  } else {
    const [defaultOption] = await db
      .select()
      .from(productOptionsRef)
      .where(eq(productOptionsRef.productId, product.id))
      .orderBy(
        desc(productOptionsRef.isDefault),
        asc(productOptionsRef.sortOrder),
        asc(productOptionsRef.createdAt),
      )
      .limit(1)

    option = defaultOption ?? null
  }

  // product_days is keyed by itinerary_id (products re-parented days onto
  // product_itineraries); getConvertProductData joins through the itinerary
  // ref so the per-product day lookup still works for converts that want to
  // seed booking supplier statuses from the product's day services.
  const days = await db
    .select({ id: productDaysRef.id, dayNumber: productDaysRef.dayNumber })
    .from(productDaysRef)
    .innerJoin(productItinerariesRef, eq(productDaysRef.itineraryId, productItinerariesRef.id))
    .where(eq(productItinerariesRef.productId, product.id))
    .orderBy(asc(productDaysRef.dayNumber))

  const dayServices = days.length
    ? await db
        .select({
          supplierServiceId: productDayServicesRef.supplierServiceId,
          name: productDayServicesRef.name,
          costCurrency: productDayServicesRef.costCurrency,
          costAmountCents: productDayServicesRef.costAmountCents,
        })
        .from(productDayServicesRef)
        .where(
          sql`${productDayServicesRef.dayId} IN (
            SELECT ${productDaysRef.id}
            FROM ${productDaysRef}
            INNER JOIN ${productItinerariesRef}
              ON ${productDaysRef.itineraryId} = ${productItinerariesRef.id}
            WHERE ${productItinerariesRef.productId} = ${product.id}
          )`,
        )
        .orderBy(asc(productDayServicesRef.sortOrder), asc(productDayServicesRef.id))
    : []

  const units: OptionUnitReference[] =
    option === null
      ? []
      : await db
          .select()
          .from(optionUnitsRef)
          .where(eq(optionUnitsRef.optionId, option.id))
          .orderBy(asc(optionUnitsRef.sortOrder), asc(optionUnitsRef.createdAt))

  let slot: ConvertProductData["slot"] = null
  if (data.slotId) {
    const [selectedSlot] = await db
      .select()
      .from(availabilitySlotsRef)
      .where(
        and(
          eq(availabilitySlotsRef.id, data.slotId),
          eq(availabilitySlotsRef.productId, product.id),
        ),
      )
      .limit(1)

    if (!selectedSlot) {
      return null
    }

    if (option && selectedSlot.optionId && selectedSlot.optionId !== option.id) {
      return null
    }

    slot = {
      id: selectedSlot.id,
      dateLocal: selectedSlot.dateLocal,
      startsAt: selectedSlot.startsAt,
      endsAt: selectedSlot.endsAt,
      timezone: selectedSlot.timezone,
    }
  }

  return {
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      sellCurrency: product.sellCurrency,
      sellAmountCents: product.sellAmountCents,
      costAmountCents: product.costAmountCents,
      marginPercent: product.marginPercent,
      startDate: product.startDate,
      endDate: product.endDate,
      pax: product.pax,
    },
    option: option ? { id: option.id, name: option.name } : null,
    slot,
    dayServices,
    units: units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      description: unit.description,
      unitType: unit.unitType,
      isRequired: unit.isRequired,
      minQuantity: unit.minQuantity,
      sortOrder: unit.sortOrder,
    })),
  }
}

const DEFAULT_HOLD_MINUTES = 30

function positiveHoldMinutes(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null
}

function isUndefinedTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  )
}

async function resolvePolicyHoldMinutes(
  db: PostgresJsDatabase,
  items: ReadonlyArray<{
    productId?: string | null
    availabilitySlotId?: string | null
    slotId?: string | null
  }>,
) {
  const productIds = new Set<string>()
  const slotIds = new Set<string>()

  for (const item of items) {
    if (item.productId) productIds.add(item.productId)
    const slotId = item.availabilitySlotId ?? item.slotId
    if (slotId) slotIds.add(slotId)
  }

  if (slotIds.size > 0) {
    const slotRows = await db
      .select({ productId: availabilitySlotsRef.productId })
      .from(availabilitySlotsRef)
      .where(inArray(availabilitySlotsRef.id, [...slotIds]))

    for (const slot of slotRows) {
      if (slot.productId) productIds.add(slot.productId)
    }
  }

  if (productIds.size === 0) {
    return DEFAULT_HOLD_MINUTES
  }

  const productRows = await db
    .select({
      id: productsRef.id,
      supplierId: productsRef.supplierId,
      reservationTimeoutMinutes: productsRef.reservationTimeoutMinutes,
    })
    .from(productsRef)
    .where(inArray(productsRef.id, [...productIds]))
    .catch((error: unknown) => {
      if (isUndefinedTableError(error)) return []
      throw error
    })

  const supplierIds = [
    ...new Set(productRows.map((product) => product.supplierId).filter(Boolean) as string[]),
  ]
  const supplierRows =
    supplierIds.length > 0
      ? await db
          .select({
            id: suppliersRef.id,
            reservationTimeoutMinutes: suppliersRef.reservationTimeoutMinutes,
          })
          .from(suppliersRef)
          .where(inArray(suppliersRef.id, supplierIds))
          .catch((error: unknown) => {
            if (isUndefinedTableError(error)) return []
            throw error
          })
      : []

  const supplierTimeouts = new Map(
    supplierRows.map((supplier) => [
      supplier.id,
      positiveHoldMinutes(supplier.reservationTimeoutMinutes),
    ]),
  )
  const candidates: number[] = []

  for (const product of productRows) {
    const productMinutes = positiveHoldMinutes(product.reservationTimeoutMinutes)
    if (productMinutes !== null) {
      candidates.push(productMinutes)
      continue
    }

    const supplierMinutes = product.supplierId ? supplierTimeouts.get(product.supplierId) : null
    if (supplierMinutes !== null && supplierMinutes !== undefined) {
      candidates.push(supplierMinutes)
    }
  }

  return candidates.length > 0 ? Math.min(...candidates) : DEFAULT_HOLD_MINUTES
}

async function listBookingItemsForSummaries(db: PostgresJsDatabase, bookingIds: string[]) {
  if (bookingIds.length === 0) return []

  return db
    .select({
      id: bookingItems.id,
      bookingId: bookingItems.bookingId,
      title: bookingItems.title,
      itemType: bookingItems.itemType,
      productId: bookingItems.productId,
      productName: productsRef.name,
      startsAt: bookingItems.startsAt,
      endsAt: bookingItems.endsAt,
    })
    .from(bookingItems)
    .leftJoin(productsRef, eq(productsRef.id, bookingItems.productId))
    .where(inArray(bookingItems.bookingId, bookingIds))
    .orderBy(asc(bookingItems.createdAt))
    .catch(async (error: unknown) => {
      if (!isUndefinedTableError(error)) throw error

      return db
        .select({
          id: bookingItems.id,
          bookingId: bookingItems.bookingId,
          title: bookingItems.title,
          itemType: bookingItems.itemType,
          productId: bookingItems.productId,
          productName: sql<null>`null`,
          startsAt: bookingItems.startsAt,
          endsAt: bookingItems.endsAt,
        })
        .from(bookingItems)
        .where(inArray(bookingItems.bookingId, bookingIds))
        .orderBy(asc(bookingItems.createdAt))
    })
}

async function computeHoldExpiresAt(
  db: PostgresJsDatabase,
  input: { holdMinutes?: number; holdExpiresAt?: string | null },
  items: ReadonlyArray<{
    productId?: string | null
    availabilitySlotId?: string | null
    slotId?: string | null
  }> = [],
) {
  if (input.holdExpiresAt) {
    return new Date(input.holdExpiresAt)
  }
  const minutes = input.holdMinutes ?? (await resolvePolicyHoldMinutes(db, items))
  return new Date(Date.now() + minutes * 60 * 1000)
}

/**
 * Walk a booking's items, convert each line into the booking's
 * `baseCurrency` via the booking's `fxRateSetId`, sum.
 *
 * Returns:
 * - `{ status: "ok", baseSellAmountCents, baseCostAmountCents }` when
 *   every item's currency was either already in `baseCurrency` or had
 *   a rate row in the rate set
 * - `{ status: "missing_rate", currency }` when an item's
 *   `sellCurrency` had no rate in the rate set; caller treats as
 *   "leave base totals untouched, surface to ops"
 * - `{ status: "skipped" }` when the booking has no `fxRateSetId`
 *   (multi-currency conversion isn't possible without one)
 *
 * Pure conversion math. Caller controls persistence.
 */
async function rollupBaseTotals(
  db: PostgresJsDatabase,
  bookingId: string,
  baseCurrency: string,
): Promise<
  | { status: "ok"; baseSellAmountCents: number; baseCostAmountCents: number }
  | { status: "missing_rate"; currency: string }
  | { status: "skipped" }
> {
  const [booking] = await db
    .select({ fxRateSetId: bookings.fxRateSetId })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)
  if (!booking?.fxRateSetId) {
    return { status: "skipped" }
  }
  // Cache for the closure — TypeScript can't narrow `booking` after
  // the closure boundary, so capture the id in a local.
  const fxRateSetId = booking.fxRateSetId

  const items = await db
    .select({
      sellCurrency: bookingItems.sellCurrency,
      totalSellAmountCents: bookingItems.totalSellAmountCents,
      costCurrency: bookingItems.costCurrency,
      totalCostAmountCents: bookingItems.totalCostAmountCents,
    })
    .from(bookingItems)
    .where(eq(bookingItems.bookingId, bookingId))

  // Cache rates we look up to avoid N+1 within one booking.
  const rateCache = new Map<string, number | null>() // key: `${from}->${to}`, value: decimal rate or null

  async function rate(from: string, to: string): Promise<number | null> {
    if (from === to) return 1
    const key = `${from}->${to}`
    if (rateCache.has(key)) return rateCache.get(key) ?? null
    const [direct] = await db
      .select({ rate: exchangeRatesRef.rateDecimal })
      .from(exchangeRatesRef)
      .where(
        and(
          eq(exchangeRatesRef.fxRateSetId, fxRateSetId),
          eq(exchangeRatesRef.baseCurrency, from),
          eq(exchangeRatesRef.quoteCurrency, to),
        ),
      )
      .limit(1)
    if (direct) {
      const value = Number.parseFloat(direct.rate)
      rateCache.set(key, value)
      return value
    }
    // Try the inverse
    const [inverse] = await db
      .select({ rate: exchangeRatesRef.inverseRateDecimal })
      .from(exchangeRatesRef)
      .where(
        and(
          eq(exchangeRatesRef.fxRateSetId, fxRateSetId),
          eq(exchangeRatesRef.baseCurrency, to),
          eq(exchangeRatesRef.quoteCurrency, from),
        ),
      )
      .limit(1)
    if (inverse?.rate) {
      const value = Number.parseFloat(inverse.rate)
      rateCache.set(key, value)
      return value
    }
    rateCache.set(key, null)
    return null
  }

  let baseSellAmountCents = 0
  let baseCostAmountCents = 0

  for (const item of items) {
    if (item.totalSellAmountCents !== null) {
      const r = await rate(item.sellCurrency, baseCurrency)
      if (r === null) {
        return { status: "missing_rate", currency: item.sellCurrency }
      }
      baseSellAmountCents += Math.round(item.totalSellAmountCents * r)
    }
    if (item.totalCostAmountCents !== null && item.costCurrency) {
      const r = await rate(item.costCurrency, baseCurrency)
      if (r === null) {
        return { status: "missing_rate", currency: item.costCurrency }
      }
      baseCostAmountCents += Math.round(item.totalCostAmountCents * r)
    }
  }

  return { status: "ok", baseSellAmountCents, baseCostAmountCents }
}

async function lockAvailabilitySlot(db: PostgresJsDatabase, slotId: string) {
  const rows = await db.execute(
    sql`SELECT id, product_id, option_id, date_local, starts_at, ends_at, timezone, status, unlimited, remaining_pax
        FROM ${availabilitySlotsRef}
        WHERE ${availabilitySlotsRef.id} = ${slotId}
        FOR UPDATE`,
  )

  const row = (
    rows as unknown as Array<{
      id: string
      product_id: string
      option_id: string | null
      date_local: string
      starts_at: Date
      ends_at: Date | null
      timezone: string
      status: string
      unlimited: boolean
      remaining_pax: number | null
    }>
  )[0]

  if (!row) {
    return null
  }

  return {
    ...row,
    starts_at: toDateValue(row.starts_at),
    ends_at: toDateValueOrNull(row.ends_at),
  }
}

type SlotChangeSource = AvailabilitySlotChangedEventPayload["source"]

function buildSlotChange(
  slot: {
    id: string
    product_id: string
    option_id: string | null
    starts_at: Date | string
    unlimited: boolean
  },
  remainingPax: number | null,
  source: SlotChangeSource,
): AvailabilitySlotChangedEventPayload {
  return {
    slotId: slot.id,
    productId: slot.product_id,
    optionId: slot.option_id,
    startsAt: slot.starts_at,
    remainingPax: slot.unlimited ? null : remainingPax,
    unlimited: slot.unlimited,
    source,
  }
}

async function adjustSlotCapacity(
  db: PostgresJsDatabase,
  slotId: string,
  delta: number,
  source: SlotChangeSource = "booking",
) {
  const locked = await lockAvailabilitySlot(db, slotId)
  if (!locked) {
    return { status: "slot_not_found" as const }
  }

  if (locked.status !== "open" && locked.status !== "sold_out") {
    return { status: "slot_unavailable" as const, slot: locked }
  }

  if (locked.unlimited) {
    return {
      status: "ok" as const,
      slot: locked,
      remainingPax: locked.remaining_pax,
      slotChange: buildSlotChange(locked, locked.remaining_pax, source),
    }
  }

  const currentRemaining = locked.remaining_pax ?? 0
  const nextRemaining = currentRemaining + delta

  if (nextRemaining < 0) {
    return {
      status: "insufficient_capacity" as const,
      slot: locked,
      remainingPax: currentRemaining,
    }
  }

  let nextStatus = locked.status as "open" | "closed" | "sold_out" | "cancelled"
  if (nextRemaining === 0 && locked.status === "open") {
    nextStatus = "sold_out"
  } else if (nextRemaining > 0 && locked.status === "sold_out") {
    nextStatus = "open"
  }

  await db
    .update(availabilitySlotsRef)
    .set({
      remainingPax: nextRemaining,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(availabilitySlotsRef.id, slotId))

  return {
    status: "ok" as const,
    slot: locked,
    remainingPax: nextRemaining,
    slotChange: buildSlotChange(locked, nextRemaining, source),
  }
}

async function releaseAllocationCapacity(
  db: PostgresJsDatabase,
  allocation: Pick<
    typeof bookingAllocations.$inferSelect,
    "availabilitySlotId" | "quantity" | "status" | "id"
  >,
  source: SlotChangeSource = "cancel",
): Promise<AvailabilitySlotChangedEventPayload | undefined> {
  if (!allocation.availabilitySlotId) {
    return undefined
  }

  if (allocation.status !== "held" && allocation.status !== "confirmed") {
    return undefined
  }

  const result = await adjustSlotCapacity(
    db,
    allocation.availabilitySlotId,
    allocation.quantity,
    source,
  )
  return result.status === "ok" ? result.slotChange : undefined
}

async function reserveBookingFromTransactionSource(
  db: PostgresJsDatabase,
  source: ReservationSourceBundle,
  data: ReserveBookingFromTransactionInput,
  userId?: string,
  runtime: BookingServiceRuntime = {},
) {
  const slotChanges: AvailabilitySlotChangedEventPayload[] = []
  try {
    const result = await db.transaction(async (tx) => {
      const holdExpiresAt = await computeHoldExpiresAt(tx as PostgresJsDatabase, data, source.items)
      const dateRange = deriveBookingDateRange(source.items)
      const pax = deriveBookingPax(source.participants, source.items)

      const [booking] = await tx
        .insert(bookings)
        .values({
          bookingNumber: data.bookingNumber,
          status: "on_hold",
          personId: source.personId,
          organizationId: source.organizationId,
          sourceType: data.sourceType,
          contactFirstName: data.contactFirstName ?? source.contactFirstName,
          contactLastName: data.contactLastName ?? source.contactLastName,
          contactEmail: data.contactEmail ?? source.contactEmail,
          contactPhone: data.contactPhone ?? source.contactPhone,
          contactPreferredLanguage:
            data.contactPreferredLanguage ?? source.contactPreferredLanguage,
          contactCountry: data.contactCountry ?? source.contactCountry,
          contactRegion: data.contactRegion ?? source.contactRegion,
          contactCity: data.contactCity ?? source.contactCity,
          contactAddressLine1: data.contactAddressLine1 ?? source.contactAddressLine1,
          contactPostalCode: data.contactPostalCode ?? source.contactPostalCode,
          sellCurrency: source.currency,
          baseCurrency: source.baseCurrency,
          sellAmountCents: source.totalAmountCents,
          costAmountCents: source.costAmountCents,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          pax: pax > 0 ? pax : null,
          internalNotes: data.internalNotes ?? source.notes,
          holdExpiresAt,
        })
        .returning()

      if (!booking) {
        throw new BookingServiceError("booking_create_failed")
      }

      const participantMap = new Map<string, string>()
      const staffParticipantMap = new Map<string, TransactionParticipantRecord>()
      if (data.includeParticipants) {
        for (const participant of source.participants) {
          if (isStaffParticipantType(participant.participantType)) {
            staffParticipantMap.set(participant.id, participant)
            continue
          }

          const [createdParticipant] = await tx
            .insert(bookingTravelers)
            .values({
              bookingId: booking.id,
              personId: participant.personId ?? null,
              participantType:
                participant.participantType as CreateTravelerRecordInput["participantType"],
              travelerCategory:
                (participant.travelerCategory as CreateTravelerRecordInput["travelerCategory"]) ??
                null,
              firstName: participant.firstName,
              lastName: participant.lastName,
              email: participant.email ?? null,
              phone: participant.phone ?? null,
              preferredLanguage: participant.preferredLanguage ?? null,
              isPrimary: participant.isPrimary,
              notes: participant.notes ?? null,
            })
            .returning()

          if (!createdParticipant) {
            throw new BookingServiceError("participant_create_failed")
          }

          participantMap.set(participant.id, createdParticipant.id)
        }
      }

      const bookingItemMap = new Map<string, string>()
      for (const item of source.items) {
        if (item.slotId) {
          const capacity = await adjustSlotCapacity(
            tx as PostgresJsDatabase,
            item.slotId,
            -item.quantity,
            "booking",
          )

          if (capacity.status === "slot_not_found") {
            throw new BookingServiceError("slot_not_found")
          }
          if (capacity.status === "slot_unavailable") {
            throw new BookingServiceError("slot_unavailable")
          }
          if (capacity.status === "insufficient_capacity") {
            throw new BookingServiceError("insufficient_capacity")
          }

          const slot = capacity.slot
          if (item.productId && item.productId !== slot.product_id) {
            throw new BookingServiceError("slot_product_mismatch")
          }
          if (item.optionId && item.optionId !== slot.option_id) {
            throw new BookingServiceError("slot_option_mismatch")
          }
          if (capacity.slotChange) slotChanges.push(capacity.slotChange)
        }

        const [bookingItem] = await tx
          .insert(bookingItems)
          .values({
            bookingId: booking.id,
            title: item.title,
            description: item.description ?? null,
            itemType: item.itemType as CreateBookingItemInput["itemType"],
            status: "on_hold",
            serviceDate: item.serviceDate ?? (item.slotId ? undefined : null),
            startsAt: item.startsAt ?? null,
            endsAt: item.endsAt ?? null,
            quantity: item.quantity,
            sellCurrency: item.sellCurrency,
            unitSellAmountCents: item.unitSellAmountCents ?? null,
            totalSellAmountCents: item.totalSellAmountCents ?? null,
            costCurrency: item.costCurrency ?? null,
            unitCostAmountCents: item.unitCostAmountCents ?? null,
            totalCostAmountCents: item.totalCostAmountCents ?? null,
            notes: item.notes ?? null,
            productId: item.productId ?? null,
            optionId: item.optionId ?? null,
            optionUnitId: item.unitId ?? null,
            sourceOfferId: source.offerId,
            metadata: (item.metadata as Record<string, unknown> | null | undefined) ?? null,
          })
          .returning()

        if (!bookingItem) {
          throw new BookingServiceError("booking_item_create_failed")
        }

        bookingItemMap.set(item.id, bookingItem.id)

        if (item.slotId) {
          const [allocation] = await tx
            .insert(bookingAllocations)
            .values({
              bookingId: booking.id,
              bookingItemId: bookingItem.id,
              productId: item.productId ?? null,
              optionId: item.optionId ?? null,
              optionUnitId: item.unitId ?? null,
              availabilitySlotId: item.slotId,
              quantity: item.quantity,
              allocationType: "unit",
              status: "held",
              holdExpiresAt,
              metadata: (item.metadata as Record<string, unknown> | null | undefined) ?? null,
            })
            .returning()

          if (!allocation) {
            throw new BookingServiceError("allocation_create_failed")
          }
        }
      }

      for (const link of source.itemParticipants) {
        const sourceItemId = getTransactionItemParticipantItemId(link)
        if (!sourceItemId) {
          continue
        }

        const bookingItemId = bookingItemMap.get(sourceItemId)
        const travelerId = participantMap.get(link.travelerId)

        if (!bookingItemId || !travelerId) {
          continue
        }

        await tx.insert(bookingItemTravelers).values({
          bookingItemId,
          travelerId,
          role: link.role as CreateBookingItemParticipantInput["role"],
          isPrimary: link.isPrimary,
        })
      }

      if (staffParticipantMap.size > 0) {
        const linkedStaffAssignments = [] as Array<typeof bookingStaffAssignments.$inferInsert>
        const linkedStaffParticipantIds = new Set<string>()

        for (const link of source.itemParticipants) {
          const staffParticipant = staffParticipantMap.get(link.travelerId)
          if (!staffParticipant) {
            continue
          }

          const sourceItemId = getTransactionItemParticipantItemId(link)
          if (!sourceItemId) {
            continue
          }

          const bookingItemId = bookingItemMap.get(sourceItemId)
          if (!bookingItemId) {
            continue
          }

          linkedStaffParticipantIds.add(staffParticipant.id)
          linkedStaffAssignments.push({
            bookingId: booking.id,
            bookingItemId,
            personId: staffParticipant.personId ?? null,
            role: toStaffAssignmentRole(link.role),
            firstName: staffParticipant.firstName,
            lastName: staffParticipant.lastName,
            email: staffParticipant.email ?? null,
            phone: staffParticipant.phone ?? null,
            preferredLanguage: staffParticipant.preferredLanguage ?? null,
            isPrimary: link.isPrimary || staffParticipant.isPrimary,
            notes: staffParticipant.notes ?? null,
            metadata: {
              sourceParticipantId: staffParticipant.id,
              sourceItemId,
              sourceRole: link.role,
            },
          })
        }

        for (const staffParticipant of staffParticipantMap.values()) {
          if (linkedStaffParticipantIds.has(staffParticipant.id)) {
            continue
          }

          linkedStaffAssignments.push({
            bookingId: booking.id,
            bookingItemId: null,
            personId: staffParticipant.personId ?? null,
            role: "service_assignee",
            firstName: staffParticipant.firstName,
            lastName: staffParticipant.lastName,
            email: staffParticipant.email ?? null,
            phone: staffParticipant.phone ?? null,
            preferredLanguage: staffParticipant.preferredLanguage ?? null,
            isPrimary: staffParticipant.isPrimary,
            notes: staffParticipant.notes ?? null,
            metadata: {
              sourceParticipantId: staffParticipant.id,
            },
          })
        }

        if (linkedStaffAssignments.length > 0) {
          await tx.insert(bookingStaffAssignments).values(linkedStaffAssignments)
        }
      }

      await tx
        .insert(bookingTransactionDetailsRef)
        .values({
          bookingId: booking.id,
          offerId: source.offerId,
          orderId: source.orderId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: bookingTransactionDetailsRef.bookingId,
          set: {
            offerId: source.offerId,
            orderId: source.orderId,
            updatedAt: new Date(),
          },
        })

      await tx.insert(bookingActivityLog).values({
        bookingId: booking.id,
        actorId: userId ?? "system",
        activityType: "booking_reserved",
        description: `Booking ${booking.bookingNumber} reserved from ${source.kind} ${source.sourceId}`,
        metadata: {
          sourceKind: source.kind,
          sourceId: source.sourceId,
          offerId: source.offerId,
          orderId: source.orderId,
          holdExpiresAt: holdExpiresAt.toISOString(),
          itemCount: source.items.length,
        },
      })

      if (data.note) {
        await tx.insert(bookingNotes).values({
          bookingId: booking.id,
          authorId: userId ?? "system",
          content: data.note,
        })
      }

      return { status: "ok" as const, booking }
    })
    if (result.status === "ok") {
      await emitSlotChanges(runtime, slotChanges)
    }
    return result
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return { status: error.code as Exclude<string, "ok"> }
    }
    throw error
  }
}

async function getBookingTransactionLink(db: PostgresJsDatabase, bookingId: string) {
  const [link] = await db
    .select()
    .from(bookingTransactionDetailsRef)
    .where(eq(bookingTransactionDetailsRef.bookingId, bookingId))
    .limit(1)

  return link ?? null
}

async function syncTransactionOnBookingConfirmed(db: PostgresJsDatabase, bookingId: string) {
  const link = await getBookingTransactionLink(db, bookingId)
  if (!link) {
    return
  }

  const now = new Date()

  if (link.orderId) {
    await db
      .update(ordersRef)
      .set({
        status: "confirmed",
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(ordersRef.id, link.orderId))
  }

  if (link.offerId) {
    await db
      .update(offersRef)
      .set({
        status: "converted",
        acceptedAt: now,
        convertedAt: now,
        updatedAt: now,
      })
      .where(eq(offersRef.id, link.offerId))
  }
}

async function syncTransactionOnBookingExpired(db: PostgresJsDatabase, bookingId: string) {
  const link = await getBookingTransactionLink(db, bookingId)
  if (!link?.orderId) {
    return
  }

  const now = new Date()
  await db
    .update(ordersRef)
    .set({
      status: "expired",
      expiresAt: now,
      updatedAt: now,
    })
    .where(eq(ordersRef.id, link.orderId))
}

async function syncTransactionOnBookingCancelled(db: PostgresJsDatabase, bookingId: string) {
  const link = await getBookingTransactionLink(db, bookingId)
  if (!link?.orderId) {
    return
  }

  const now = new Date()
  await db
    .update(ordersRef)
    .set({
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
    })
    .where(eq(ordersRef.id, link.orderId))
}

async function syncTransactionOnBookingRedeemed(db: PostgresJsDatabase, bookingId: string) {
  const link = await getBookingTransactionLink(db, bookingId)
  if (!link?.orderId) {
    return
  }

  await db
    .update(ordersRef)
    .set({
      status: "fulfilled",
      updatedAt: new Date(),
    })
    .where(eq(ordersRef.id, link.orderId))
}

async function autoIssueFulfillmentsForBooking(
  db: PostgresJsDatabase,
  bookingId: string,
  userId?: string,
) {
  const [booking] = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)

  if (!booking) {
    return
  }

  const existingFulfillment = await db
    .select({ id: bookingFulfillments.id })
    .from(bookingFulfillments)
    .where(eq(bookingFulfillments.bookingId, bookingId))
    .limit(1)

  if (existingFulfillment.length > 0) {
    return
  }

  const items = await db
    .select()
    .from(bookingItems)
    .where(and(eq(bookingItems.bookingId, bookingId), sql`${bookingItems.productId} IS NOT NULL`))
    .orderBy(asc(bookingItems.createdAt))

  if (items.length === 0) {
    return
  }

  const productIds = [
    ...new Set(
      items.map((item) => item.productId).filter((value): value is string => Boolean(value)),
    ),
  ]
  if (productIds.length === 0) {
    return
  }

  const settings = await db
    .select()
    .from(productTicketSettingsRef)
    .where(inArray(productTicketSettingsRef.productId, productIds))

  const settingsByProductId = new Map(settings.map((setting) => [setting.productId, setting]))
  const travelerParticipants = await db
    .select()
    .from(bookingTravelers)
    .where(
      and(
        eq(bookingTravelers.bookingId, bookingId),
        or(
          eq(bookingTravelers.participantType, "traveler"),
          eq(bookingTravelers.participantType, "occupant"),
        ),
      ),
    )
    .orderBy(desc(bookingTravelers.isPrimary), asc(bookingTravelers.createdAt))

  const participantLinks = await db
    .select()
    .from(bookingItemTravelers)
    .where(
      sql`${bookingItemTravelers.bookingItemId} IN (
        SELECT ${bookingItems.id}
        FROM ${bookingItems}
        WHERE ${bookingItems.bookingId} = ${bookingId}
      )`,
    )

  const participantLinksByItemId = new Map<string, typeof participantLinks>()
  for (const link of participantLinks) {
    const links = participantLinksByItemId.get(link.bookingItemId) ?? []
    links.push(link)
    participantLinksByItemId.set(link.bookingItemId, links)
  }

  const fulfillmentsToInsert: Array<typeof bookingFulfillments.$inferInsert> = []
  const now = new Date()

  for (const item of items) {
    const productId = item.productId
    if (!productId) {
      continue
    }

    const setting = settingsByProductId.get(productId)
    if (
      !setting ||
      setting.fulfillmentMode === "none" ||
      setting.defaultDeliveryFormat === "none"
    ) {
      continue
    }

    const delivery = mapDeliveryFormatToFulfillment(setting.defaultDeliveryFormat)
    const payloadBase = {
      bookingId,
      bookingNumber: booking.bookingNumber,
      productId,
      bookingItemId: item.id,
    }

    if (setting.fulfillmentMode === "per_booking") {
      if (
        fulfillmentsToInsert.some(
          (row) => row.bookingItemId === item.id || row.bookingItemId === null,
        )
      ) {
        continue
      }

      fulfillmentsToInsert.push({
        bookingId,
        bookingItemId: item.id,
        travelerId: null,
        fulfillmentType: delivery.fulfillmentType,
        deliveryChannel: delivery.deliveryChannel,
        status: "issued",
        payload: { ...payloadBase, scope: "booking" },
        issuedAt: now,
      })
      continue
    }

    if (setting.fulfillmentMode === "per_item") {
      fulfillmentsToInsert.push({
        bookingId,
        bookingItemId: item.id,
        travelerId: null,
        fulfillmentType: delivery.fulfillmentType,
        deliveryChannel: delivery.deliveryChannel,
        status: "issued",
        payload: { ...payloadBase, scope: "item" },
        issuedAt: now,
      })
      continue
    }

    const linkedParticipants =
      participantLinksByItemId
        .get(item.id)
        ?.map((link) =>
          travelerParticipants.find((participant) => participant.id === link.travelerId),
        )
        .filter((participant): participant is typeof bookingTravelers.$inferSelect =>
          Boolean(participant),
        ) ?? []

    const participantsForItem =
      linkedParticipants.length > 0 ? linkedParticipants : travelerParticipants

    for (const participant of participantsForItem) {
      fulfillmentsToInsert.push({
        bookingId,
        bookingItemId: item.id,
        travelerId: participant.id,
        fulfillmentType: delivery.fulfillmentType,
        deliveryChannel: delivery.deliveryChannel,
        status: "issued",
        payload: {
          ...payloadBase,
          travelerId: participant.id,
          scope: "participant",
        },
        issuedAt: now,
      })
    }
  }

  if (fulfillmentsToInsert.length === 0) {
    return
  }

  await db.insert(bookingFulfillments).values(fulfillmentsToInsert)

  await db.insert(bookingActivityLog).values({
    bookingId,
    actorId: userId ?? "system",
    activityType: "fulfillment_issued",
    description: `${fulfillmentsToInsert.length} fulfillment artifact(s) issued automatically`,
    metadata: { count: fulfillmentsToInsert.length },
  })
}

/**
 * Booking statuses that count as "active" for aggregate purposes (matches the
 * slot-unit-availability counting rules — cancelled and expired drop out).
 */
const AGGREGATE_ACTIVE_STATUSES: readonly BookingStatus[] = [
  "draft",
  "on_hold",
  "confirmed",
  "in_progress",
  "completed",
]

export interface BookingAggregateUpcomingDeparture {
  id: string
  bookingNumber: string | null
  status: BookingStatus
  startDate: string | null
  endDate: string | null
  pax: number | null
  sellCurrency: string | null
  sellAmountCents: number | null
}

export interface BookingAggregates {
  /** Total bookings across all statuses in range. */
  total: number
  /**
   * Sum of `pax` across active-status bookings in range. Null pax
   * rows count as zero. Used by the operator dashboard's
   * "total travelers" KPI.
   */
  totalPax: number
  /** One row per booking status (including zero counts for active statuses). */
  countsByStatus: Array<{ status: BookingStatus; count: number }>
  /** Booking counts bucketed by YYYY-MM (UTC), oldest first. */
  monthlyCounts: Array<{ yearMonth: string; count: number }>
  /**
   * Sell revenue bucketed by YYYY-MM (UTC), grouped by currency. Null currency
   * rows are dropped since a booking without a sell currency is malformed.
   */
  monthlyRevenue: Array<{ yearMonth: string; currency: string; sellAmountCents: number }>
  /**
   * Active bookings with `startDate >= today`: the total count plus a
   * bounded slice of the soonest-departing rows (default 8, max 20)
   * so the dashboard can render the upcoming list without a second
   * round-trip.
   */
  upcomingDepartures: {
    count: number
    items: BookingAggregateUpcomingDeparture[]
  }
}

export const bookingsService = {
  /**
   * Pre-aggregated dashboard numbers for the admin bookings surface. Replaces
   * the pattern of fetching a large `listBookings` page and deriving KPIs
   * client-side — which broke past the page limit and disagreed across apps
   * on which statuses count.
   *
   * All ranges are UTC-based.
   */
  async getBookingAggregates(
    db: PostgresJsDatabase,
    options: { from?: string; to?: string; upcomingLimit?: number } = {},
  ): Promise<BookingAggregates> {
    const upcomingLimit = Math.max(0, Math.min(options.upcomingLimit ?? 8, 20))
    const fromDate = options.from ? new Date(options.from) : undefined
    const toDate = options.to ? new Date(options.to) : undefined

    const rangeConditions = []
    if (fromDate) rangeConditions.push(sql`${bookings.createdAt} >= ${fromDate.toISOString()}`)
    if (toDate) rangeConditions.push(sql`${bookings.createdAt} < ${toDate.toISOString()}`)
    const rangeWhere = rangeConditions.length ? and(...rangeConditions) : undefined

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(rangeWhere)

    const [totalPaxRow] = await db
      .select({
        totalPax: sql<number>`coalesce(sum(${bookings.pax}), 0)::bigint`,
      })
      .from(bookings)
      .where(
        and(
          ...(rangeConditions.length ? rangeConditions : []),
          inArray(bookings.status, [...AGGREGATE_ACTIVE_STATUSES]),
        ),
      )

    const statusRows = await db
      .select({
        status: bookings.status,
        count: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(rangeWhere)
      .groupBy(bookings.status)

    const countsByStatusMap = new Map<BookingStatus, number>(
      statusRows.map((row) => [row.status, row.count]),
    )

    const monthlyCountsRows = await db
      .select({
        yearMonth: sql<string>`to_char(${bookings.createdAt} at time zone 'UTC', 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(rangeWhere)
      .groupBy(sql`to_char(${bookings.createdAt} at time zone 'UTC', 'YYYY-MM')`)
      .orderBy(sql`to_char(${bookings.createdAt} at time zone 'UTC', 'YYYY-MM')`)

    const monthlyRevenueRows = await db
      .select({
        yearMonth: sql<string>`to_char(${bookings.createdAt} at time zone 'UTC', 'YYYY-MM')`,
        currency: bookings.sellCurrency,
        sellAmountCents: sql<number>`coalesce(sum(${bookings.sellAmountCents}), 0)::bigint`,
      })
      .from(bookings)
      .where(
        and(
          ...(rangeConditions.length ? rangeConditions : []),
          sql`${bookings.sellAmountCents} IS NOT NULL`,
          inArray(bookings.status, [...AGGREGATE_ACTIVE_STATUSES]),
        ),
      )
      .groupBy(
        sql`to_char(${bookings.createdAt} at time zone 'UTC', 'YYYY-MM')`,
        bookings.sellCurrency,
      )
      .orderBy(
        sql`to_char(${bookings.createdAt} at time zone 'UTC', 'YYYY-MM')`,
        bookings.sellCurrency,
      )

    const todayUtc = new Date()
    todayUtc.setUTCHours(0, 0, 0, 0)
    const todayDateString = todayUtc.toISOString().slice(0, 10)

    const upcomingFilter = and(
      inArray(bookings.status, [...AGGREGATE_ACTIVE_STATUSES]),
      sql`${bookings.startDate} >= ${todayDateString}`,
    )

    const [upcomingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(upcomingFilter)

    const upcomingItems =
      upcomingLimit === 0
        ? []
        : await db
            .select({
              id: bookings.id,
              bookingNumber: bookings.bookingNumber,
              status: bookings.status,
              startDate: bookings.startDate,
              endDate: bookings.endDate,
              pax: bookings.pax,
              sellCurrency: bookings.sellCurrency,
              sellAmountCents: bookings.sellAmountCents,
            })
            .from(bookings)
            .where(upcomingFilter)
            .orderBy(asc(bookings.startDate), asc(bookings.id))
            .limit(upcomingLimit)

    return {
      total: totalRow?.count ?? 0,
      totalPax: Number(totalPaxRow?.totalPax ?? 0),
      countsByStatus: AGGREGATE_ACTIVE_STATUSES.concat(["expired", "cancelled"]).map((status) => ({
        status,
        count: countsByStatusMap.get(status) ?? 0,
      })),
      monthlyCounts: monthlyCountsRows.map((row) => ({
        yearMonth: row.yearMonth,
        count: row.count,
      })),
      monthlyRevenue: monthlyRevenueRows.map((row) => ({
        yearMonth: row.yearMonth,
        currency: row.currency,
        sellAmountCents: Number(row.sellAmountCents),
      })),
      upcomingDepartures: {
        count: upcomingRow?.count ?? 0,
        items: upcomingItems,
      },
    }
  },

  async listBookings(db: PostgresJsDatabase, query: BookingListQuery) {
    const conditions = []

    if (query.status) {
      conditions.push(eq(bookings.status, query.status))
    }

    if (query.search) {
      const term = `%${query.search}%`
      conditions.push(or(ilike(bookings.bookingNumber, term), ilike(bookings.internalNotes, term)))
    }

    if (query.personId) {
      conditions.push(eq(bookings.personId, query.personId))
    }

    if (query.organizationId) {
      conditions.push(eq(bookings.organizationId, query.organizationId))
    }

    if (query.dateFrom) {
      conditions.push(gte(bookings.startDate, query.dateFrom))
    }

    if (query.dateTo) {
      conditions.push(lte(bookings.startDate, query.dateTo))
    }

    if (query.paxMin !== undefined) {
      conditions.push(gte(bookings.pax, query.paxMin))
    }

    if (query.paxMax !== undefined) {
      conditions.push(lte(bookings.pax, query.paxMax))
    }

    if (query.productId || query.optionId) {
      const itemConditions = [eq(bookingItems.bookingId, bookings.id)]
      if (query.productId) {
        itemConditions.push(eq(bookingItems.productId, query.productId))
      }
      if (query.optionId) {
        itemConditions.push(eq(bookingItems.optionId, query.optionId))
      }
      conditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(bookingItems)
            .where(and(...itemConditions)),
        ),
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = (() => {
      switch (query.sortBy) {
        case "bookingNumber":
          return bookings.bookingNumber
        case "status":
          return bookings.status
        case "sellAmount":
          return bookings.sellAmountCents
        case "pax":
          return bookings.pax
        case "startDate":
          return bookings.startDate
        case "endDate":
          return bookings.endDate
        default:
          return bookings.createdAt
      }
    })()
    const sortFn = query.sortDir === "asc" ? asc : desc

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(bookings)
        .where(where)
        .limit(query.limit)
        .offset(query.offset)
        .orderBy(sortFn(sortColumn), desc(bookings.createdAt)),
      db.select({ count: sql<number>`count(*)::int` }).from(bookings).where(where),
    ])
    const bookingIds = rows.map((row) => row.id)
    const items = await listBookingItemsForSummaries(db, bookingIds)

    const ranges = new Map<string, { startsAt: Date | null; endsAt: Date | null }>()
    const itemSummariesByBooking = new Map<
      string,
      Array<{
        id: string
        title: string
        itemType: string
        productId: string | null
        productName: string | null
      }>
    >()
    for (const item of items) {
      const current = ranges.get(item.bookingId) ?? { startsAt: null, endsAt: null }
      if (item.startsAt && (!current.startsAt || item.startsAt < current.startsAt)) {
        current.startsAt = item.startsAt
      }
      if (item.endsAt && (!current.endsAt || item.endsAt > current.endsAt)) {
        current.endsAt = item.endsAt
      }
      ranges.set(item.bookingId, current)

      const list = itemSummariesByBooking.get(item.bookingId) ?? []
      list.push({
        id: item.id,
        title: item.title,
        itemType: item.itemType,
        productId: item.productId,
        productName: item.productName,
      })
      itemSummariesByBooking.set(item.bookingId, list)
    }

    return {
      data: rows.map((row) => {
        const range = ranges.get(row.id)
        return {
          ...row,
          startsAt: range?.startsAt?.toISOString() ?? null,
          endsAt: range?.endsAt?.toISOString() ?? null,
          items: itemSummariesByBooking.get(row.id) ?? [],
        }
      }),
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    }
  },

  async convertProductToBooking(
    db: PostgresJsDatabase,
    data: ConvertProductInput,
    productData: ConvertProductData,
    userId?: string,
  ) {
    const { product, option, slot, dayServices, units } = productData

    // Slot dates win over product dates so scheduled/recurring products don't
    // land with null dates. endsAt is a timestamp; fall back to the slot's
    // dateLocal when the slot has no explicit end timestamp.
    const startDate = slot?.dateLocal ?? product.startDate
    const endDate = slot
      ? slot.endsAt
        ? slot.endsAt.toISOString().slice(0, 10)
        : slot.dateLocal
      : product.endDate

    // Caller-supplied `sellAmountCentsOverride` lets the catalog booking-
    // engine pass the promotion-discounted base through to the booking
    // row so the customer is charged the post-discount amount, not the
    // product's list price. Per docs/architecture/promotions-architecture.md §7.1.
    const effectiveSellAmountCents =
      data.sellAmountCentsOverride != null ? data.sellAmountCentsOverride : product.sellAmountCents

    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: data.bookingNumber,
        status: "draft",
        personId: data.personId ?? null,
        organizationId: data.organizationId ?? null,
        sellCurrency: product.sellCurrency,
        sellAmountCents: effectiveSellAmountCents,
        costAmountCents: product.costAmountCents,
        marginPercent: product.marginPercent,
        startDate,
        endDate,
        pax: product.pax,
        internalNotes: data.internalNotes ?? null,
      })
      .returning()

    if (!booking) {
      return null
    }

    if (dayServices.length > 0) {
      await db.insert(bookingSupplierStatuses).values(
        dayServices.map((service) => ({
          bookingId: booking.id,
          supplierServiceId: service.supplierServiceId,
          serviceName: service.name,
          status: "pending" as const,
          costCurrency: service.costCurrency,
          costAmountCents: service.costAmountCents,
        })),
      )
    }

    const selectedUnits = option === null ? [] : units

    const unitsToSeed =
      selectedUnits.filter((unit) => unit.isRequired).length > 0
        ? selectedUnits.filter((unit) => unit.isRequired)
        : selectedUnits.length === 1
          ? selectedUnits
          : []

    const slotFields = slot
      ? {
          serviceDate: slot.dateLocal,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          metadata: { availabilitySlotId: slot.id } as Record<string, unknown>,
        }
      : { metadata: null as Record<string, unknown> | null }

    // Seeded line-item totals must match the booking's `sellAmountCents`
    // so checkout / payment / invoicing don't see a list-price item beneath
    // a discounted booking header.
    const itemRows =
      unitsToSeed.length > 0
        ? unitsToSeed.map((unit, index) => {
            const quantity =
              unit.unitType === "person" && product.pax
                ? product.pax
                : unit.minQuantity && unit.minQuantity > 0
                  ? unit.minQuantity
                  : 1
            const singleSeedItem = unitsToSeed.length === 1 && index === 0
            return {
              bookingId: booking.id,
              title: unit.name,
              description: unit.description,
              itemType: "unit" as const,
              status: "draft" as const,
              quantity,
              sellCurrency: product.sellCurrency,
              unitSellAmountCents:
                singleSeedItem &&
                effectiveSellAmountCents !== null &&
                effectiveSellAmountCents !== undefined
                  ? Math.floor(effectiveSellAmountCents / quantity)
                  : null,
              totalSellAmountCents: singleSeedItem ? (effectiveSellAmountCents ?? null) : null,
              costCurrency: singleSeedItem ? product.sellCurrency : null,
              unitCostAmountCents:
                singleSeedItem &&
                product.costAmountCents !== null &&
                product.costAmountCents !== undefined
                  ? Math.floor(product.costAmountCents / quantity)
                  : null,
              totalCostAmountCents: singleSeedItem ? (product.costAmountCents ?? null) : null,
              productId: product.id,
              optionId: option?.id ?? null,
              optionUnitId: unit.id,
              ...slotFields,
            }
          })
        : [
            {
              bookingId: booking.id,
              title: option?.name ?? product.name,
              description: product.description,
              itemType: "unit" as const,
              status: "draft" as const,
              quantity: 1,
              sellCurrency: product.sellCurrency,
              unitSellAmountCents: effectiveSellAmountCents ?? null,
              totalSellAmountCents: effectiveSellAmountCents ?? null,
              costCurrency: product.sellCurrency,
              unitCostAmountCents: product.costAmountCents ?? null,
              totalCostAmountCents: product.costAmountCents ?? null,
              productId: product.id,
              optionId: option?.id ?? null,
              optionUnitId: null,
              ...slotFields,
            },
          ]

    const insertedItems = await db.insert(bookingItems).values(itemRows).returning()

    await db
      .insert(bookingProductDetailsRef)
      .values({
        bookingId: booking.id,
        productId: product.id,
        optionId: option?.id ?? null,
      })
      .onConflictDoUpdate({
        target: bookingProductDetailsRef.bookingId,
        set: {
          productId: product.id,
          optionId: option?.id ?? null,
          updatedAt: new Date(),
        },
      })

    if (insertedItems.length > 0) {
      await db.insert(bookingItemProductDetailsRef).values(
        insertedItems.map((item) => ({
          bookingItemId: item.id,
          productId: item.productId ?? null,
          optionId: item.optionId ?? null,
          unitId: item.optionUnitId ?? null,
          supplierServiceId: null,
        })),
      )
    }

    await db.insert(bookingActivityLog).values({
      bookingId: booking.id,
      actorId: userId ?? "system",
      activityType: "booking_converted",
      description: `Booking converted from product "${product.name}"`,
      metadata: {
        productId: product.id,
        productName: product.name,
        optionId: option?.id ?? null,
        slotId: slot?.id ?? null,
      },
    })

    return booking
  },

  async getBookingById(db: PostgresJsDatabase, id: string) {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1)
    return row ?? null
  },

  async createBookingFromProduct(
    db: PostgresJsDatabase,
    data: ConvertProductInput,
    userId?: string,
  ) {
    const productData = await getConvertProductData(db, data)
    if (!productData) {
      return null
    }

    return this.convertProductToBooking(db, data, productData, userId)
  },

  listAllocations(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingAllocations)
      .where(eq(bookingAllocations.bookingId, bookingId))
      .orderBy(asc(bookingAllocations.createdAt))
  },

  async reserveBookingFromOffer(
    db: PostgresJsDatabase,
    offerId: string,
    data: ReserveBookingFromTransactionInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    const [offer] = await db.select().from(offersRef).where(eq(offersRef.id, offerId)).limit(1)

    if (!offer) {
      return { status: "not_found" as const }
    }

    const [participants, items, itemParticipants, staffAssignments] = await Promise.all([
      db
        .select()
        .from(offerParticipantsRef)
        .where(eq(offerParticipantsRef.offerId, offerId))
        .orderBy(asc(offerParticipantsRef.createdAt)),
      db
        .select()
        .from(offerItemsRef)
        .where(eq(offerItemsRef.offerId, offerId))
        .orderBy(asc(offerItemsRef.createdAt)),
      db
        .select()
        .from(offerItemParticipantsRef)
        .where(
          sql`${offerItemParticipantsRef.offerItemId} IN (
            SELECT ${offerItemsRef.id}
            FROM ${offerItemsRef}
            WHERE ${offerItemsRef.offerId} = ${offerId}
          )`,
        )
        .orderBy(asc(offerItemParticipantsRef.createdAt)),
      db
        .select()
        .from(offerStaffAssignmentsRef)
        .where(eq(offerStaffAssignmentsRef.offerId, offerId))
        .orderBy(asc(offerStaffAssignmentsRef.createdAt)),
    ])

    const reservationParticipants = [...participants] as TransactionParticipantRecord[]
    const reservationItemParticipants = itemParticipants.map(
      (link): TransactionItemParticipantRecord => ({
        travelerId: link.travelerId,
        role: link.role,
        isPrimary: link.isPrimary,
        offerItemId: link.offerItemId,
      }),
    )
    for (const assignment of staffAssignments) {
      const participant = toStaffReservationParticipant(assignment, "offer")
      reservationParticipants.push(participant)

      if (assignment.offerItemId) {
        reservationItemParticipants.push({
          travelerId: participant.id,
          role: assignment.role,
          isPrimary: assignment.isPrimary,
          offerItemId: assignment.offerItemId,
        })
      }
    }

    return reserveBookingFromTransactionSource(
      db,
      {
        kind: "offer",
        sourceId: offerId,
        offerId: offer.id,
        orderId: null,
        personId: offer.personId ?? null,
        organizationId: offer.organizationId ?? null,
        contactFirstName: offer.contactFirstName ?? null,
        contactLastName: offer.contactLastName ?? null,
        contactEmail: offer.contactEmail ?? null,
        contactPhone: offer.contactPhone ?? null,
        contactPreferredLanguage: offer.contactPreferredLanguage ?? null,
        contactCountry: offer.contactCountry ?? null,
        contactRegion: offer.contactRegion ?? null,
        contactCity: offer.contactCity ?? null,
        contactAddressLine1: offer.contactAddressLine1 ?? null,
        contactPostalCode: offer.contactPostalCode ?? null,
        currency: offer.currency,
        baseCurrency: offer.baseCurrency ?? null,
        totalAmountCents: offer.totalAmountCents ?? null,
        costAmountCents: offer.costAmountCents ?? null,
        notes: offer.notes ?? null,
        participants: reservationParticipants,
        items,
        itemParticipants: reservationItemParticipants,
      },
      data,
      userId,
      runtime,
    )
  },

  async reserveBookingFromOrder(
    db: PostgresJsDatabase,
    orderId: string,
    data: ReserveBookingFromTransactionInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    const [order] = await db.select().from(ordersRef).where(eq(ordersRef.id, orderId)).limit(1)

    if (!order) {
      return { status: "not_found" as const }
    }

    const [participants, items, itemParticipants, staffAssignments] = await Promise.all([
      db
        .select()
        .from(orderParticipantsRef)
        .where(eq(orderParticipantsRef.orderId, orderId))
        .orderBy(asc(orderParticipantsRef.createdAt)),
      db
        .select()
        .from(orderItemsRef)
        .where(eq(orderItemsRef.orderId, orderId))
        .orderBy(asc(orderItemsRef.createdAt)),
      db
        .select()
        .from(orderItemParticipantsRef)
        .where(
          sql`${orderItemParticipantsRef.orderItemId} IN (
            SELECT ${orderItemsRef.id}
            FROM ${orderItemsRef}
            WHERE ${orderItemsRef.orderId} = ${orderId}
          )`,
        )
        .orderBy(asc(orderItemParticipantsRef.createdAt)),
      db
        .select()
        .from(orderStaffAssignmentsRef)
        .where(eq(orderStaffAssignmentsRef.orderId, orderId))
        .orderBy(asc(orderStaffAssignmentsRef.createdAt)),
    ])

    const reservationParticipants = [...participants] as TransactionParticipantRecord[]
    const reservationItemParticipants = itemParticipants.map(
      (link): TransactionItemParticipantRecord => ({
        travelerId: link.travelerId,
        role: link.role,
        isPrimary: link.isPrimary,
        orderItemId: link.orderItemId,
      }),
    )
    for (const assignment of staffAssignments) {
      const participant = toStaffReservationParticipant(assignment, "order")
      reservationParticipants.push(participant)

      if (assignment.orderItemId) {
        reservationItemParticipants.push({
          travelerId: participant.id,
          role: assignment.role,
          isPrimary: assignment.isPrimary,
          orderItemId: assignment.orderItemId,
        })
      }
    }

    return reserveBookingFromTransactionSource(
      db,
      {
        kind: "order",
        sourceId: orderId,
        offerId: order.offerId ?? null,
        orderId: order.id,
        personId: order.personId ?? null,
        organizationId: order.organizationId ?? null,
        contactFirstName: order.contactFirstName ?? null,
        contactLastName: order.contactLastName ?? null,
        contactEmail: order.contactEmail ?? null,
        contactPhone: order.contactPhone ?? null,
        contactPreferredLanguage: order.contactPreferredLanguage ?? null,
        contactCountry: order.contactCountry ?? null,
        contactRegion: order.contactRegion ?? null,
        contactCity: order.contactCity ?? null,
        contactAddressLine1: order.contactAddressLine1 ?? null,
        contactPostalCode: order.contactPostalCode ?? null,
        currency: order.currency,
        baseCurrency: order.baseCurrency ?? null,
        totalAmountCents: order.totalAmountCents ?? null,
        costAmountCents: order.costAmountCents ?? null,
        notes: order.notes ?? null,
        participants: reservationParticipants,
        items,
        itemParticipants: reservationItemParticipants,
      },
      data,
      userId,
      runtime,
    )
  },

  async reserveBooking(
    db: PostgresJsDatabase,
    data: ReserveBookingInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    const slotChanges: AvailabilitySlotChangedEventPayload[] = []
    try {
      const result = await db.transaction(async (tx) => {
        const holdExpiresAt = await computeHoldExpiresAt(tx as PostgresJsDatabase, data, data.items)
        const [booking] = await tx
          .insert(bookings)
          .values({
            bookingNumber: data.bookingNumber,
            status: "on_hold",
            personId: data.personId ?? null,
            organizationId: data.organizationId ?? null,
            sourceType: data.sourceType,
            externalBookingRef: data.externalBookingRef ?? null,
            communicationLanguage: data.communicationLanguage ?? null,
            contactFirstName: data.contactFirstName ?? null,
            contactLastName: data.contactLastName ?? null,
            contactEmail: data.contactEmail ?? null,
            contactPhone: data.contactPhone ?? null,
            contactPreferredLanguage: data.contactPreferredLanguage ?? null,
            contactCountry: data.contactCountry ?? null,
            contactRegion: data.contactRegion ?? null,
            contactCity: data.contactCity ?? null,
            contactAddressLine1: data.contactAddressLine1 ?? null,
            contactPostalCode: data.contactPostalCode ?? null,
            sellCurrency: data.sellCurrency,
            baseCurrency: data.baseCurrency ?? null,
            sellAmountCents: data.sellAmountCents ?? null,
            baseSellAmountCents: data.baseSellAmountCents ?? null,
            costAmountCents: data.costAmountCents ?? null,
            baseCostAmountCents: data.baseCostAmountCents ?? null,
            marginPercent: data.marginPercent ?? null,
            startDate: data.startDate ?? null,
            endDate: data.endDate ?? null,
            pax: data.pax ?? null,
            internalNotes: data.internalNotes ?? null,
            holdExpiresAt,
          })
          .returning()

        if (!booking) {
          throw new BookingServiceError("booking_create_failed")
        }

        for (const item of data.items) {
          const capacity = await adjustSlotCapacity(
            tx as PostgresJsDatabase,
            item.availabilitySlotId,
            -item.quantity,
            "booking",
          )

          if (capacity.status === "slot_not_found") {
            throw new BookingServiceError("slot_not_found")
          }
          if (capacity.status === "slot_unavailable") {
            throw new BookingServiceError("slot_unavailable")
          }
          if (capacity.status === "insufficient_capacity") {
            throw new BookingServiceError("insufficient_capacity")
          }

          const slot = capacity.slot
          if (item.productId && item.productId !== slot.product_id) {
            throw new BookingServiceError("slot_product_mismatch")
          }
          if (item.optionId && item.optionId !== slot.option_id) {
            throw new BookingServiceError("slot_option_mismatch")
          }
          if (capacity.slotChange) slotChanges.push(capacity.slotChange)

          const [bookingItem] = await tx
            .insert(bookingItems)
            .values({
              bookingId: booking.id,
              title: item.title,
              description: item.description ?? null,
              itemType: item.itemType,
              status: "on_hold",
              serviceDate: slot.date_local,
              startsAt: slot.starts_at,
              endsAt: slot.ends_at,
              quantity: item.quantity,
              sellCurrency: item.sellCurrency ?? booking.sellCurrency,
              unitSellAmountCents: item.unitSellAmountCents ?? null,
              totalSellAmountCents: item.totalSellAmountCents ?? null,
              costCurrency: item.costCurrency ?? null,
              unitCostAmountCents: item.unitCostAmountCents ?? null,
              totalCostAmountCents: item.totalCostAmountCents ?? null,
              notes: item.notes ?? null,
              productId: item.productId ?? slot.product_id,
              optionId: item.optionId ?? slot.option_id,
              optionUnitId: item.optionUnitId ?? null,
              pricingCategoryId: item.pricingCategoryId ?? null,
              sourceSnapshotId: item.sourceSnapshotId ?? null,
              sourceOfferId: item.sourceOfferId ?? null,
              metadata: item.metadata ?? null,
            })
            .returning()

          if (!bookingItem) {
            throw new BookingServiceError("booking_item_create_failed")
          }

          const [allocation] = await tx
            .insert(bookingAllocations)
            .values({
              bookingId: booking.id,
              bookingItemId: bookingItem.id,
              productId: item.productId ?? slot.product_id,
              optionId: item.optionId ?? slot.option_id,
              optionUnitId: item.optionUnitId ?? null,
              pricingCategoryId: item.pricingCategoryId ?? null,
              availabilitySlotId: item.availabilitySlotId,
              quantity: item.quantity,
              allocationType: item.allocationType,
              status: "held",
              holdExpiresAt,
              metadata: item.metadata ?? null,
            })
            .returning()

          if (!allocation) {
            throw new BookingServiceError("allocation_create_failed")
          }
        }

        await tx.insert(bookingActivityLog).values({
          bookingId: booking.id,
          actorId: userId ?? "system",
          activityType: "booking_reserved",
          description: `Booking ${booking.bookingNumber} reserved and placed on hold`,
          metadata: { holdExpiresAt: holdExpiresAt.toISOString(), itemCount: data.items.length },
        })

        return { status: "ok" as const, booking }
      })
      if (result.status === "ok") {
        await emitSlotChanges(runtime, slotChanges)
      }
      return result
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  async createBooking(db: PostgresJsDatabase, data: CreateBookingInput, userId?: string) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(bookings)
        .values({
          ...data,
          contactFirstName: data.contactFirstName ?? null,
          contactLastName: data.contactLastName ?? null,
          contactEmail: data.contactEmail ?? null,
          contactPhone: data.contactPhone ?? null,
          contactPreferredLanguage: data.contactPreferredLanguage ?? null,
          contactCountry: data.contactCountry ?? null,
          contactRegion: data.contactRegion ?? null,
          contactCity: data.contactCity ?? null,
          contactAddressLine1: data.contactAddressLine1 ?? null,
          contactPostalCode: data.contactPostalCode ?? null,
          holdExpiresAt: toTimestamp(data.holdExpiresAt),
          confirmedAt: toTimestamp(data.confirmedAt),
          expiredAt: toTimestamp(data.expiredAt),
          cancelledAt: toTimestamp(data.cancelledAt),
          completedAt: toTimestamp(data.completedAt),
          redeemedAt: toTimestamp(data.redeemedAt),
        })
        .returning()

      if (!row) {
        return null
      }

      await tx.insert(bookingActivityLog).values({
        bookingId: row.id,
        actorId: userId ?? "system",
        activityType: "booking_created",
        description: `Booking ${data.bookingNumber} created`,
      })

      return row
    })
  },

  async updateBooking(db: PostgresJsDatabase, id: string, data: UpdateBookingInput) {
    const [row] = await db
      .update(bookings)
      .set({
        ...data,
        contactFirstName:
          data.contactFirstName === undefined ? undefined : (data.contactFirstName ?? null),
        contactLastName:
          data.contactLastName === undefined ? undefined : (data.contactLastName ?? null),
        contactEmail: data.contactEmail === undefined ? undefined : (data.contactEmail ?? null),
        contactPhone: data.contactPhone === undefined ? undefined : (data.contactPhone ?? null),
        contactPreferredLanguage:
          data.contactPreferredLanguage === undefined
            ? undefined
            : (data.contactPreferredLanguage ?? null),
        contactCountry:
          data.contactCountry === undefined ? undefined : (data.contactCountry ?? null),
        contactRegion: data.contactRegion === undefined ? undefined : (data.contactRegion ?? null),
        contactCity: data.contactCity === undefined ? undefined : (data.contactCity ?? null),
        contactAddressLine1:
          data.contactAddressLine1 === undefined ? undefined : (data.contactAddressLine1 ?? null),
        contactPostalCode:
          data.contactPostalCode === undefined ? undefined : (data.contactPostalCode ?? null),
        holdExpiresAt:
          data.holdExpiresAt === undefined ? undefined : toTimestamp(data.holdExpiresAt),
        confirmedAt: data.confirmedAt === undefined ? undefined : toTimestamp(data.confirmedAt),
        expiredAt: data.expiredAt === undefined ? undefined : toTimestamp(data.expiredAt),
        cancelledAt: data.cancelledAt === undefined ? undefined : toTimestamp(data.cancelledAt),
        completedAt: data.completedAt === undefined ? undefined : toTimestamp(data.completedAt),
        redeemedAt: data.redeemedAt === undefined ? undefined : toTimestamp(data.redeemedAt),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning()

    return row ?? null
  },

  async deleteBooking(db: PostgresJsDatabase, id: string) {
    const [row] = await db
      .delete(bookings)
      .where(eq(bookings.id, id))
      .returning({ id: bookings.id })

    return row ?? null
  },

  async confirmBooking(
    db: PostgresJsDatabase,
    id: string,
    data: ConfirmBookingInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    try {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, booking_number, status, hold_expires_at
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (
          rows as unknown as Array<{
            id: string
            booking_number: string
            status: BookingStatus
            hold_expires_at: Date | null
          }>
        )[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }
        if (!canTransitionBooking(booking.status, "confirmed")) {
          throw new BookingServiceError("invalid_transition")
        }
        // Accept both the staff-brokered "on_hold" and the customer
        // checkout flow's "awaiting_payment". Other statuses (draft,
        // already-confirmed, expired, cancelled) reject — the state
        // machine catches the rest, but we explicitly forbid the
        // states that would skip a step in the lifecycle.
        if (booking.status !== "on_hold" && booking.status !== "awaiting_payment") {
          throw new BookingServiceError("invalid_transition")
        }
        if (booking.hold_expires_at && booking.hold_expires_at < new Date()) {
          throw new BookingServiceError("hold_expired")
        }

        const patch = transitionBooking(booking.status, "confirmed")

        await tx
          .update(bookingAllocations)
          .set({
            status: "confirmed",
            confirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(bookingAllocations.bookingId, id), eq(bookingAllocations.status, "held")))

        await tx
          .update(bookingItems)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(and(eq(bookingItems.bookingId, id), eq(bookingItems.status, "on_hold")))

        const [row] = await tx
          .update(bookings)
          .set({
            ...patch,
            holdExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id))
          .returning()

        await syncTransactionOnBookingConfirmed(tx as PostgresJsDatabase, id)
        await autoIssueFulfillmentsForBooking(tx as PostgresJsDatabase, id, userId)

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "booking_confirmed",
          description: `Booking ${booking.booking_number} confirmed`,
        })

        if (data.note) {
          await tx.insert(bookingNotes).values({
            bookingId: id,
            authorId: userId ?? "system",
            content: data.note,
          })
        }

        return { status: "ok" as const, booking: row ?? null }
      })

      // Emit AFTER the transaction commits so subscribers can't observe a
      // confirmed state that might still roll back. `emit` is fire-and-forget
      // per the EventBus contract — subscriber errors are logged, not rethrown.
      if (result.status === "ok" && result.booking) {
        await runtime.eventBus?.emit(
          "booking.confirmed",
          {
            bookingId: result.booking.id,
            bookingNumber: result.booking.bookingNumber,
            actorId: userId ?? null,
          } satisfies BookingConfirmedEvent,
          { category: "domain", source: "service" },
        )
      }

      return result
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  async recoverExpiredPaidBooking(
    db: PostgresJsDatabase,
    id: string,
    data: ConfirmBookingInput = {},
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    const slotChanges: AvailabilitySlotChangedEventPayload[] = []
    try {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, booking_number, status
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (
          rows as unknown as Array<{
            id: string
            booking_number: string
            status: BookingStatus
          }>
        )[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }
        if (booking.status !== "awaiting_payment" && booking.status !== "expired") {
          throw new BookingServiceError("invalid_transition")
        }

        const allocations = await tx
          .select()
          .from(bookingAllocations)
          .where(eq(bookingAllocations.bookingId, id))

        for (const allocation of allocations) {
          if (allocation.status === "confirmed") {
            continue
          }
          if (allocation.status !== "held" && allocation.status !== "expired") {
            throw new BookingServiceError("invalid_transition")
          }
          if (!allocation.availabilitySlotId || allocation.status === "held") {
            continue
          }

          const capacity = await adjustSlotCapacity(
            tx as PostgresJsDatabase,
            allocation.availabilitySlotId,
            -allocation.quantity,
            "booking",
          )
          if (capacity.status === "slot_not_found") {
            throw new BookingServiceError("slot_not_found")
          }
          if (capacity.status === "slot_unavailable") {
            throw new BookingServiceError("slot_unavailable")
          }
          if (capacity.status === "insufficient_capacity") {
            throw new BookingServiceError("insufficient_capacity")
          }
          if (capacity.slotChange) slotChanges.push(capacity.slotChange)
        }

        const now = new Date()
        await tx
          .update(bookingAllocations)
          .set({
            status: "confirmed",
            confirmedAt: now,
            releasedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(bookingAllocations.bookingId, id),
              inArray(bookingAllocations.status, ["held", "expired"]),
            ),
          )

        await tx
          .update(bookingItems)
          .set({ status: "confirmed", updatedAt: now })
          .where(
            and(
              eq(bookingItems.bookingId, id),
              inArray(bookingItems.status, ["on_hold", "expired"]),
            ),
          )

        const [row] = await tx
          .update(bookings)
          .set({
            status: "confirmed",
            confirmedAt: now,
            paidAt: now,
            expiredAt: null,
            holdExpiresAt: null,
            updatedAt: now,
          })
          .where(eq(bookings.id, id))
          .returning()

        await syncTransactionOnBookingConfirmed(tx as PostgresJsDatabase, id)
        await autoIssueFulfillmentsForBooking(tx as PostgresJsDatabase, id, userId)

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "booking_confirmed",
          description: `Late payment recovered and booking ${booking.booking_number} confirmed`,
          metadata: { recoveredFromStatus: booking.status },
        })

        if (data.note) {
          await tx.insert(bookingNotes).values({
            bookingId: id,
            authorId: userId ?? "system",
            content: data.note,
          })
        }

        return { status: "ok" as const, booking: row ?? null }
      })

      if (result.status === "ok" && result.booking) {
        await runtime.eventBus?.emit(
          "booking.confirmed",
          {
            bookingId: result.booking.id,
            bookingNumber: result.booking.bookingNumber,
            actorId: userId ?? null,
          } satisfies BookingConfirmedEvent,
          { category: "domain", source: "service" },
        )
        await emitSlotChanges(runtime, slotChanges)
      }

      return result
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  async extendBookingHold(
    db: PostgresJsDatabase,
    id: string,
    data: ExtendBookingHoldInput,
    userId?: string,
  ) {
    try {
      return await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, status, hold_expires_at
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (
          rows as unknown as Array<{
            id: string
            status: BookingStatus
            hold_expires_at: Date | null
          }>
        )[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }
        if (booking.status !== "on_hold" && booking.status !== "awaiting_payment") {
          throw new BookingServiceError("invalid_transition")
        }
        if (booking.hold_expires_at && booking.hold_expires_at < new Date()) {
          throw new BookingServiceError("hold_expired")
        }

        const holdExpiresAt = await computeHoldExpiresAt(tx as PostgresJsDatabase, data)

        await tx
          .update(bookingAllocations)
          .set({
            holdExpiresAt,
            updatedAt: new Date(),
          })
          .where(and(eq(bookingAllocations.bookingId, id), eq(bookingAllocations.status, "held")))

        const [row] = await tx
          .update(bookings)
          .set({
            holdExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id))
          .returning()

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "hold_extended",
          description: "Booking hold extended",
          metadata: { holdExpiresAt: holdExpiresAt.toISOString() },
        })

        return { status: "ok" as const, booking: row ?? null }
      })
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  async expireBooking(
    db: PostgresJsDatabase,
    id: string,
    data: ExpireBookingInput,
    userId?: string,
    runtime: BookingServiceRuntime & { cause?: "route" | "sweep" } = {},
  ) {
    const slotChanges: AvailabilitySlotChangedEventPayload[] = []
    try {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, status, hold_expires_at
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (
          rows as unknown as Array<{
            id: string
            status: BookingStatus
            hold_expires_at: Date | null
          }>
        )[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }
        if (!canTransitionBooking(booking.status, "expired")) {
          throw new BookingServiceError("invalid_transition")
        }
        if (booking.status !== "on_hold") {
          throw new BookingServiceError("invalid_transition")
        }

        const patch = transitionBooking(booking.status, "expired")

        const allocations = await tx
          .select()
          .from(bookingAllocations)
          .where(eq(bookingAllocations.bookingId, id))

        for (const allocation of allocations) {
          const change = await releaseAllocationCapacity(
            tx as PostgresJsDatabase,
            allocation,
            "expire",
          )
          if (change) slotChanges.push(change)
        }

        await tx
          .update(bookingAllocations)
          .set({
            status: "expired",
            releasedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(bookingAllocations.bookingId, id), eq(bookingAllocations.status, "held")))

        await tx
          .update(bookingItems)
          .set({ status: "expired", updatedAt: new Date() })
          .where(and(eq(bookingItems.bookingId, id), eq(bookingItems.status, "on_hold")))

        const [row] = await tx
          .update(bookings)
          .set({
            ...patch,
            holdExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id))
          .returning()

        await syncTransactionOnBookingExpired(tx as PostgresJsDatabase, id)

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "hold_expired",
          description: "Booking hold expired",
        })

        if (data.note) {
          await tx.insert(bookingNotes).values({
            bookingId: id,
            authorId: userId ?? "system",
            content: data.note,
          })
        }

        return { status: "ok" as const, booking: row ?? null }
      })

      if (result.status === "ok" && result.booking) {
        await runtime.eventBus?.emit(
          "booking.expired",
          {
            bookingId: result.booking.id,
            bookingNumber: result.booking.bookingNumber,
            cause: runtime.cause ?? "route",
            actorId: userId ?? null,
          } satisfies BookingExpiredEvent,
          { category: "domain", source: "service" },
        )
        await emitSlotChanges(runtime, slotChanges)
        await runtime.expirePaymentSessionsForBooking?.(db, result.booking.id)
      }

      return result
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  async expireStaleBookings(
    db: PostgresJsDatabase,
    data: ExpireStaleBookingsInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    const cutoff = data.before ? new Date(data.before) : new Date()
    const staleBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, ["on_hold", "awaiting_payment"]),
          sql`${bookings.holdExpiresAt} IS NOT NULL`,
          lte(bookings.holdExpiresAt, cutoff),
        ),
      )
      .orderBy(asc(bookings.holdExpiresAt), asc(bookings.createdAt))

    const expiredIds: string[] = []

    for (const booking of staleBookings) {
      const result = await this.expireBooking(
        db,
        booking.id,
        { note: data.note ?? "Hold expired by sweep" },
        userId,
        { ...runtime, cause: "sweep" },
      )

      if ("booking" in result && result.booking) {
        expiredIds.push(result.booking.id)
      }
    }

    return {
      expiredIds,
      count: expiredIds.length,
      cutoff,
    }
  },

  async cancelBooking(
    db: PostgresJsDatabase,
    id: string,
    data: CancelBookingInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    const slotChanges: AvailabilitySlotChangedEventPayload[] = []
    try {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, status
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (rows as unknown as Array<{ id: string; status: BookingStatus }>)[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }
        if (!canTransitionBooking(booking.status, "cancelled")) {
          throw new BookingServiceError("invalid_transition")
        }

        const patch = transitionBooking(booking.status, "cancelled")
        const previousStatus = booking.status as BookingCancelledEvent["previousStatus"]

        const allocations = await tx
          .select()
          .from(bookingAllocations)
          .where(eq(bookingAllocations.bookingId, id))

        for (const allocation of allocations) {
          const change = await releaseAllocationCapacity(
            tx as PostgresJsDatabase,
            allocation,
            "cancel",
          )
          if (change) slotChanges.push(change)
        }

        await tx
          .update(bookingAllocations)
          .set({
            status: "cancelled",
            releasedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(bookingAllocations.bookingId, id),
              or(eq(bookingAllocations.status, "held"), eq(bookingAllocations.status, "confirmed")),
            ),
          )

        await tx
          .update(bookingItems)
          .set({
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(bookingItems.bookingId, id),
              or(
                eq(bookingItems.status, "draft"),
                eq(bookingItems.status, "on_hold"),
                eq(bookingItems.status, "confirmed"),
              ),
            ),
          )

        const [row] = await tx
          .update(bookings)
          .set({
            ...patch,
            holdExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id))
          .returning()

        await syncTransactionOnBookingCancelled(tx as PostgresJsDatabase, id)

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "status_change",
          description: `Booking cancelled from ${booking.status}`,
          metadata: { oldStatus: booking.status, newStatus: "cancelled" },
        })

        if (data.note) {
          await tx.insert(bookingNotes).values({
            bookingId: id,
            authorId: userId ?? "system",
            content: data.note,
          })
        }

        // Clean up any booking-group membership (dissolve if ≤1 active members remain).
        await cleanupGroupOnBookingCancelled(tx as PostgresJsDatabase, id)

        return { status: "ok" as const, booking: row ?? null, previousStatus }
      })

      if (result.status === "ok" && result.booking) {
        await runtime.eventBus?.emit(
          "booking.cancelled",
          {
            bookingId: result.booking.id,
            bookingNumber: result.booking.bookingNumber,
            previousStatus: result.previousStatus,
            actorId: userId ?? null,
          } satisfies BookingCancelledEvent,
          { category: "domain", source: "service" },
        )
        await emitSlotChanges(runtime, slotChanges)
      }

      return { status: result.status, booking: result.booking }
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  async startBooking(
    db: PostgresJsDatabase,
    id: string,
    data: StartBookingInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    try {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, booking_number, status
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (
          rows as unknown as Array<{ id: string; booking_number: string; status: BookingStatus }>
        )[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }
        if (!canTransitionBooking(booking.status, "in_progress")) {
          throw new BookingServiceError("invalid_transition")
        }

        const patch = transitionBooking(booking.status, "in_progress")

        const [row] = await tx
          .update(bookings)
          .set({
            ...patch,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id))
          .returning()

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "booking_started",
          description: `Booking ${booking.booking_number} started`,
        })

        if (data.note) {
          await tx.insert(bookingNotes).values({
            bookingId: id,
            authorId: userId ?? "system",
            content: data.note,
          })
        }

        return { status: "ok" as const, booking: row ?? null }
      })

      if (result.status === "ok" && result.booking) {
        await runtime.eventBus?.emit(
          "booking.started",
          {
            bookingId: result.booking.id,
            bookingNumber: result.booking.bookingNumber,
            actorId: userId ?? null,
          } satisfies BookingStartedEvent,
          { category: "domain", source: "service" },
        )
      }

      return result
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  async completeBooking(
    db: PostgresJsDatabase,
    id: string,
    data: CompleteBookingInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    try {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, booking_number, status
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (
          rows as unknown as Array<{ id: string; booking_number: string; status: BookingStatus }>
        )[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }
        if (!canTransitionBooking(booking.status, "completed")) {
          throw new BookingServiceError("invalid_transition")
        }

        const patch = transitionBooking(booking.status, "completed")

        await tx
          .update(bookingAllocations)
          .set({ status: "fulfilled", updatedAt: new Date() })
          .where(
            and(eq(bookingAllocations.bookingId, id), eq(bookingAllocations.status, "confirmed")),
          )

        await tx
          .update(bookingItems)
          .set({ status: "fulfilled", updatedAt: new Date() })
          .where(and(eq(bookingItems.bookingId, id), eq(bookingItems.status, "confirmed")))

        const [row] = await tx
          .update(bookings)
          .set({
            ...patch,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id))
          .returning()

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "booking_completed",
          description: `Booking ${booking.booking_number} completed`,
        })

        if (data.note) {
          await tx.insert(bookingNotes).values({
            bookingId: id,
            authorId: userId ?? "system",
            content: data.note,
          })
        }

        return { status: "ok" as const, booking: row ?? null }
      })

      if (result.status === "ok" && result.booking) {
        await runtime.eventBus?.emit(
          "booking.completed",
          {
            bookingId: result.booking.id,
            bookingNumber: result.booking.bookingNumber,
            actorId: userId ?? null,
          } satisfies BookingCompletedEvent,
          { category: "domain", source: "service" },
        )
      }

      return result
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  /**
   * Admin-only force: bypasses the transition graph. Updates the booking row
   * only — does NOT cascade to items, allocations, or fulfillments. If the
   * operator needs cascaded behavior (e.g. release allocations), they should
   * call the verb-specific method instead. The override is for data
   * correction; misuse leaves child state inconsistent with the parent.
   */
  async overrideBookingStatus(
    db: PostgresJsDatabase,
    id: string,
    data: OverrideBookingStatusInput,
    userId?: string,
    runtime: BookingServiceRuntime = {},
  ) {
    try {
      const result = await db.transaction(async (tx) => {
        const rows = await tx.execute(
          sql`SELECT id, booking_number, status
              FROM ${bookings}
              WHERE ${bookings.id} = ${id}
              FOR UPDATE`,
        )
        const booking = (
          rows as unknown as Array<{ id: string; booking_number: string; status: BookingStatus }>
        )[0]

        if (!booking) {
          throw new BookingServiceError("not_found")
        }

        const now = new Date()
        const updates: Record<string, unknown> = {
          status: data.status,
          updatedAt: now,
        }
        if (data.status === "confirmed") updates.confirmedAt = now
        if (data.status === "expired") updates.expiredAt = now
        if (data.status === "cancelled") updates.cancelledAt = now
        if (data.status === "completed") updates.completedAt = now

        const [row] = await tx.update(bookings).set(updates).where(eq(bookings.id, id)).returning()

        await tx.insert(bookingActivityLog).values({
          bookingId: id,
          actorId: userId ?? "system",
          activityType: "status_overridden",
          description: `Booking status overridden from ${booking.status} to ${data.status}`,
          metadata: {
            oldStatus: booking.status,
            newStatus: data.status,
            reason: data.reason,
          },
        })

        if (data.note) {
          await tx.insert(bookingNotes).values({
            bookingId: id,
            authorId: userId ?? "system",
            content: data.note,
          })
        }

        return {
          status: "ok" as const,
          booking: row ?? null,
          fromStatus: booking.status,
          toStatus: data.status,
        }
      })

      if (result.status === "ok" && result.booking) {
        await runtime.eventBus?.emit(
          "booking.status_overridden",
          {
            bookingId: result.booking.id,
            bookingNumber: result.booking.bookingNumber,
            fromStatus: result.fromStatus,
            toStatus: result.toStatus,
            reason: data.reason,
            actorId: userId ?? null,
          } satisfies BookingStatusOverriddenEvent,
          { category: "domain", source: "service" },
        )
      }

      return { status: result.status, booking: result.booking }
    } catch (error) {
      if (error instanceof BookingServiceError) {
        return { status: error.code as Exclude<string, "ok"> }
      }
      throw error
    }
  },

  listTravelerRecords(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingTravelers)
      .where(eq(bookingTravelers.bookingId, bookingId))
      .orderBy(desc(bookingTravelers.isPrimary), asc(bookingTravelers.createdAt))
  },

  async getTravelerRecordById(db: PostgresJsDatabase, bookingId: string, travelerId: string) {
    const [row] = await db
      .select()
      .from(bookingTravelers)
      .where(and(eq(bookingTravelers.id, travelerId), eq(bookingTravelers.bookingId, bookingId)))
      .limit(1)

    return row ?? null
  },

  async createTravelerRecord(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateTravelerRecordInput,
    userId?: string,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const [row] = await db
      .insert(bookingTravelers)
      .values({
        bookingId,
        personId: data.personId ?? null,
        participantType: data.participantType,
        travelerCategory: data.travelerCategory ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        preferredLanguage: data.preferredLanguage ?? null,
        specialRequests: data.specialRequests ?? null,
        isPrimary: data.isPrimary ?? false,
        notes: data.notes ?? null,
      })
      .returning()

    if (!row) {
      return null
    }

    await ensureParticipantFlags(db, bookingId, row.id, data)

    await db.insert(bookingActivityLog).values({
      bookingId,
      actorId: userId ?? "system",
      activityType: "passenger_update",
      description: `Participant ${data.firstName} ${data.lastName} added`,
      metadata: { travelerId: row.id, participantType: data.participantType },
    })

    return row
  },

  async updateTravelerRecord(
    db: PostgresJsDatabase,
    travelerId: string,
    data: UpdateTravelerRecordInput,
  ) {
    const [row] = await db
      .update(bookingTravelers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookingTravelers.id, travelerId))
      .returning()

    if (!row) {
      return null
    }

    await ensureParticipantFlags(db, row.bookingId, row.id, data)

    return row
  },

  /**
   * Create a traveler row and persist the encrypted travel-details envelope in
   * a single call. Migration boundary helper for consumers coming from the
   * pre-0.10 `createTravelerRecord({ ..., accessibilityNeeds, ... })` shape:
   * the storage split (plaintext columns + encrypted bucket) is preserved, but
   * the call ergonomics collapse back to one flat payload. Plaintext fields go
   * to `createTravelerRecord`; encrypted fields are forwarded to
   * `pii.upsertTravelerTravelDetails`. Operations are sequential, not
   * transactional — a failure in the encrypted-fields write leaves the
   * plaintext row in place (matching the pre-helper two-call protocol).
   */
  async createTravelerWithTravelDetails(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateTravelerWithTravelDetailsInput,
    opts: {
      pii: BookingPiiService
      userId?: string
      actorId?: string | null
      /**
       * Optional resolver invoked when `data.personId` is set. Returns
       * a plaintext snapshot of dietary / accessibility / primary
       * passport from the linked person record. Snapshot fields fill
       * gaps in `data` only — explicit input always wins. Templates
       * wire this from `crmService.loadPersonTravelSnapshot`.
       */
      resolveTravelSnapshot?: (personId: string) => Promise<BookingTravelerSnapshot | null>
    },
  ) {
    const traveler = await this.createTravelerRecord(
      db,
      bookingId,
      {
        personId: data.personId,
        participantType: data.participantType,
        travelerCategory: data.travelerCategory,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        preferredLanguage: data.preferredLanguage,
        specialRequests: data.specialRequests,
        isPrimary: data.isPrimary,
        notes: data.notes,
      },
      opts.userId,
    )
    if (!traveler) {
      return null
    }

    let travelDetailInput = pickTravelDetailFields(data)
    if (data.personId && opts.resolveTravelSnapshot) {
      const snapshot = await opts.resolveTravelSnapshot(data.personId)
      travelDetailInput = applyTravelDetailSnapshot(travelDetailInput, snapshot)
    }

    const travelDetails = await opts.pii.upsertTravelerTravelDetails(
      db,
      traveler.id,
      travelDetailInput,
      opts.actorId,
    )

    return { traveler, travelDetails }
  },

  /**
   * Update a traveler row and (re-)upsert the encrypted travel-details
   * envelope in a single call. Same migration-ergonomics motivation as
   * `createTravelerWithTravelDetails`. Undefined fields are not written;
   * `null` clears a column / encrypted field.
   */
  async updateTravelerWithTravelDetails(
    db: PostgresJsDatabase,
    travelerId: string,
    data: UpdateTravelerWithTravelDetailsInput,
    opts: {
      pii: BookingPiiService
      actorId?: string | null
    },
  ) {
    const traveler = await this.updateTravelerRecord(db, travelerId, {
      personId: data.personId,
      participantType: data.participantType,
      travelerCategory: data.travelerCategory,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      preferredLanguage: data.preferredLanguage,
      specialRequests: data.specialRequests,
      isPrimary: data.isPrimary,
      notes: data.notes,
    })
    if (!traveler) {
      return null
    }

    const travelDetails = await opts.pii.upsertTravelerTravelDetails(
      db,
      traveler.id,
      pickTravelDetailFields(data),
      opts.actorId,
    )

    return { traveler, travelDetails }
  },

  async deleteTravelerRecord(db: PostgresJsDatabase, travelerId: string) {
    const [row] = await db
      .delete(bookingTravelers)
      .where(eq(bookingTravelers.id, travelerId))
      .returning({ id: bookingTravelers.id })

    return row ?? null
  },

  listTravelers(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingTravelers)
      .where(
        and(
          eq(bookingTravelers.bookingId, bookingId),
          or(...travelerParticipantTypes.map((type) => eq(bookingTravelers.participantType, type))),
        ),
      )
      .orderBy(asc(bookingTravelers.createdAt))
      .then((rows) => rows.map(toTravelerResponse))
  },

  async createTraveler(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateTravelerInput,
    userId?: string,
  ) {
    const row = await this.createTravelerRecord(
      db,
      bookingId,
      {
        participantType: "traveler",
        travelerCategory: data.travelerCategory ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        preferredLanguage: data.preferredLanguage ?? null,
        specialRequests: data.specialRequests ?? null,
        isPrimary: data.isPrimary ?? false,
        notes: data.notes ?? null,
      },
      userId,
    )
    return row ? toTravelerResponse(row) : null
  },

  async updateTraveler(db: PostgresJsDatabase, travelerId: string, data: UpdateTravelerInput) {
    const row = await this.updateTravelerRecord(db, travelerId, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      preferredLanguage: data.preferredLanguage ?? null,
      specialRequests: data.specialRequests ?? null,
      travelerCategory: data.travelerCategory ?? null,
      isPrimary: data.isPrimary ?? undefined,
      notes: data.notes ?? null,
    })
    return row ? toTravelerResponse(row) : null
  },

  async deleteTraveler(db: PostgresJsDatabase, travelerId: string) {
    return this.deleteTravelerRecord(db, travelerId)
  },

  listItems(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId))
      .orderBy(asc(bookingItems.createdAt))
  },

  /**
   * Re-derive `bookings.sellAmountCents` / `costAmountCents` from
   * `Σ(booking_items.total*AmountCents)`, plus — when the booking
   * declares a `baseCurrency` and `fxRateSetId` — re-derive
   * `baseSellAmountCents` / `baseCostAmountCents` by converting each
   * item's total via the FX rate set.
   *
   * Called automatically inside the item-mutation methods so callers
   * that go through `createItem` / `updateItem` / `deleteItem` never
   * have to remember to roll the parent. Public so external flows
   * (saga compensations, ad-hoc fix-ups) can also invoke it.
   *
   * Pass a tx-bound `db` to compose with an existing transaction; this
   * method does NOT wrap its own transaction.
   *
   * **FX rollup behaviour**:
   *
   * - Single-currency booking (every item's `sellCurrency === baseCurrency`,
   *   or `baseCurrency === sellCurrency` on the parent): `base*Cents`
   *   equal `sell*Cents` / `cost*Cents` directly. No FX lookup needed.
   * - Multi-currency booking with `fxRateSetId`: every item is
   *   converted to `baseCurrency` via `exchange_rates`. If any item's
   *   currency is missing from the rate set, the FX rollup short-circuits
   *   with `fxStatus: "missing_rate"` and `base*Cents` are LEFT
   *   UNCHANGED on the parent (caller chooses whether to abort).
   * - No `baseCurrency` configured: FX rollup is skipped entirely
   *   (`fxStatus: "skipped"`), and `base*Cents` stay null.
   *
   * Returns `{ sellAmountCents, costAmountCents, baseSellAmountCents,
   * baseCostAmountCents, fxStatus, missingCurrency? }` or `null` for a
   * missing booking.
   */
  async recomputeBookingTotal(db: PostgresJsDatabase, bookingId: string) {
    const [booking] = await db
      .select({
        id: bookings.id,
        sellCurrency: bookings.sellCurrency,
        baseCurrency: bookings.baseCurrency,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)
    if (!booking) {
      return null
    }

    const [totals] = await db
      .select({
        sellAmountCents: sql<number>`coalesce(sum(${bookingItems.totalSellAmountCents}), 0)::int`,
        costAmountCents: sql<number>`coalesce(sum(${bookingItems.totalCostAmountCents}), 0)::int`,
      })
      .from(bookingItems)
      .where(eq(bookingItems.bookingId, bookingId))

    const sellAmountCents = totals?.sellAmountCents ?? 0
    const costAmountCents = totals?.costAmountCents ?? 0

    // We need fxRateSetId from the bookings row plus per-item currency
    // for the FX rollup. Refetch with those columns.
    const [bookingForFx] = await db
      .select({
        baseCurrency: bookings.baseCurrency,
        sellCurrency: bookings.sellCurrency,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    let fxStatus: "ok" | "skipped" | "missing_rate" = "skipped"
    let baseSellAmountCents: number | null = null
    let baseCostAmountCents: number | null = null
    let missingCurrency: string | null = null

    const baseCurrency = bookingForFx?.baseCurrency ?? null
    if (baseCurrency) {
      const fxResult = await rollupBaseTotals(db, bookingId, baseCurrency)
      if (fxResult.status === "ok") {
        fxStatus = "ok"
        baseSellAmountCents = fxResult.baseSellAmountCents
        baseCostAmountCents = fxResult.baseCostAmountCents
      } else if (fxResult.status === "missing_rate") {
        fxStatus = "missing_rate"
        missingCurrency = fxResult.currency
      }
    }

    const patch: Record<string, unknown> = {
      sellAmountCents,
      costAmountCents,
      updatedAt: new Date(),
    }
    if (fxStatus === "ok") {
      patch.baseSellAmountCents = baseSellAmountCents
      patch.baseCostAmountCents = baseCostAmountCents
    }

    await db.update(bookings).set(patch).where(eq(bookings.id, bookingId))

    return {
      sellAmountCents,
      costAmountCents,
      baseSellAmountCents,
      baseCostAmountCents,
      fxStatus,
      ...(missingCurrency ? { missingCurrency } : {}),
    }
  },

  async createItem(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateBookingItemInput,
    userId?: string,
  ) {
    return db.transaction(async (tx) => {
      const [booking] = await tx
        .select({ id: bookings.id, sellCurrency: bookings.sellCurrency })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)

      if (!booking) {
        return null
      }

      const [row] = await tx
        .insert(bookingItems)
        .values({
          bookingId,
          title: data.title,
          description: data.description ?? null,
          itemType: data.itemType,
          status: data.status,
          serviceDate: data.serviceDate ?? null,
          startsAt: toTimestamp(data.startsAt),
          endsAt: toTimestamp(data.endsAt),
          quantity: data.quantity,
          sellCurrency: data.sellCurrency ?? booking.sellCurrency,
          unitSellAmountCents: data.unitSellAmountCents ?? null,
          totalSellAmountCents: data.totalSellAmountCents ?? null,
          costCurrency: data.costCurrency ?? null,
          unitCostAmountCents: data.unitCostAmountCents ?? null,
          totalCostAmountCents: data.totalCostAmountCents ?? null,
          notes: data.notes ?? null,
          productId: data.productId ?? null,
          optionId: data.optionId ?? null,
          optionUnitId: data.optionUnitId ?? null,
          pricingCategoryId: data.pricingCategoryId ?? null,
          sourceSnapshotId: data.sourceSnapshotId ?? null,
          sourceOfferId: data.sourceOfferId ?? null,
          metadata: data.metadata ?? null,
        })
        .returning()

      if (!row) {
        return null
      }

      await tx.insert(bookingActivityLog).values({
        bookingId,
        actorId: userId ?? "system",
        activityType: "item_update",
        description: `Booking item "${data.title}" added`,
        metadata: { bookingItemId: row.id, itemType: data.itemType },
      })

      await bookingsService.recomputeBookingTotal(tx as PostgresJsDatabase, bookingId)

      return row
    })
  },

  async updateItem(db: PostgresJsDatabase, itemId: string, data: UpdateBookingItemInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(bookingItems)
        .set({
          ...data,
          startsAt: data.startsAt === undefined ? undefined : toTimestamp(data.startsAt),
          endsAt: data.endsAt === undefined ? undefined : toTimestamp(data.endsAt),
          updatedAt: new Date(),
        })
        .where(eq(bookingItems.id, itemId))
        .returning()

      if (!row) return null

      await bookingsService.recomputeBookingTotal(tx as PostgresJsDatabase, row.bookingId)
      return row
    })
  },

  async deleteItem(db: PostgresJsDatabase, itemId: string) {
    return db.transaction(async (tx) => {
      // Look up the parent booking BEFORE the delete so we can roll up
      // afterwards.
      const [item] = await tx
        .select({ bookingId: bookingItems.bookingId })
        .from(bookingItems)
        .where(eq(bookingItems.id, itemId))
        .limit(1)

      const [row] = await tx
        .delete(bookingItems)
        .where(eq(bookingItems.id, itemId))
        .returning({ id: bookingItems.id })

      if (item) {
        await bookingsService.recomputeBookingTotal(tx as PostgresJsDatabase, item.bookingId)
      }

      return row ?? null
    })
  },

  listItemParticipants(db: PostgresJsDatabase, itemId: string) {
    return db
      .select()
      .from(bookingItemTravelers)
      .where(eq(bookingItemTravelers.bookingItemId, itemId))
      .orderBy(desc(bookingItemTravelers.isPrimary), asc(bookingItemTravelers.createdAt))
  },

  async addItemParticipant(
    db: PostgresJsDatabase,
    itemId: string,
    data: CreateBookingItemParticipantInput,
  ) {
    const [item] = await db
      .select({ id: bookingItems.id })
      .from(bookingItems)
      .where(eq(bookingItems.id, itemId))
      .limit(1)

    if (!item) {
      return null
    }

    const [traveler] = await db
      .select({ id: bookingTravelers.id })
      .from(bookingTravelers)
      .where(eq(bookingTravelers.id, data.travelerId))
      .limit(1)

    if (!traveler) {
      return null
    }

    if (data.isPrimary) {
      await db
        .update(bookingItemTravelers)
        .set({ isPrimary: false })
        .where(eq(bookingItemTravelers.bookingItemId, itemId))
    }

    const [row] = await db
      .insert(bookingItemTravelers)
      .values({
        bookingItemId: itemId,
        travelerId: data.travelerId,
        role: data.role,
        isPrimary: data.isPrimary ?? false,
      })
      .returning()

    return row
  },

  async removeItemParticipant(db: PostgresJsDatabase, linkId: string) {
    const [row] = await db
      .delete(bookingItemTravelers)
      .where(eq(bookingItemTravelers.id, linkId))
      .returning({ id: bookingItemTravelers.id })

    return row ?? null
  },

  listSupplierStatuses(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingSupplierStatuses)
      .where(eq(bookingSupplierStatuses.bookingId, bookingId))
      .orderBy(asc(bookingSupplierStatuses.createdAt))
  },

  async createSupplierStatus(
    db: PostgresJsDatabase,
    bookingId: string,
    data: {
      supplierServiceId?: string | null
      serviceName: string
      status?: "pending" | "confirmed" | "rejected" | "cancelled"
      supplierReference?: string | null
      costCurrency: string
      costAmountCents: number
      notes?: string | null
    },
    userId?: string,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const [row] = await db
      .insert(bookingSupplierStatuses)
      .values({
        bookingId,
        supplierServiceId: data.supplierServiceId ?? null,
        serviceName: data.serviceName,
        status: data.status ?? "pending",
        supplierReference: data.supplierReference ?? null,
        costCurrency: data.costCurrency,
        costAmountCents: data.costAmountCents,
        notes: data.notes ?? null,
        confirmedAt: data.status === "confirmed" ? new Date() : null,
      })
      .returning()

    await db.insert(bookingActivityLog).values({
      bookingId,
      actorId: userId ?? "system",
      activityType: "supplier_update",
      description: `Supplier status for "${data.serviceName}" added`,
    })

    return row ?? null
  },

  async updateSupplierStatus(
    db: PostgresJsDatabase,
    bookingId: string,
    statusId: string,
    data: {
      supplierServiceId?: string | null
      serviceName?: string
      status?: "pending" | "confirmed" | "rejected" | "cancelled"
      supplierReference?: string | null
      costCurrency?: string
      costAmountCents?: number
      notes?: string | null
      confirmedAt?: string | null
    },
    userId?: string,
  ) {
    const updateData: Record<string, unknown> = {
      ...data,
      supplierServiceId: data.supplierServiceId ?? undefined,
      supplierReference: data.supplierReference ?? undefined,
      confirmedAt:
        data.confirmedAt !== undefined
          ? toTimestamp(data.confirmedAt)
          : data.status === "confirmed"
            ? new Date()
            : undefined,
      updatedAt: new Date(),
    }

    const [row] = await db
      .update(bookingSupplierStatuses)
      .set(updateData)
      .where(eq(bookingSupplierStatuses.id, statusId))
      .returning()

    if (!row) {
      return null
    }

    if (data.status) {
      await db.insert(bookingActivityLog).values({
        bookingId,
        actorId: userId ?? "system",
        activityType: "supplier_update",
        description: `Supplier "${row.serviceName}" status updated to ${data.status}`,
        metadata: { supplierStatusId: statusId, newStatus: data.status },
      })
    }

    return row
  },

  listFulfillments(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingFulfillments)
      .where(eq(bookingFulfillments.bookingId, bookingId))
      .orderBy(desc(bookingFulfillments.createdAt))
  },

  async issueFulfillment(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateBookingFulfillmentInput,
    userId?: string,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const scoped = await ensureBookingScopedLinks(db, bookingId, data)
    if (!scoped.ok) {
      return null
    }

    const status = data.status ?? "issued"
    const issuedAt =
      data.issuedAt !== undefined
        ? toTimestamp(data.issuedAt)
        : status === "issued" || status === "reissued"
          ? new Date()
          : null
    const revokedAt =
      data.revokedAt !== undefined
        ? toTimestamp(data.revokedAt)
        : status === "revoked"
          ? new Date()
          : null

    const [row] = await db
      .insert(bookingFulfillments)
      .values({
        bookingId,
        bookingItemId: data.bookingItemId ?? null,
        travelerId: data.travelerId ?? null,
        fulfillmentType: data.fulfillmentType,
        deliveryChannel: data.deliveryChannel,
        status,
        artifactUrl: data.artifactUrl ?? null,
        payload: data.payload ?? null,
        issuedAt,
        revokedAt,
      })
      .returning()

    await db.insert(bookingActivityLog).values({
      bookingId,
      actorId: userId ?? "system",
      activityType: "fulfillment_issued",
      description: `Booking fulfillment issued as ${data.fulfillmentType}`,
      metadata: {
        fulfillmentId: row?.id ?? null,
        bookingItemId: data.bookingItemId ?? null,
        travelerId: data.travelerId ?? null,
        status,
      },
    })

    return row ?? null
  },

  async updateFulfillment(
    db: PostgresJsDatabase,
    bookingId: string,
    fulfillmentId: string,
    data: UpdateBookingFulfillmentInput,
    userId?: string,
  ) {
    const [existing] = await db
      .select({ id: bookingFulfillments.id })
      .from(bookingFulfillments)
      .where(
        and(
          eq(bookingFulfillments.id, fulfillmentId),
          eq(bookingFulfillments.bookingId, bookingId),
        ),
      )
      .limit(1)

    if (!existing) {
      return null
    }

    const scoped = await ensureBookingScopedLinks(db, bookingId, data)
    if (!scoped.ok) {
      return null
    }

    const nextStatus = data.status
    const [row] = await db
      .update(bookingFulfillments)
      .set({
        bookingItemId: data.bookingItemId === undefined ? undefined : (data.bookingItemId ?? null),
        travelerId: data.travelerId === undefined ? undefined : (data.travelerId ?? null),
        fulfillmentType: data.fulfillmentType,
        deliveryChannel: data.deliveryChannel,
        status: nextStatus,
        artifactUrl: data.artifactUrl === undefined ? undefined : (data.artifactUrl ?? null),
        payload: data.payload === undefined ? undefined : (data.payload ?? null),
        issuedAt:
          data.issuedAt !== undefined
            ? toTimestamp(data.issuedAt)
            : nextStatus === "issued" || nextStatus === "reissued"
              ? new Date()
              : undefined,
        revokedAt:
          data.revokedAt !== undefined
            ? toTimestamp(data.revokedAt)
            : nextStatus === "revoked"
              ? new Date()
              : undefined,
        updatedAt: new Date(),
      })
      .where(eq(bookingFulfillments.id, fulfillmentId))
      .returning()

    if (row) {
      await db.insert(bookingActivityLog).values({
        bookingId,
        actorId: userId ?? "system",
        activityType: "fulfillment_updated",
        description: `Booking fulfillment ${fulfillmentId} updated`,
        metadata: {
          fulfillmentId,
          bookingItemId: row.bookingItemId,
          travelerId: row.travelerId,
          status: row.status,
        },
      })
    }

    return row ?? null
  },

  listRedemptionEvents(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingRedemptionEvents)
      .where(eq(bookingRedemptionEvents.bookingId, bookingId))
      .orderBy(desc(bookingRedemptionEvents.redeemedAt), desc(bookingRedemptionEvents.createdAt))
  },

  async recordRedemption(
    db: PostgresJsDatabase,
    bookingId: string,
    data: RecordBookingRedemptionInput,
    userId?: string,
  ) {
    return db.transaction(async (tx) => {
      const [booking] = await tx
        .select({
          id: bookings.id,
          redeemedAt: bookings.redeemedAt,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)

      if (!booking) {
        return null
      }

      const scoped = await ensureBookingScopedLinks(tx as PostgresJsDatabase, bookingId, data)
      if (!scoped.ok) {
        return null
      }

      const redeemedAt = toTimestamp(data.redeemedAt) ?? new Date()

      const [event] = await tx
        .insert(bookingRedemptionEvents)
        .values({
          bookingId,
          bookingItemId: data.bookingItemId ?? null,
          travelerId: data.travelerId ?? null,
          redeemedAt,
          redeemedBy: data.redeemedBy ?? userId ?? null,
          location: data.location ?? null,
          method: data.method,
          metadata: data.metadata ?? null,
        })
        .returning()

      if (!booking.redeemedAt || booking.redeemedAt < redeemedAt) {
        await tx
          .update(bookings)
          .set({
            redeemedAt,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, bookingId))
      }

      if (data.bookingItemId) {
        await tx
          .update(bookingItems)
          .set({
            status: "fulfilled",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(bookingItems.id, data.bookingItemId),
              eq(bookingItems.bookingId, bookingId),
              or(
                eq(bookingItems.status, "confirmed"),
                eq(bookingItems.status, "on_hold"),
                eq(bookingItems.status, "draft"),
              ),
            ),
          )

        await tx
          .update(bookingAllocations)
          .set({
            status: "fulfilled",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(bookingAllocations.bookingId, bookingId),
              eq(bookingAllocations.bookingItemId, data.bookingItemId),
              or(eq(bookingAllocations.status, "held"), eq(bookingAllocations.status, "confirmed")),
            ),
          )
      }

      await tx.insert(bookingActivityLog).values({
        bookingId,
        actorId: userId ?? "system",
        activityType: "redemption_recorded",
        description: "Booking redemption recorded",
        metadata: {
          redemptionEventId: event?.id ?? null,
          bookingItemId: data.bookingItemId ?? null,
          travelerId: data.travelerId ?? null,
          redeemedAt: redeemedAt.toISOString(),
          method: data.method,
        },
      })

      await syncTransactionOnBookingRedeemed(tx as PostgresJsDatabase, bookingId)

      return event ?? null
    })
  },

  listActivity(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingActivityLog)
      .where(eq(bookingActivityLog.bookingId, bookingId))
      .orderBy(desc(bookingActivityLog.createdAt))
  },

  listNotes(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingNotes)
      .where(eq(bookingNotes.bookingId, bookingId))
      .orderBy(bookingNotes.createdAt)
  },

  async createNote(
    db: PostgresJsDatabase,
    bookingId: string,
    userId: string,
    data: CreateBookingNoteInput,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const [row] = await db
      .insert(bookingNotes)
      .values({
        bookingId,
        authorId: userId,
        content: data.content,
      })
      .returning()

    await db.insert(bookingActivityLog).values({
      bookingId,
      actorId: userId,
      activityType: "note_added",
      description: "Note added",
    })

    return row
  },

  async deleteNote(db: PostgresJsDatabase, noteId: string) {
    const [row] = await db
      .delete(bookingNotes)
      .where(eq(bookingNotes.id, noteId))
      .returning({ id: bookingNotes.id })

    return row ?? null
  },

  listDocuments(db: PostgresJsDatabase, bookingId: string) {
    return db
      .select()
      .from(bookingDocuments)
      .where(eq(bookingDocuments.bookingId, bookingId))
      .orderBy(bookingDocuments.createdAt)
  },

  async createDocument(
    db: PostgresJsDatabase,
    bookingId: string,
    data: CreateBookingDocumentInput,
  ) {
    const [booking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (!booking) {
      return null
    }

    const [row] = await db
      .insert(bookingDocuments)
      .values({
        bookingId,
        travelerId: data.travelerId ?? null,
        type: data.type,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        notes: data.notes ?? null,
      })
      .returning()

    return row
  },

  async deleteDocument(db: PostgresJsDatabase, documentId: string) {
    const [row] = await db
      .delete(bookingDocuments)
      .where(eq(bookingDocuments.id, documentId))
      .returning({ id: bookingDocuments.id })

    return row ?? null
  },
}
