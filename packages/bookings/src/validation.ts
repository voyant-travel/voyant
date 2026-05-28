import { typeIdSchemas } from "@voyantjs/db/lib/typeid"
import { z } from "zod"

import {
  bookingTravelerBedPreferenceSchema,
  travelerAllocationMapSchema,
} from "./schema/travel-details.js"
import {
  bookingAllocationStatusSchema,
  bookingAllocationTypeSchema,
  bookingDocumentTypeSchema,
  bookingFulfillmentDeliveryChannelSchema,
  bookingFulfillmentStatusSchema,
  bookingFulfillmentTypeSchema,
  bookingItemParticipantRoleSchema,
  bookingItemStatusSchema,
  bookingItemTypeSchema,
  bookingParticipantTypeSchema,
  bookingRedemptionMethodSchema,
  bookingSourceTypeSchema,
  bookingStatusSchema,
  bookingTravelerCategorySchema,
  supplierConfirmationStatusSchema,
} from "./validation-shared.js"

// ---------- bookings ----------

const bookingDepositRuleSchema = z.object({
  kind: z.enum(["none", "percent", "fixed_cents"]),
  percent: z.number().min(0).max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
})

const bookingCustomerPaymentPolicySchema = z.object({
  deposit: bookingDepositRuleSchema,
  minDaysBeforeDepartureForDeposit: z.number().int().min(0),
  balanceDueDaysBeforeDeparture: z.number().int().min(0),
  balanceDueMinDaysFromNow: z.number().int().min(0),
})

export const bookingPriceOverrideSchema = z.object({
  isManual: z.literal(true),
  originalAmountCents: z.number().int().min(0).nullable(),
  overriddenAmountCents: z.number().int().min(0),
  currency: z.string().min(3).max(3),
  reason: z.string().trim().min(1).max(1000),
  overriddenBy: z.string().min(1),
  overriddenAt: z.string().datetime(),
})

const bookingBillingPersonIdSchema = typeIdSchemas.person.optional().nullable()
const bookingBillingOrganizationIdSchema = typeIdSchemas.organization.optional().nullable()

function validateExclusiveBillingParty(
  value: { personId?: string | null; organizationId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (!value.personId || !value.organizationId) return

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["organizationId"],
    message: "Billing party must be either personId or organizationId, not both",
  })
}

const bookingCoreSchema = z.object({
  bookingNumber: z.string().min(1).max(50),
  status: bookingStatusSchema.default("draft"),
  personId: bookingBillingPersonIdSchema,
  organizationId: bookingBillingOrganizationIdSchema,
  sourceType: bookingSourceTypeSchema.default("manual"),
  externalBookingRef: z.string().optional().nullable(),
  communicationLanguage: z.string().max(35).optional().nullable(),
  contactFirstName: z.string().max(255).optional().nullable(),
  contactLastName: z.string().max(255).optional().nullable(),
  contactPartyType: z.enum(["individual", "company"]).optional().nullable(),
  contactTaxId: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  contactPreferredLanguage: z.string().max(35).optional().nullable(),
  contactCountry: z.string().max(100).optional().nullable(),
  contactRegion: z.string().max(255).optional().nullable(),
  contactCity: z.string().max(255).optional().nullable(),
  contactAddressLine1: z.string().max(255).optional().nullable(),
  contactAddressLine2: z.string().max(255).optional().nullable(),
  contactPostalCode: z.string().max(50).optional().nullable(),
  sellCurrency: z.string().min(3).max(3),
  baseCurrency: z.string().min(3).max(3).optional().nullable(),
  sellAmountCents: z.number().int().min(0).optional().nullable(),
  baseSellAmountCents: z.number().int().min(0).optional().nullable(),
  costAmountCents: z.number().int().min(0).optional().nullable(),
  baseCostAmountCents: z.number().int().min(0).optional().nullable(),
  marginPercent: z.number().int().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  pax: z.number().int().positive().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  customerPaymentPolicy: bookingCustomerPaymentPolicySchema.optional().nullable(),
  priceOverride: bookingPriceOverrideSchema.optional().nullable(),
  holdExpiresAt: z.string().datetime().optional().nullable(),
  confirmedAt: z.string().datetime().optional().nullable(),
  expiredAt: z.string().datetime().optional().nullable(),
  cancelledAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  redeemedAt: z.string().datetime().optional().nullable(),
})

