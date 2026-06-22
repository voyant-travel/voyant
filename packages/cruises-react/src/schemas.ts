import { listResponseSchema } from "@voyant-travel/types"
import { z } from "zod"

// ---------- envelope helpers ----------

export const paginatedEnvelope = listResponseSchema

export const singleEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item })

export const listEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })

export const successEnvelope = z.object({ success: z.boolean() }).optional()

// ---------- canonical enum schemas (mirror server) ----------

export const cruiseTypeSchema = z.enum(["ocean", "river", "expedition", "coastal"])
export const cruiseStatusSchema = z.enum(["draft", "awaiting_review", "live", "archived"])
export const cruiseSourceSchema = z.enum(["local", "external"])
export const shipTypeSchema = z.enum([
  "ocean",
  "river",
  "expedition",
  "yacht",
  "sailing",
  "coastal",
])
export const cabinRoomTypeSchema = z.enum([
  "inside",
  "oceanview",
  "balcony",
  "suite",
  "penthouse",
  "single",
])
export const sailingSalesStatusSchema = z.enum([
  "open",
  "on_request",
  "wait_list",
  "sold_out",
  "closed",
])
export const sailingDirectionSchema = z.enum(["upstream", "downstream", "round_trip", "one_way"])
export const priceAvailabilitySchema = z.enum([
  "available",
  "limited",
  "on_request",
  "wait_list",
  "sold_out",
])
export const priceComponentKindSchema = z.enum([
  "gratuity",
  "onboard_credit",
  "port_charge",
  "tax",
  "ncf",
  "airfare",
  "transfer",
  "insurance",
])
export const priceComponentDirectionSchema = z.enum(["addition", "inclusion", "credit"])
export const enrichmentKindSchema = z.enum([
  "naturalist",
  "historian",
  "photographer",
  "lecturer",
  "expert",
  "other",
])
export const cruiseBookingModeSchema = z.enum(["inquiry", "reserve"])

// ---------- record schemas (browser-facing read shapes) ----------

const isoDateString = z.string()
const timestampString = z.string()

export const cruiseRecordSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  cruiseType: cruiseTypeSchema,
  lineSupplierId: z.string().nullable(),
  defaultShipId: z.string().nullable(),
  nights: z.number().int(),
  embarkPortFacilityId: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  highlights: z.array(z.string()).nullable(),
  inclusionsHtml: z.string().nullable(),
  exclusionsHtml: z.string().nullable(),
  regions: z.array(z.string()).nullable(),
  themes: z.array(z.string()).nullable(),
  heroImageUrl: z.string().nullable(),
  mapImageUrl: z.string().nullable(),
  status: cruiseStatusSchema,
  lowestPriceCached: z.string().nullable(),
  lowestPriceCurrencyCached: z.string().nullable(),
  earliestDepartureCached: isoDateString.nullable(),
  latestDepartureCached: isoDateString.nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CruiseRecord = z.infer<typeof cruiseRecordSchema>

