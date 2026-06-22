import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

// ---------- envelope helpers ----------

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })

export const listEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })

// ---------- canonical enum schemas (mirror server) ----------

export const charterStatusSchema = z.enum(["draft", "awaiting_review", "live", "archived"])
export const charterSourceSchema = z.enum(["local", "external"])
export const charterBookingModeSchema = z.enum(["per_suite", "whole_yacht"])
export const yachtClassSchema = z.enum([
  "luxury_motor",
  "luxury_sailing",
  "expedition",
  "small_cruise",
])
export const voyageSalesStatusSchema = z.enum([
  "open",
  "on_request",
  "wait_list",
  "sold_out",
  "closed",
])
export const suiteCategorySchema = z.enum([
  "standard",
  "deluxe",
  "suite",
  "penthouse",
  "owners",
  "signature",
])
export const suiteAvailabilitySchema = z.enum([
  "available",
  "limited",
  "on_request",
  "wait_list",
  "sold_out",
])
/**
 * ISO-4217 currency code (three uppercase letters). Charter pricing stores
 * per-currency amounts in `pricesByCurrency: Record<code, amount>` maps,
 * so adding a new currency is a content change — no client-schema bump.
 */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Expected ISO-4217 currency code (e.g. 'USD', 'RON')")

const pricesByCurrencySchema = z.record(currencyCodeSchema, z.string())

const isoDateString = z.string()
const timestampString = z.string()

// ---------- record schemas ----------