export const insertBookingSchema = bookingCoreSchema.superRefine(validateExclusiveBillingParty)
export const updateBookingSchema = bookingCoreSchema
  .partial()
  .superRefine(validateExclusiveBillingParty)

export const createBookingSchema = bookingCoreSchema
  .extend({
    sourceType: z.enum(["manual", "internal"]).default("manual"),
  })
  .refine((value) => value.status !== "on_hold", {
    message: "Use the reservation flow to create on-hold bookings",
    path: ["status"],
  })
  .refine((value) => value.holdExpiresAt == null, {
    message: "Use the reservation flow to manage booking hold expiry",
    path: ["holdExpiresAt"],
  })
  .superRefine(validateExclusiveBillingParty)

export const bookingListSortFieldSchema = z.enum([
  "bookingNumber",
  "status",
  "sellAmount",
  "pax",
  "startDate",
  "endDate",
  "createdAt",
])

export const bookingListSortDirSchema = z.enum(["asc", "desc"])

export const bookingListQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
  /**
   * Statuses to omit from the result. Lets the operator list page hide
   * noise (draft + expired by default) without forcing a separate
   * endpoint. The wire format is a comma-separated string (e.g.
   * `?excludeStatuses=draft,expired`) — query parsing collapses
   * repeated keys, so a list has to ride on a single param. The
   * preprocess hook splits + trims; the union then validates each
   * entry against the enum.
   */
  excludeStatuses: z.preprocess((value) => {
    if (typeof value !== "string" || !value.includes(",")) return value
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  }, z.union([bookingStatusSchema, z.array(bookingStatusSchema)]).optional()),
  search: z.string().optional(),
  productId: z.string().optional(),
  optionId: z.string().optional(),
  /**
   * Filter to bookings whose items reference this availability slot
   * (post-0026, items carry `availability_slot_id` directly). Scoped
   * to a specific departure so the operator can answer "who's on this
   * 28-May 09:00 sailing?" from the list page.
   */
  availabilitySlotId: z.string().optional(),
  supplierId: z.string().optional(),
  productCategoryId: z.string().optional(),
  personId: z.string().optional(),
  organizationId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  paxMin: z.coerce.number().int().min(0).optional(),
  paxMax: z.coerce.number().int().min(0).optional(),
  sortBy: bookingListSortFieldSchema.default("createdAt"),
  sortDir: bookingListSortDirSchema.default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const bookingAggregatesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /**
   * Cap on the number of upcoming-departure rows returned alongside
   * the count. The dashboard uses 8; we allow up to 20 so adjacent
   * dashboards / digests can share the endpoint.
   */
  upcomingLimit: z.coerce.number().int().min(0).max(20).default(8),
})

export const sharingGroupsForSlotQuerySchema = z.object({
  slotId: z.string().min(1),
})