export const sailingRecordSchema = z.object({
  id: z.string(),
  cruiseId: z.string(),
  shipId: z.string(),
  departureDate: isoDateString,
  returnDate: isoDateString,
  embarkPortFacilityId: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  direction: sailingDirectionSchema.nullable(),
  availabilityNote: z.string().nullable(),
  isCharter: z.boolean(),
  salesStatus: sailingSalesStatusSchema,
  externalRefs: z.record(z.string(), z.string()).nullable(),
  lastSyncedAt: timestampString.nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type SailingRecord = z.infer<typeof sailingRecordSchema>

export const shipRecordSchema = z.object({
  id: z.string(),
  lineSupplierId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
  shipType: shipTypeSchema,
  capacityGuests: z.number().int().nullable(),
  capacityCrew: z.number().int().nullable(),
  cabinCount: z.number().int().nullable(),
  deckCount: z.number().int().nullable(),
  lengthMeters: z.string().nullable(),
  cruisingSpeedKnots: z.string().nullable(),
  yearBuilt: z.number().int().nullable(),
  yearRefurbished: z.number().int().nullable(),
  imo: z.string().nullable(),
  description: z.string().nullable(),
  deckPlanUrl: z.string().nullable(),
  gallery: z.array(z.string()).nullable(),
  amenities: z.record(z.string(), z.unknown()).nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  isActive: z.boolean(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type ShipRecord = z.infer<typeof shipRecordSchema>

export const cabinCategoryRecordSchema = z.object({
  id: z.string(),
  shipId: z.string(),
  code: z.string(),
  name: z.string(),
  roomType: cabinRoomTypeSchema,
  description: z.string().nullable(),
  minOccupancy: z.number().int(),
  maxOccupancy: z.number().int(),
  squareFeet: z.string().nullable(),
  wheelchairAccessible: z.boolean(),
  amenities: z.array(z.string()).nullable(),
  images: z.array(z.string()).nullable(),
  floorplanImages: z.array(z.string()).nullable(),
  gradeCodes: z.array(z.string()).nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CabinCategoryRecord = z.infer<typeof cabinCategoryRecordSchema>

export const deckRecordSchema = z.object({
  id: z.string(),
  shipId: z.string(),
  name: z.string(),
  level: z.number().int().nullable(),
  planImageUrl: z.string().nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type DeckRecord = z.infer<typeof deckRecordSchema>

export const cabinRecordSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  cabinNumber: z.string(),
  deckId: z.string().nullable(),
  position: z.string().nullable(),
  connectsTo: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type CabinRecord = z.infer<typeof cabinRecordSchema>

export const priceComponentRecordSchema = z.object({
  id: z.string(),
  priceId: z.string(),
  kind: priceComponentKindSchema,
  label: z.string().nullable(),
  amount: z.string(),
  currency: z.string(),
  direction: priceComponentDirectionSchema,
  perPerson: z.boolean(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export const priceRecordSchema = z.object({
  id: z.string(),
  sailingId: z.string(),
  cabinCategoryId: z.string(),
  occupancy: z.number().int(),
  fareCode: z.string().nullable(),
  fareCodeName: z.string().nullable(),
  currency: z.string(),
  pricePerPerson: z.string(),
  secondGuestPricePerPerson: z.string().nullable(),
  singleSupplementPercent: z.string().nullable(),
  availability: priceAvailabilitySchema,
  availabilityCount: z.number().int().nullable(),
  priceCatalogId: z.string().nullable(),
  priceScheduleId: z.string().nullable(),
  bookingDeadline: isoDateString.nullable(),
  requiresRequest: z.boolean(),
  notes: z.string().nullable(),
  externalRefs: z.record(z.string(), z.string()).nullable(),
  lastSyncedAt: timestampString.nullable(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type PriceRecord = z.infer<typeof priceRecordSchema>

export const enrichmentProgramRecordSchema = z.object({
  id: z.string(),
  cruiseId: z.string(),
  kind: enrichmentKindSchema,
  name: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  bioImageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type EnrichmentProgramRecord = z.infer<typeof enrichmentProgramRecordSchema>

export const searchIndexEntrySchema = z.object({
  id: z.string(),
  source: cruiseSourceSchema,
  sourceProvider: z.string().nullable(),
  sourceRef: z.record(z.string(), z.unknown()).nullable(),
  localCruiseId: z.string().nullable(),
  slug: z.string(),
  name: z.string(),
  cruiseType: cruiseTypeSchema,
  lineName: z.string(),
  shipName: z.string(),
  nights: z.number().int(),
  embarkPortName: z.string().nullable(),
  disembarkPortName: z.string().nullable(),
  regions: z.array(z.string()).nullable(),
  themes: z.array(z.string()).nullable(),
  earliestDeparture: isoDateString.nullable(),
  latestDeparture: isoDateString.nullable(),
  departureCount: z.number().int().nullable(),
  lowestPriceCents: z.number().int().nullable(),
  lowestPriceCurrency: z.string().nullable(),
  salesStatus: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  refreshedAt: timestampString,
  createdAt: timestampString,
  updatedAt: timestampString,
})

export type SearchIndexEntry = z.infer<typeof searchIndexEntrySchema>

// ---------- effective itinerary day (computed by the server) ----------

export const effectiveItineraryDaySchema = z.object({
  dayNumber: z.number().int(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  portFacilityId: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  departureTime: z.string().nullable(),
  isOvernight: z.boolean(),
  isSeaDay: z.boolean(),
  isExpeditionLanding: z.boolean(),
  isSkipped: z.boolean(),
  meals: z
    .object({
      breakfast: z.boolean().optional(),
      lunch: z.boolean().optional(),
      dinner: z.boolean().optional(),
    })
    .optional(),
  hasOverride: z.boolean(),
})

export type EffectiveItineraryDay = z.infer<typeof effectiveItineraryDaySchema>

// ---------- quote (composed by the server) ----------

export const quoteComponentSchema = z.object({
  kind: priceComponentKindSchema,
  label: z.string().nullable(),
  amount: z.string(),
  currency: z.string(),
  direction: priceComponentDirectionSchema,
  perPerson: z.boolean(),
})

export const quoteSchema = z.object({
  fareCode: z.string().nullable(),
  fareCodeName: z.string().nullable(),
  currency: z.string(),
  occupancy: z.number().int(),
  guestCount: z.number().int(),
  basePerPerson: z.string(),
  components: z.array(quoteComponentSchema),
  totalPerPerson: z.string(),
  totalForCabin: z.string(),
})

export type Quote = z.infer<typeof quoteSchema>

// ---------- unified-key admin envelopes ----------

export const adminCruiseListItemSchema = z.union([
  z.object({
    source: z.literal("local"),
    sourceProvider: z.null(),
    sourceRef: z.null(),
    key: z.string(),
    cruise: cruiseRecordSchema,
  }),
  z.object({
    source: z.literal("external"),
    sourceProvider: z.string(),
    sourceRef: z.record(z.string(), z.unknown()),
    key: z.string(),
    cruise: z.unknown(),
  }),
])

export const adminCruiseListResponse = z.object({
  data: z.array(adminCruiseListItemSchema),
  total: z.number().int(),
  localTotal: z.number().int(),
  adapterCount: z.number().int(),
  adapterErrors: z.array(z.object({ adapter: z.string(), error: z.string() })).optional(),
  limit: z.number().int(),
  offset: z.number().int(),
})

// ---------- response wrappers ----------

export const cruiseListResponse = paginatedEnvelope(cruiseRecordSchema)
export const cruiseSingleResponse = singleEnvelope(cruiseRecordSchema)
export const sailingListResponse = paginatedEnvelope(sailingRecordSchema)
export const sailingSingleResponse = singleEnvelope(sailingRecordSchema)
export const shipListResponse = paginatedEnvelope(shipRecordSchema)
export const shipSingleResponse = singleEnvelope(shipRecordSchema)
export const cabinCategoryListResponse = listEnvelope(cabinCategoryRecordSchema)
export const cabinCategorySingleResponse = singleEnvelope(cabinCategoryRecordSchema)
export const deckListResponse = listEnvelope(deckRecordSchema)
export const deckSingleResponse = singleEnvelope(deckRecordSchema)
export const cabinListResponse = listEnvelope(cabinRecordSchema)
export const cabinSingleResponse = singleEnvelope(cabinRecordSchema)
export const priceListResponse = paginatedEnvelope(priceRecordSchema)
export const priceSingleResponse = singleEnvelope(priceRecordSchema)
export const enrichmentListResponse = listEnvelope(enrichmentProgramRecordSchema)
export const enrichmentSingleResponse = singleEnvelope(enrichmentProgramRecordSchema)
export const effectiveItineraryResponse = listEnvelope(effectiveItineraryDaySchema)
export const quoteResponse = singleEnvelope(quoteSchema)
export const searchIndexListResponse = paginatedEnvelope(searchIndexEntrySchema)
