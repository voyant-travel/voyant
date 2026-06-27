/**
 * Response/envelope schemas for the OCTo connectivity OpenAPI routes
 * (voyant#2114 — octo sub-batch). The octo surface serves OCTo-shaped
 * PROJECTIONS (not Drizzle rows): the service layer already maps every
 * `timestamp`/`date` column to an ISO string and unwraps jsonb bags, so the
 * projected objects are wire-ready and these schemas mirror the projected
 * `types.ts` shapes verbatim (§17 timestamps → strings; jsonb bags are open
 * records). The booking `extensions` bag carries three origin-tracking columns
 * the service hydrates on top of the documented `types.ts` shape
 * (`originSource` / `providerSourceRef` / `providerOrderRef`).
 *
 * Shared between `routes.ts` and the contract test so the documented envelopes,
 * the runtime handlers, and the round-trip assertions read from one source.
 */

import { z } from "zod"

// --- shared envelopes -------------------------------------------------------

export const errorResponseSchema = z.object({ error: z.string() })
const idSchema = z.string()
export const idParamSchema = z.object({ id: idSchema })

const jsonRecord = z.record(z.string(), z.unknown())

/** Paginated list envelope returned by the octo list endpoints. */
export function listEnvelopeSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
}

/** Aggregated calendar envelope returned by `GET /products/{id}/calendar`. */
export function calendarEnvelopeSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    total: z.number().int(),
  })
}

// --- enums (mirrored from types.ts) -----------------------------------------

const availabilityTypeSchema = z.enum(["START_TIME", "OPENING_HOURS"])
const unitTypeSchema = z.enum([
  "ADULT",
  "CHILD",
  "YOUTH",
  "INFANT",
  "FAMILY",
  "SENIOR",
  "STUDENT",
  "MILITARY",
  "OTHER",
])
const availabilityStatusSchema = z.enum(["AVAILABLE", "FREESALE", "SOLD_OUT", "LIMITED", "CLOSED"])
const bookingStatusSchema = z.enum(["ON_HOLD", "CONFIRMED", "EXPIRED", "CANCELLED"])

// --- product ----------------------------------------------------------------

const contentEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
})

const faqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
})

const productLocationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  googlePlaceId: z.string().nullable(),
  applePlaceId: z.string().nullable(),
  tripadvisorLocationId: z.string().nullable(),
})

const productContentSchema = z.object({
  highlights: z.array(contentEntrySchema),
  inclusions: z.array(contentEntrySchema),
  exclusions: z.array(contentEntrySchema),
  importantInformation: z.array(contentEntrySchema),
  faqs: z.array(faqSchema),
  locations: z.array(productLocationSchema),
})

const unitRestrictionsSchema = z.object({
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  minQuantity: z.number().optional(),
  maxQuantity: z.number().optional(),
  occupancyMin: z.number().optional(),
  occupancyMax: z.number().optional(),
})

const projectedUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  type: unitTypeSchema,
  restrictions: unitRestrictionsSchema,
})

const projectedOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  default: z.boolean(),
  availabilityLocalStartTimes: z.array(z.string()),
  units: z.array(projectedUnitSchema),
})

export const octoProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  timeZone: z.string().nullable(),
  availabilityType: availabilityTypeSchema,
  allowFreesale: z.boolean(),
  instantConfirmation: z.boolean(),
  options: z.array(projectedOptionSchema),
  content: productContentSchema,
  extensions: z.object({
    status: z.string(),
    visibility: z.string(),
    activated: z.boolean(),
    facilityId: z.string().nullable(),
    bookingMode: z.string(),
    capabilityCodes: z.array(z.string()),
    deliveryFormats: z.array(z.string()),
  }),
})

// --- availability -----------------------------------------------------------

export const octoAvailabilitySchema = z.object({
  id: z.string(),
  productId: z.string(),
  optionId: z.string().nullable(),
  localDateTimeStart: z.string(),
  localDateTimeEnd: z.string().nullable(),
  timeZone: z.string(),
  status: availabilityStatusSchema,
  vacancies: z.number().nullable(),
  capacity: z.number().nullable(),
})