export const convertProductSchema = z
  .object({
    productId: z.string().min(1),
    optionId: z.string().optional().nullable(),
    slotId: z.string().optional().nullable(),
    bookingNumber: z.string().min(1).max(50),
    personId: bookingBillingPersonIdSchema,
    organizationId: bookingBillingOrganizationIdSchema,
    pax: z.number().int().positive().optional().nullable(),
    internalNotes: z.string().optional().nullable(),
    /**
     * Override the seed `sellAmountCents` on the new booking + line item.
     * When unset, the converter uses `product.sellAmountCents` as before.
     * Used by the catalog booking-engine when promotional offers are
     * applied to the quote — the discounted base flows through here so
     * the booking row's payable amount reflects the customer-shown total
     * (per docs/architecture/promotions-architecture.md §7.1).
     */
    sellAmountCentsOverride: z.number().int().min(0).optional().nullable(),
    /**
     * Catalog-resolved preview total shown to the operator. Unlike
     * `sellAmountCentsOverride`, this is not a promotion adjustment; it lets
     * the create flow seed the booking total from the pricing preview even
     * when the legacy product row has no static price.
     */
    catalogSellAmountCents: z.number().int().min(0).optional().nullable(),
    /**
     * Operator-confirmed booking total. If it differs from the catalog preview
     * (or there was no catalog preview), `priceOverrideReason` is required and
     * the service stamps an audit payload onto `bookings.price_override`.
     */
    confirmedSellAmountCents: z.number().int().min(0).optional().nullable(),
    priceOverrideReason: z.string().trim().min(1).max(1000).optional().nullable(),
    /**
     * Initial status to insert with — defaults to `draft`. Lets the booking-
     * create flow commit straight to `confirmed` or `awaiting_payment` in
     * one transaction instead of doing a `create-then-flip` dance that's
     * vulnerable to a window where the second request can't see the just-
     * committed booking row. When set to `confirmed`, the caller is
     * responsible for emitting the matching `booking.confirmed` event.
     */
    initialStatus: bookingStatusSchema.optional(),
    /**
     * Billing-contact snapshot. Captures who the operator was billing
     * at create time so the booking detail page renders the right
     * payer even if the linked CRM person/organization changes later
     * (or is hard-deleted). All fields optional — the create flow can
     * pass a partial snapshot when only some details are known.
     */
    contactFirstName: z.string().max(255).optional().nullable(),
    contactLastName: z.string().max(255).optional().nullable(),
    contactPartyType: z.enum(["individual", "company"]).optional().nullable(),
    contactTaxId: z.string().max(100).optional().nullable(),
    contactEmail: z.string().max(255).optional().nullable(),
    contactPhone: z.string().max(50).optional().nullable(),
    contactPreferredLanguage: z.string().max(35).optional().nullable(),
    contactCountry: z.string().max(2).optional().nullable(),
    contactRegion: z.string().max(100).optional().nullable(),
    contactCity: z.string().max(100).optional().nullable(),
    contactAddressLine1: z.string().max(500).optional().nullable(),
    contactAddressLine2: z.string().max(500).optional().nullable(),
    contactPostalCode: z.string().max(20).optional().nullable(),
    itemLines: z
      .array(
        z.object({
          /**
           * Stable client-side key (e.g. `unit:optu_adult`). Stamped
           * into the inserted booking_item's
           * `metadata.bookingCreateLineKey` so the orchestrator can
           * link items to travelers via `booking_item_travelers`.
           * See voyantjs/voyant#1267.
           */
          clientLineKey: z.string().min(1).max(255).optional().nullable(),
          optionId: z.string().min(1).optional().nullable(),
          optionUnitId: z.string().min(1),
          quantity: z.number().int().min(1),
          title: z.string().min(1).max(255).optional().nullable(),
          description: z.string().max(5000).optional().nullable(),
          unitSellAmountCents: z.number().int().min(0).optional().nullable(),
          totalSellAmountCents: z.number().int().min(0).optional().nullable(),
          travelerKeys: z.array(z.string().min(1).max(255)).optional().nullable(),
          travelerIndexes: z.array(z.number().int().min(0)).optional().nullable(),
        }),
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    validateExclusiveBillingParty(value, ctx)

    if (value.confirmedSellAmountCents == null) return
    if (value.catalogSellAmountCents === value.confirmedSellAmountCents) return
    if (value.priceOverrideReason) return

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["priceOverrideReason"],
      message:
        "A price override reason is required when the confirmed total differs from catalog pricing",
    })
  })

/**
 * Admin pricing-preview request. Mirrors the storefront pricing session
 * resolver input so the operator dialog sees the same numbers the customer
 * would see for the same product + option + catalog.
 */
export const pricingPreviewSchema = z.object({
  productId: z.string().min(1),
  optionId: z.string().optional().nullable(),
  catalogId: z.string().optional().nullable(),
})

export const reserveBookingItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  itemType: bookingItemTypeSchema.default("unit"),
  quantity: z.number().int().positive().default(1),
  sellCurrency: z.string().min(3).max(3).optional().nullable(),
  unitSellAmountCents: z.number().int().min(0).optional().nullable(),
  totalSellAmountCents: z.number().int().min(0).optional().nullable(),
  costCurrency: z.string().min(3).max(3).optional().nullable(),
  unitCostAmountCents: z.number().int().min(0).optional().nullable(),
  totalCostAmountCents: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  optionId: z.string().optional().nullable(),
  optionUnitId: z.string().optional().nullable(),
  pricingCategoryId: z.string().optional().nullable(),
  productNameSnapshot: z.string().optional().nullable(),
  optionNameSnapshot: z.string().optional().nullable(),
  unitNameSnapshot: z.string().optional().nullable(),
  departureLabelSnapshot: z.string().optional().nullable(),
  sourceSnapshotId: z.string().optional().nullable(),
  sourceOfferId: z.string().optional().nullable(),
  availabilitySlotId: z.string().min(1),
  allocationType: bookingAllocationTypeSchema.default("unit"),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const reserveBookingSchema = bookingCoreSchema
  .omit({
    status: true,
    holdExpiresAt: true,
    confirmedAt: true,
    expiredAt: true,
    cancelledAt: true,
    completedAt: true,
    redeemedAt: true,
  })
  .extend({
    holdMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .optional(),
    holdExpiresAt: z.string().datetime().optional().nullable(),
    items: z.array(reserveBookingItemSchema).min(1),
  })
  .superRefine(validateExclusiveBillingParty)

