/**
 * Shared OpenAPI response schemas for the cruise admin routes (voyant#2114).
 *
 * Authored from the Drizzle `$inferSelect` shapes of the cruise tables. Wire
 * conventions (§17): `timestamp` columns serialize to ISO strings; `date`
 * columns are already strings; `numeric` money/measurement columns are decimal
 * strings (`lowestPriceCached` is in MAJOR units, not cents); jsonb arrays /
 * records are nullable because the columns carry a `.default(...)` without
 * `.notNull()`. Opaque jsonb policy blobs are documented as pass-throughs.
 */

import { z } from "@hono/zod-openapi"

import {
  cabinRoomTypeSchema,
  cruiseSailingDirectionSchema,
  cruiseSourceSchema,
  cruiseStatusSchema,
  cruiseTypeSchema,
  cruiseVoyageGroupKindSchema,
  cruiseVoyageSegmentKindSchema,
  cruiseVoyageSegmentRoleSchema,
  enrichmentProgramKindSchema,
  priceAvailabilitySchema,
  priceFareVariantSchema,
  sailingSalesStatusSchema,
  shipTypeSchema,
} from "./validation-shared.js"

/** Permissive error envelope — every cruise error leg returns `{ error, ... }`. */
export const errorResponseSchema = z.object({ error: z.string() }).catchall(z.unknown())

const isoTimestamp = z.string()
const stringArray = z.array(z.string()).nullable()
const stringRecord = z.record(z.string(), z.string()).nullable()
/** Opaque jsonb payment-policy blob (mirrors finance `PaymentPolicy`). */
const opaqueJson = z.unknown().nullable()