export const charterProductRecordSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  lineSupplierId: z.string().nullable(),
  defaultYachtId: z.string().nullable(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  mapImageUrl: z.string().nullable(),
  regions: z.array(z.string()).nullable(),
  themes: z.array(z.string()).nullable(),
  status: charterStatusSchema,
  defaultBookingModes: z.array(charterBookingModeSchema).nullable(),
  defaultMybaTemplateId: z.string().nullable(),
  defaultApaPercent: z.string().nullable(),
  lowestPriceCachedAmount: z.string().nullable(),
  lowestPriceCachedCurrency: z.string().nullable(),
  earliestVoyageCached: isoDateString.nullable(),
  latestVoyageCached: isoDateString.nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CharterProductRecord = z.infer<typeof charterProductRecordSchema>

export const charterVoyageRecordSchema = z.object({
  id: z.string(),
  productId: z.string(),
  yachtId: z.string(),
  voyageCode: z.string(),
  name: z.string().nullable(),
  embarkPortFacilityId: z.string().nullable(),
  embarkPortName: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  disembarkPortName: z.string().nullable(),
  departureDate: isoDateString,
  returnDate: isoDateString,
  nights: z.number().int(),
  bookingModes: z.array(charterBookingModeSchema),
  appointmentOnly: z.boolean(),
  wholeYachtPricesByCurrency: pricesByCurrencySchema,
  apaPercentOverride: z.string().nullable(),
  mybaTemplateIdOverride: z.string().nullable(),
  charterAreaOverride: z.string().nullable(),
  salesStatus: voyageSalesStatusSchema,
  availabilityNote: z.string().nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  lastSyncedAt: timestampString.nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CharterVoyageRecord = z.infer<typeof charterVoyageRecordSchema>

export const charterYachtRecordSchema = z.object({
  id: z.string(),
  lineSupplierId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  yachtClass: yachtClassSchema,
  capacityGuests: z.number().int().nullable(),
  capacityCrew: z.number().int().nullable(),
  lengthMeters: z.string().nullable(),
  yearBuilt: z.number().int().nullable(),
  yearRefurbished: z.number().int().nullable(),
  imo: z.string().nullable(),
  description: z.string().nullable(),
  gallery: z.array(z.string()).nullable(),
  amenities: z.record(z.string(), z.unknown()).nullable(),
  crewBios: z
    .array(
      z.object({
        role: z.string(),
        name: z.string(),
        bio: z.string().optional(),
        photoUrl: z.string().optional(),
      }),
    )
    .nullable(),
  defaultCharterAreas: z.array(z.string()).nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  isActive: z.boolean(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CharterYachtRecord = z.infer<typeof charterYachtRecordSchema>

export const charterSuiteRecordSchema = z.object({
  id: z.string(),
  voyageId: z.string(),
  suiteCode: z.string(),
  suiteName: z.string(),
  suiteCategory: suiteCategorySchema.nullable(),
  description: z.string().nullable(),
  squareFeet: z.string().nullable(),
  images: z.array(z.string()).nullable(),
  floorplanImages: z.array(z.string()).nullable(),
  maxGuests: z.number().int().nullable(),
  pricesByCurrency: pricesByCurrencySchema,
  portFeesByCurrency: pricesByCurrencySchema,
  availability: suiteAvailabilitySchema,
  unitsAvailable: z.number().int().nullable(),
  appointmentOnly: z.boolean(),
  notes: z.string().nullable(),
  extra: z.record(z.string(), z.unknown()).nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  lastSyncedAt: timestampString.nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CharterSuiteRecord = z.infer<typeof charterSuiteRecordSchema>

export const charterScheduleDayRecordSchema = z.object({
  id: z.string(),
  voyageId: z.string(),
  dayNumber: z.number().int(),
  portFacilityId: z.string().nullable(),
  portName: z.string().nullable(),
  scheduleDate: isoDateString.nullable(),
  arrivalTime: z.string().nullable(),
  departureTime: z.string().nullable(),
  isSeaDay: z.boolean(),
  description: z.string().nullable(),
  activities: z.array(z.string()).nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CharterScheduleDayRecord = z.infer<typeof charterScheduleDayRecordSchema>

// ---------- quotes (composed by the server) ----------

export const perSuiteQuoteSchema = z.object({
  mode: z.literal("per_suite"),
  voyageId: z.string(),
  suiteId: z.string(),
  suiteName: z.string(),
  currency: currencyCodeSchema,
  suitePrice: z.string(),
  portFee: z.string().nullable(),
  total: z.string(),
})

export type PerSuiteQuote = z.infer<typeof perSuiteQuoteSchema>

export const wholeYachtQuoteSchema = z.object({
  mode: z.literal("whole_yacht"),
  voyageId: z.string(),
  currency: currencyCodeSchema,
  charterFee: z.string(),
  apaPercent: z.string(),
  apaAmount: z.string(),
  total: z.string(),
})

export type WholeYachtQuote = z.infer<typeof wholeYachtQuoteSchema>

// ---------- booking_charter_details (1:1 extension on bookings) ----------

export const bookingCharterDetailRecordSchema = z.object({
  bookingId: z.string(),
  bookingMode: charterBookingModeSchema,
  source: charterSourceSchema,
  sourceProvider: z.string().nullable(),
  sourceRef: z.record(z.string(), z.unknown()).nullable(),
  voyageId: z.string().nullable(),
  suiteId: z.string().nullable(),
  yachtId: z.string().nullable(),
  voyageDisplayName: z.string().nullable(),
  suiteDisplayName: z.string().nullable(),
  yachtName: z.string().nullable(),
  charterAreaSnapshot: z.string().nullable(),
  guestCount: z.number().int(),
  quotedCurrency: z.string(),
  quotedSuitePrice: z.string().nullable(),
  quotedPortFee: z.string().nullable(),
  quotedCharterFee: z.string().nullable(),
  apaPercent: z.string().nullable(),
  apaAmount: z.string().nullable(),
  quotedTotal: z.string(),
  mybaTemplateIdSnapshot: z.string().nullable(),
  mybaContractId: z.string().nullable(),
  apaPaidAmount: z.string().nullable(),
  apaSpentAmount: z.string().nullable(),
  apaRefundAmount: z.string().nullable(),
  apaSettledAt: timestampString.nullable(),
  connectorBookingRef: z.string().nullable(),
  connectorStatus: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type BookingCharterDetailRecord = z.infer<typeof bookingCharterDetailRecordSchema>

// ---------- unified-key admin envelopes (list response with adapter fan-out) ----------

export const adminProductListItemSchema = z.union([
  z.object({
    source: z.literal("local"),
    sourceProvider: z.null(),
    sourceRef: z.null(),
    key: z.string(),
    product: charterProductRecordSchema,
  }),
  z.object({
    source: z.literal("external"),
    sourceProvider: z.string(),
    sourceRef: z.record(z.string(), z.unknown()),
    key: z.string(),
    product: z.unknown(),
  }),
])

export const adminProductListResponse = z.object({
  data: z.array(adminProductListItemSchema),
  total: z.number().int(),
  localTotal: z.number().int(),
  adapterCount: z.number().int(),
  adapterErrors: z.array(z.object({ adapter: z.string(), error: z.string() })).optional(),
  limit: z.number().int(),
  offset: z.number().int(),
})

// ---------- detail envelopes ----------
// Detail responses come back EITHER as the bare local record (when the unified
// key parsed as local) OR as `{ source, sourceProvider, sourceRef, product, ...includes }`
// (external). Hooks union both shapes.

export const productDetailResponse = z.object({
  data: z.union([
    charterProductRecordSchema.extend({
      voyages: z.array(charterVoyageRecordSchema).optional(),
      yacht: charterYachtRecordSchema.nullable().optional(),
    }),
    z.object({
      source: z.literal("external"),
      sourceProvider: z.string(),
      sourceRef: z.record(z.string(), z.unknown()),
      product: z.record(z.string(), z.unknown()),
      voyages: z.array(z.unknown()).optional(),
      yacht: z.unknown().optional(),
    }),
  ]),
})

export const voyageDetailResponse = z.object({
  data: z.union([
    charterVoyageRecordSchema.extend({
      suites: z.array(charterSuiteRecordSchema).optional(),
      schedule: z.array(charterScheduleDayRecordSchema).optional(),
    }),
    z.object({
      source: z.literal("external"),
      sourceProvider: z.string(),
      sourceRef: z.record(z.string(), z.unknown()),
      voyage: z.record(z.string(), z.unknown()),
      suites: z.array(z.unknown()).optional(),
      schedule: z.array(z.unknown()).optional(),
    }),
  ]),
})

export const yachtDetailResponse = z.object({
  data: z.union([
    charterYachtRecordSchema,
    z.object({
      source: z.literal("external"),
      sourceProvider: z.string(),
      sourceRef: z.record(z.string(), z.unknown()),
      yacht: z.record(z.string(), z.unknown()),
    }),
  ]),
})

// ---------- response wrappers (admin) ----------

export const productListResponse = paginatedEnvelope(charterProductRecordSchema)
export const productSingleResponse = singleEnvelope(charterProductRecordSchema)
export const voyageListResponse = paginatedEnvelope(charterVoyageRecordSchema)
export const voyageSingleResponse = singleEnvelope(charterVoyageRecordSchema)
export const yachtListResponse = paginatedEnvelope(charterYachtRecordSchema)
export const yachtSingleResponse = singleEnvelope(charterYachtRecordSchema)
export const suiteListResponse = singleEnvelope(z.array(charterSuiteRecordSchema))
export const scheduleListResponse = singleEnvelope(z.array(charterScheduleDayRecordSchema))
export const perSuiteQuoteResponse = singleEnvelope(perSuiteQuoteSchema)
export const wholeYachtQuoteResponse = singleEnvelope(wholeYachtQuoteSchema)

// ---------- booking + MYBA + APA envelopes ----------

export const createBookingResponse = singleEnvelope(
  z.object({
    bookingId: z.string(),
    bookingNumber: z.string(),
    charterDetails: bookingCharterDetailRecordSchema,
    quote: z.union([perSuiteQuoteSchema, wholeYachtQuoteSchema]),
    sourceProvider: z.string().optional(),
    sourceRef: z.record(z.string(), z.unknown()).optional(),
  }),
)

export const generateMybaContractResponse = singleEnvelope(
  z.object({
    contractId: z.string(),
    charterDetails: bookingCharterDetailRecordSchema,
  }),
)

export const charterDetailResponse = singleEnvelope(bookingCharterDetailRecordSchema)