export const extendBookingHoldSchema = z
  .object({
    holdMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .optional(),
    holdExpiresAt: z.string().datetime().optional().nullable(),
  })
  .refine((value) => value.holdMinutes !== undefined || value.holdExpiresAt !== undefined, {
    message: "holdMinutes or holdExpiresAt is required",
  })

export const confirmBookingSchema = z.object({
  note: z.string().optional().nullable(),
  /**
   * When true, downstream subscribers that send customer-facing
   * notifications (e.g. notifications module's `autoConfirmAndDispatch`)
   * skip dispatching for this confirmation. Lets the operator confirm a
   * booking internally without auto-sending a confirmation email.
   */
  suppressNotifications: z.boolean().optional(),
})

export const cancelBookingSchema = z.object({
  note: z.string().optional().nullable(),
})

export const expireBookingSchema = z.object({
  note: z.string().optional().nullable(),
})

export const expireStaleBookingsSchema = z.object({
  before: z.string().datetime().optional().nullable(),
  note: z.string().optional().nullable(),
})

export const startBookingSchema = z.object({
  note: z.string().optional().nullable(),
})

export const completeBookingSchema = z.object({
  note: z.string().optional().nullable(),
})

/**
 * Admin-only override: skips the transition graph. `reason` is required —
 * the operator has to explain why they're bypassing lifecycle laws. Use the
 * verb-specific endpoints (/confirm, /cancel, /start, /complete, /expire) for
 * normal state changes; this is for data-correction and exceptional cases.
 * Confirmed overrides emit `booking.confirmed` by default for create-dialog
 * compatibility; pass `suppressLifecycleEvents` for pure data correction.
 */
export const overrideBookingStatusSchema = z.object({
  status: bookingStatusSchema,
  reason: z.string().min(1).max(2000),
  note: z.string().optional().nullable(),
  /**
   * Same notification opt-out as `confirmBookingSchema.suppressNotifications`.
   * Only applies when the override path emits `booking.confirmed`.
   */
  suppressNotifications: z.boolean().optional(),
  /**
   * When true, skip verb-specific lifecycle events such as
   * `booking.confirmed`. The audit event `booking.status_overridden` still
   * emits either way.
   */
  suppressLifecycleEvents: z.boolean().optional(),
})

export const reserveBookingFromTransactionSchema = bookingCoreSchema
  .pick({
    bookingNumber: true,
    sourceType: true,
    contactFirstName: true,
    contactLastName: true,
    contactPartyType: true,
    contactTaxId: true,
    contactEmail: true,
    contactPhone: true,
    contactPreferredLanguage: true,
    contactCountry: true,
    contactRegion: true,
    contactCity: true,
    contactAddressLine1: true,
    contactAddressLine2: true,
    contactPostalCode: true,
    internalNotes: true,
  })
  .extend({
    sourceType: bookingSourceTypeSchema.default("internal"),
    holdMinutes: z
      .number()
      .int()
      .positive()
      .max(24 * 60)
      .optional(),
    holdExpiresAt: z.string().datetime().optional().nullable(),
    note: z.string().optional().nullable(),
    includeParticipants: z.boolean().default(true),
  })

// ---------- traveler records ----------