/** `cruises` row. */
export const cruiseRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  cruiseType: cruiseTypeSchema,
  lineSupplierId: z.string().nullable(),
  defaultShipId: z.string().nullable(),
  nights: z.number().int(),
  embarkPortFacilityId: z.string().nullable(),
  embarkPortCanonicalPlaceId: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  disembarkPortCanonicalPlaceId: z.string().nullable(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  highlights: stringArray,
  inclusionsHtml: z.string().nullable(),
  exclusionsHtml: z.string().nullable(),
  regionIds: stringArray,
  waterwayIds: stringArray,
  portIds: stringArray,
  countryIso: stringArray,
  regions: stringArray,
  waterways: stringArray,
  ports: stringArray,
  countries: stringArray,
  themes: stringArray,
  heroImageUrl: z.string().nullable(),
  mapImageUrl: z.string().nullable(),
  status: cruiseStatusSchema,
  lowestPriceCached: z.string().nullable(),
  lowestPriceCurrencyCached: z.string().nullable(),
  earliestDepartureCached: z.string().nullable(),
  latestDepartureCached: z.string().nullable(),
  externalRefs: stringRecord,
  customerPaymentPolicy: opaqueJson,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_sailings` row. */
export const cruiseSailingRowSchema = z.object({
  id: z.string(),
  cruiseId: z.string(),
  shipId: z.string(),
  departureDate: z.string(),
  returnDate: z.string(),
  embarkPortFacilityId: z.string().nullable(),
  embarkPortCanonicalPlaceId: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  disembarkPortCanonicalPlaceId: z.string().nullable(),
  direction: cruiseSailingDirectionSchema.nullable(),
  availabilityNote: z.string().nullable(),
  isCharter: z.boolean(),
  salesStatus: sailingSalesStatusSchema,
  externalRefs: stringRecord,
  customerPaymentPolicy: opaqueJson,
  lastSyncedAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_ships` row. */
export const cruiseShipRowSchema = z.object({
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
  gallery: stringArray,
  amenities: z.record(z.string(), z.unknown()).nullable(),
  externalRefs: stringRecord,
  isActive: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_decks` row. */
export const cruiseDeckRowSchema = z.object({
  id: z.string(),
  shipId: z.string(),
  name: z.string(),
  level: z.number().int().nullable(),
  planImageUrl: z.string().nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_cabin_categories` row. */
export const cruiseCabinCategoryRowSchema = z.object({
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
  amenities: stringArray,
  featureCodes: stringArray,
  bedConfigurations: stringArray,
  accessibilityFeatures: stringArray,
  viewType: z.string().nullable(),
  images: stringArray,
  floorplanImages: stringArray,
  gradeCodes: stringArray,
  externalRefs: stringRecord,
  customerPaymentPolicy: opaqueJson,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_cabins` row. */
export const cruiseCabinRowSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  cabinNumber: z.string(),
  deckId: z.string().nullable(),
  position: z.string().nullable(),
  connectsTo: z.string().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_days` row. */
export const cruiseDayRowSchema = z.object({
  id: z.string(),
  cruiseId: z.string(),
  dayNumber: z.number().int(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  portFacilityId: z.string().nullable(),
  portCanonicalPlaceId: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  departureTime: z.string().nullable(),
  isOvernight: z.boolean(),
  isSeaDay: z.boolean(),
  isExpeditionLanding: z.boolean(),
  meals: z
    .object({
      breakfast: z.boolean().optional(),
      lunch: z.boolean().optional(),
      dinner: z.boolean().optional(),
    })
    .nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_enrichment_programs` row. */
export const enrichmentProgramRowSchema = z.object({
  id: z.string(),
  cruiseId: z.string(),
  kind: enrichmentProgramKindSchema,
  name: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  bioImageUrl: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_prices` row. All `numeric` money columns serialize to decimal strings. */
export const cruisePriceRowSchema = z.object({
  id: z.string(),
  sailingId: z.string(),
  cabinCategoryId: z.string(),
  occupancy: z.number().int(),
  fareCode: z.string().nullable(),
  fareCodeName: z.string().nullable(),
  fareVariant: priceFareVariantSchema,
  currency: z.string(),
  pricePerPerson: z.string(),
  originalPricePerPerson: z.string().nullable(),
  secondGuestPricePerPerson: z.string().nullable(),
  singlePricePerPerson: z.string().nullable(),
  singleSupplementPercent: z.string().nullable(),
  availability: priceAvailabilitySchema,
  availabilityCount: z.number().int().nullable(),
  priceCatalogId: z.string().nullable(),
  priceScheduleId: z.string().nullable(),
  bookingDeadline: z.string().nullable(),
  earlyBookingDeadline: z.string().nullable(),
  earlyBookingBonusDescription: z.string().nullable(),
  requiresRequest: z.boolean(),
  notes: z.string().nullable(),
  externalRefs: stringRecord,
  lastSyncedAt: isoTimestamp.nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/**
 * `cruise_sailing_days` row (per-sailing itinerary override). The `is*` booleans
 * carry no `.notNull()`, so they are nullable on the wire; `time` columns are
 * already strings.
 */
export const cruiseSailingDayRowSchema = z.object({
  id: z.string(),
  sailingId: z.string(),
  dayNumber: z.number().int(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  portFacilityId: z.string().nullable(),
  portCanonicalPlaceId: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  departureTime: z.string().nullable(),
  isOvernight: z.boolean().nullable(),
  isSeaDay: z.boolean().nullable(),
  isExpeditionLanding: z.boolean().nullable(),
  isSkipped: z.boolean(),
  meals: z
    .object({
      breakfast: z.boolean().optional(),
      lunch: z.boolean().optional(),
      dinner: z.boolean().optional(),
    })
    .nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_voyage_groups` row. */
export const cruiseVoyageGroupRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  groupKind: cruiseVoyageGroupKindSchema,
  lineSupplierId: z.string().nullable(),
  nights: z.number().int(),
  embarkPortFacilityId: z.string().nullable(),
  embarkPortCanonicalPlaceId: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  disembarkPortCanonicalPlaceId: z.string().nullable(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  highlights: stringArray,
  regions: stringArray,
  themes: stringArray,
  heroImageUrl: z.string().nullable(),
  mapImageUrl: z.string().nullable(),
  status: cruiseStatusSchema,
  lowestPriceCached: z.string().nullable(),
  lowestPriceCurrencyCached: z.string().nullable(),
  earliestDepartureCached: z.string().nullable(),
  latestDepartureCached: z.string().nullable(),
  externalRefs: stringRecord,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `cruise_voyage_group_segments` row. */
export const cruiseVoyageGroupSegmentRowSchema = z.object({
  id: z.string(),
  voyageGroupId: z.string(),
  sortOrder: z.number().int(),
  segmentKind: cruiseVoyageSegmentKindSchema,
  segmentRole: cruiseVoyageSegmentRoleSchema,
  title: z.string(),
  description: z.string().nullable(),
  cruiseId: z.string().nullable(),
  sailingId: z.string().nullable(),
  startDay: z.number().int().nullable(),
  endDay: z.number().int().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  embarkPortFacilityId: z.string().nullable(),
  embarkPortCanonicalPlaceId: z.string().nullable(),
  disembarkPortFacilityId: z.string().nullable(),
  disembarkPortCanonicalPlaceId: z.string().nullable(),
  nights: z.number().int().nullable(),
  externalRefs: stringRecord,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/**
 * `cruise_search_index` row (denormalized read model). Note `lowestPriceCents`
 * is an integer in MINOR units here — the search index predates the major-unit
 * `lowestPriceCached` convention on the canonical `cruises` row.
 */
export const cruiseSearchIndexRowSchema = z.object({
  id: z.string(),
  source: cruiseSourceSchema,
  sourceProvider: z.string().nullable(),
  sourceRef: z.unknown().nullable(),
  localCruiseId: z.string().nullable(),
  slug: z.string(),
  name: z.string(),
  cruiseType: cruiseTypeSchema,
  lineName: z.string(),
  shipName: z.string(),
  nights: z.number().int(),
  embarkPortName: z.string().nullable(),
  embarkPortCanonicalPlaceId: z.string().nullable(),
  disembarkPortName: z.string().nullable(),
  disembarkPortCanonicalPlaceId: z.string().nullable(),
  regionIds: stringArray,
  waterwayIds: stringArray,
  portIds: stringArray,
  countryIso: stringArray,
  regions: stringArray,
  waterways: stringArray,
  ports: stringArray,
  countries: stringArray,
  themes: stringArray,
  earliestDeparture: z.string().nullable(),
  latestDeparture: z.string().nullable(),
  departureCount: z.number().int().nullable(),
  lowestPriceCents: z.number().int().nullable(),
  lowestPriceCurrency: z.string().nullable(),
  salesStatus: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  refreshedAt: isoTimestamp,
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp,
})

/** `{ data: <schema> }` envelope used by single-entity reads/mutations. */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ data: schema })
}