export const octoAvailabilityCalendarDaySchema = z.object({
  localDate: z.string(),
  status: availabilityStatusSchema,
  vacancies: z.number().nullable(),
  capacity: z.number().nullable(),
  availabilityIds: z.array(z.string()),
})

// --- booking ----------------------------------------------------------------

// `firstName` / `lastName` are nullable on the wire — `pickBookingContact`
// derives them from the booking/participant rows, either of which may be null.
const bookingContactSchema = z.object({
  travelerId: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  language: z.string().nullable(),
})

const bookingUnitItemSchema = z.object({
  bookingItemId: z.string(),
  title: z.string(),
  itemType: z.string(),
  status: z.string(),
  quantity: z.number(),
  productId: z.string().nullable(),
  optionId: z.string().nullable(),
  unitId: z.string().nullable(),
  pricingCategoryId: z.string().nullable(),
  availabilityId: z.string().nullable(),
  travelerIds: z.array(z.string()),
})

const bookingFulfillmentSchema = z.object({
  id: z.string(),
  bookingItemId: z.string().nullable(),
  travelerId: z.string().nullable(),
  type: z.string(),
  deliveryChannel: z.string(),
  status: z.string(),
  artifactUrl: z.string().nullable(),
  payload: jsonRecord.nullable(),
  issuedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
})

const bookingArtifactSchema = z.object({
  fulfillmentId: z.string(),
  bookingItemId: z.string().nullable(),
  travelerId: z.string().nullable(),
  type: z.string(),
  deliveryChannel: z.string(),
  status: z.string(),
  artifactUrl: z.string().nullable(),
  downloadUrl: z.string().nullable(),
  pdfUrl: z.string().nullable(),
  qrCode: z.string().nullable(),
  barcode: z.string().nullable(),
  voucherCode: z.string().nullable(),
  issuedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
})

const bookingSupplierReferenceSchema = z.object({
  id: z.string(),
  supplierServiceId: z.string().nullable(),
  serviceName: z.string(),
  status: z.string(),
  supplierReference: z.string().nullable(),
  confirmedAt: z.string().nullable(),
})

export const octoRedemptionEventSchema = z.object({
  id: z.string(),
  bookingItemId: z.string().nullable(),
  travelerId: z.string().nullable(),
  redeemedAt: z.string(),
  redeemedBy: z.string().nullable(),
  location: z.string().nullable(),
  method: z.string(),
  metadata: jsonRecord.nullable(),
})

const bookingReferencesSchema = z.object({
  resellerReference: z.string().nullable(),
  offerId: z.string().nullable(),
  offerNumber: z.string().nullable(),
  orderId: z.string().nullable(),
  orderNumber: z.string().nullable(),
  supplierReferences: z.array(bookingSupplierReferenceSchema),
})

export const octoBookingSchema = z.object({
  id: z.string(),
  bookingNumber: z.string(),
  status: bookingStatusSchema,
  availabilityId: z.string().nullable(),
  contact: bookingContactSchema.nullable(),
  unitItems: z.array(bookingUnitItemSchema),
  fulfillments: z.array(bookingFulfillmentSchema),
  artifacts: z.array(bookingArtifactSchema),
  redemptions: z.array(octoRedemptionEventSchema),
  references: bookingReferencesSchema,
  holdExpiresAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  expiredAt: z.string().nullable(),
  utcRedeemedAt: z.string().nullable(),
  extensions: z.object({
    sourceType: z.string(),
    externalBookingRef: z.string().nullable(),
    communicationLanguage: z.string().nullable(),
    personId: z.string().nullable(),
    organizationId: z.string().nullable(),
    sellCurrency: z.string(),
    baseCurrency: z.string().nullable(),
    originSource: z.string().nullable(),
    providerSourceRef: z.string().nullable(),
    providerOrderRef: z.string().nullable(),
  }),
})