const travelerRecordCoreSchema = z.object({
  personId: z.string().optional().nullable(),
  participantType: bookingParticipantTypeSchema.default("traveler"),
  travelerCategory: bookingTravelerCategorySchema.optional().nullable(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  preferredLanguage: z.string().max(35).optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional().nullable(),
})

// ---------- travelers ----------

const travelerCoreSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  preferredLanguage: z.string().max(35).optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  travelerCategory: bookingTravelerCategorySchema.optional().nullable(),
  isPrimary: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const insertTravelerSchema = travelerCoreSchema
export const updateTravelerSchema = travelerCoreSchema.partial()
export const insertTravelerRecordSchema = travelerRecordCoreSchema
export const updateTravelerRecordSchema = travelerRecordCoreSchema.partial()

// ---------- traveler travel details ----------

export const upsertTravelerTravelDetailsSchema = z.object({
  nationality: z.string().max(100).optional().nullable(),
  documentType: z
    .enum(["passport", "id_card", "driver_license", "visa", "other"])
    .optional()
    .nullable(),
  documentNumber: z.string().max(255).optional().nullable(),
  documentExpiry: z.string().optional().nullable(),
  documentIssuingCountry: z.string().max(255).optional().nullable(),
  documentIssuingAuthority: z.string().max(255).optional().nullable(),
  /** Provenance pointer to the seeding `crm.person_documents` row. */
  documentPersonDocumentId: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  dietaryRequirements: z.string().optional().nullable(),
  accessibilityNeeds: z.string().optional().nullable(),
  isLeadTraveler: z.boolean().optional().nullable(),
  sharingGroupId: z.string().max(255).optional().nullable(),
  roomTypeId: z.string().max(255).optional().nullable(),
  bedPreference: bookingTravelerBedPreferenceSchema.optional().nullable(),
  allocations: travelerAllocationMapSchema.optional(),
})

// Flat shape combining plaintext traveler columns + encrypted travel-details
// fields, matching the pre-0.10 `createTravelerRecord` ergonomics. Migration
// boundary helper — see `bookingsService.createTravelerWithTravelDetails`.
export const createTravelerWithTravelDetailsSchema = travelerRecordCoreSchema.extend(
  upsertTravelerTravelDetailsSchema.shape,
)
export const updateTravelerWithTravelDetailsSchema = createTravelerWithTravelDetailsSchema.partial()

// ---------- booking items ----------

const bookingItemCoreSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  itemType: bookingItemTypeSchema.default("unit"),
  status: bookingItemStatusSchema.default("draft"),
  serviceDate: z.string().optional().nullable(),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  quantity: z.number().int().positive().default(1),
  sellCurrency: z.string().min(3).max(3),
  unitSellAmountCents: z.number().int().optional().nullable(),
  totalSellAmountCents: z.number().int().optional().nullable(),
  costCurrency: z.string().min(3).max(3).optional().nullable(),
  unitCostAmountCents: z.number().int().optional().nullable(),
  totalCostAmountCents: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  optionId: z.string().optional().nullable(),
  optionUnitId: z.string().optional().nullable(),
  pricingCategoryId: z.string().optional().nullable(),
  availabilitySlotId: z.string().optional().nullable(),
  // Catalog-snapshot overrides for catalog-less deployments (OTA case)
  // or when the caller wants to write a specific historical label. If
  // omitted, the service looks the values up from the catalog refs
  // using the foreign IDs.
  productNameSnapshot: z.string().optional().nullable(),
  optionNameSnapshot: z.string().optional().nullable(),
  unitNameSnapshot: z.string().optional().nullable(),
  departureLabelSnapshot: z.string().optional().nullable(),
  sourceSnapshotId: z.string().optional().nullable(),
  sourceOfferId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertBookingItemSchema = bookingItemCoreSchema
export const updateBookingItemSchema = bookingItemCoreSchema.partial()

export const insertBookingAllocationSchema = z.object({
  bookingItemId: z.string().min(1),
  productId: z.string().optional().nullable(),
  optionId: z.string().optional().nullable(),
  optionUnitId: z.string().optional().nullable(),
  pricingCategoryId: z.string().optional().nullable(),
  availabilitySlotId: z.string().optional().nullable(),
  quantity: z.number().int().positive().default(1),
  allocationType: bookingAllocationTypeSchema.default("unit"),
  status: bookingAllocationStatusSchema.default("held"),
  holdExpiresAt: z.string().datetime().optional().nullable(),
  confirmedAt: z.string().datetime().optional().nullable(),
  releasedAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const updateBookingAllocationSchema = insertBookingAllocationSchema.partial()

// ---------- booking fulfillments ----------

const bookingFulfillmentInputSchema = z.object({
  bookingItemId: z.string().optional().nullable(),
  travelerId: z.string().optional().nullable(),
  fulfillmentType: bookingFulfillmentTypeSchema,
  deliveryChannel: bookingFulfillmentDeliveryChannelSchema,
  status: bookingFulfillmentStatusSchema.default("issued"),
  artifactUrl: z.string().url().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
  revokedAt: z.string().datetime().optional().nullable(),
})

export const insertBookingFulfillmentSchema = bookingFulfillmentInputSchema.transform(
  ({ travelerId, ...rest }) => ({
    ...rest,
    travelerId: travelerId ?? null,
  }),
)

export const updateBookingFulfillmentSchema = bookingFulfillmentInputSchema
  .partial()
  .transform(({ travelerId, ...rest }) => ({
    ...rest,
    travelerId: travelerId !== undefined ? (travelerId ?? null) : undefined,
  }))

// ---------- booking redemption events ----------

export const recordBookingRedemptionSchema = z
  .object({
    bookingItemId: z.string().optional().nullable(),
    travelerId: z.string().optional().nullable(),
    redeemedAt: z.string().datetime().optional().nullable(),
    redeemedBy: z.string().max(255).optional().nullable(),
    location: z.string().max(500).optional().nullable(),
    method: bookingRedemptionMethodSchema.default("manual"),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .transform(({ travelerId, ...rest }) => ({
    ...rest,
    travelerId: travelerId ?? null,
  }))

// ---------- booking item participants ----------

export const insertBookingItemTravelerSchema = z
  .object({
    travelerId: z.string().min(1).optional(),
    role: bookingItemParticipantRoleSchema.default("traveler"),
    isPrimary: z.boolean().default(false),
  })
  .refine((value) => Boolean(value.travelerId), {
    message: "travelerId is required",
    path: ["travelerId"],
  })
  .transform(({ travelerId, ...rest }) => ({
    ...rest,
    travelerId: travelerId!,
  }))

export const insertBookingItemParticipantSchema = insertBookingItemTravelerSchema

// ---------- supplier statuses ----------

const supplierStatusCoreSchema = z.object({
  supplierServiceId: z.string().optional().nullable(),
  serviceName: z.string().min(1).max(255),
  status: supplierConfirmationStatusSchema.default("pending"),
  supplierReference: z.string().max(255).optional().nullable(),
  costCurrency: z.string().min(3).max(3),
  costAmountCents: z.number().int().min(0),
  notes: z.string().optional().nullable(),
})

export const insertSupplierStatusSchema = supplierStatusCoreSchema
export const updateSupplierStatusSchema = supplierStatusCoreSchema.partial().extend({
  confirmedAt: z.string().optional().nullable(),
})

// ---------- notes ----------

export const insertBookingNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

export const updateBookingNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})

// ---------- documents ----------

export const insertBookingDocumentSchema = z
  .object({
    travelerId: z.string().optional().nullable(),
    type: bookingDocumentTypeSchema,
    fileName: z.string().min(1).max(500),
    fileUrl: z.string().url(),
    expiresAt: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .transform(({ travelerId, ...rest }) => ({
    ...rest,
    travelerId: travelerId ?? null,
  }))

export const insertBookingTravelerDocumentSchema = insertBookingDocumentSchema

// ---------- booking groups ----------

export const bookingGroupKindSchema = z.enum(["shared_room", "cruise_party", "other"])
export const bookingGroupMemberRoleSchema = z.enum(["primary", "shared"])

const bookingGroupCoreSchema = z.object({
  kind: bookingGroupKindSchema.default("shared_room"),
  label: z.string().min(1).max(500),
  primaryBookingId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  optionUnitId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
})

export const insertBookingGroupSchema = bookingGroupCoreSchema
export const updateBookingGroupSchema = bookingGroupCoreSchema.partial()

export const addBookingGroupMemberSchema = z.object({
  bookingId: z.string().min(1),
  role: bookingGroupMemberRoleSchema.default("shared"),
})

export const bookingGroupListQuerySchema = z.object({
  kind: bookingGroupKindSchema.optional(),
  productId: z.string().optional(),
  optionUnitId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export * from "./validation-public.js"
export * from "./validation-shared.js"
