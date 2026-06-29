import { z } from "zod"

/**
 * Request/response contracts for the Booking.com-style catalog offer surfaces
 * (dynamic package search, package/cruise detail, live pricing). These mirror
 * the operator backend in `catalog-offers.ts`; the matching client functions
 * live in `catalog-offers-client.ts` and the hooks in `hooks/`.
 *
 * Response schemas are intentionally lenient (nullable/optional fields, and
 * zod's default key-stripping) so a backend that adds a field never trips
 * `fetchWithValidation`.
 */

const moneyMinorSchema = z.object({
  amountMinor: z.number(),
  currency: z.string(),
})
export type CatalogMoneyMinor = z.infer<typeof moneyMinorSchema>

export const catalogAirportOptionSchema = z.object({
  code: z.string(),
  label: z.string(),
})
export type CatalogAirportOption = z.infer<typeof catalogAirportOptionSchema>

/* ── departure airports ──────────────────────────────────────────────── */

export const departureAirportsResponseSchema = z.object({
  departureAirports: z.array(catalogAirportOptionSchema).optional(),
})
export type DepartureAirportsResponse = z.infer<typeof departureAirportsResponseSchema>

/* ── dynamic package search ──────────────────────────────────────────── */

export const packageSearchCardSchema = z.object({
  productId: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  stars: z.union([z.string(), z.number()]).nullable(),
  destination: z.string().nullable(),
  country: z.string().nullable(),
  board: z.string().nullable(),
  checkIn: z.string().nullable(),
  checkOut: z.string().nullable(),
  nights: z.number().nullable(),
  departureAirport: z.string().nullable(),
  arrivalAirport: z.string().nullable(),
  carrier: z.string().nullable(),
  perPerson: moneyMinorSchema.nullable(),
  total: moneyMinorSchema.nullable(),
})
export type PackageSearchCard = z.infer<typeof packageSearchCardSchema>

export const packageSearchResponseSchema = z.object({
  offers: z.array(packageSearchCardSchema).optional(),
  departureAirports: z.array(catalogAirportOptionSchema).optional(),
  currency: z.string().optional(),
  retryable: z.boolean().optional(),
})
export type PackageSearchResponse = z.infer<typeof packageSearchResponseSchema>

/* ── package detail (single product) ─────────────────────────────────── */

const packageOfferFlightSchema = z.object({
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  departureAt: z.string().nullable(),
  carrier: z.string().nullable(),
  flightNumber: z.string().nullable(),
})

export const packageOfferSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  checkIn: z.string().nullable(),
  checkOut: z.string().nullable(),
  nights: z.number().nullable(),
  board: z.string().nullable(),
  roomTypeId: z.string().nullable(),
  /** Stable rate-plan key (e.g. `HOTEL:ROOM:AI`); `board` is its trailing
   *  segment. Used to pin the exact rate through the journey (voyant#1579). */
  ratePlanId: z.string().nullable().optional(),
  perPerson: moneyMinorSchema.nullable(),
  total: moneyMinorSchema.nullable(),
  flights: z.array(packageOfferFlightSchema),
  freeCancellationUntil: z.string().nullable(),
})
export type PackageOffer = z.infer<typeof packageOfferSchema>

const packageProductMediaSchema = z.object({
  src: z.string(),
  rel: z.string().nullable(),
  caption: z.string().nullable(),
})

export const packageProductDetailSchema = z.object({
  name: z.string().nullable(),
  stars: z.number().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  countryCode: z.string().nullable(),
  category: z.string().nullable(),
  media: z.array(packageProductMediaSchema),
  sections: z.array(
    z.object({
      title: z.string().nullable(),
      kind: z.string().nullable(),
      type: z.string().nullable(),
      lines: z.array(z.string()),
    }),
  ),
  features: z.array(
    z.object({
      code: z.string().nullable(),
      label: z.string().nullable(),
      type: z.string().nullable(),
    }),
  ),
  rooms: z.array(
    z.object({
      code: z.string().nullable(),
      name: z.string().nullable(),
      area: z.number().nullable(),
      maxGuests: z.number().nullable(),
      view: z.string().nullable(),
      specifications: z.array(z.string()),
      image: z.string().nullable(),
    }),
  ),
  reviews: z
    .object({
      source: z.string().nullable(),
      rating: z.number().nullable(),
      reviewsCount: z.number().nullable(),
      subratings: z.array(z.object({ name: z.string().nullable(), value: z.number().nullable() })),
    })
    .nullable(),
})
export type PackageProductDetail = z.infer<typeof packageProductDetailSchema>

export const packageDetailSourceSchema = z
  .object({
    kind: z.string().nullable().optional(),
    connectionId: z.string(),
    ref: z.string().nullable(),
  })
  .nullable()
export type PackageDetailSource = z.infer<typeof packageDetailSourceSchema>

export const packageDetailResponseSchema = z.object({
  product: packageProductDetailSchema.nullable().optional(),
  offers: z.array(packageOfferSchema).optional(),
  retryable: z.boolean().optional(),
  source: packageDetailSourceSchema.optional(),
})
export type PackageDetailResponse = z.infer<typeof packageDetailResponseSchema>

/* ── cruise price + per-sailing pricing ──────────────────────────────── */

export const cruisePriceResponseSchema = z.object({
  fromAmountMinor: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
})
export type CruisePriceResponse = z.infer<typeof cruisePriceResponseSchema>

export const cruiseCabinPriceSchema = z.object({
  code: z.string(),
  fromAmountMinor: z.number(),
  available: z.boolean(),
})
export type CruiseCabinPrice = z.infer<typeof cruiseCabinPriceSchema>

export const cruiseSailingPricingResponseSchema = z.object({
  cabins: z.array(cruiseCabinPriceSchema).optional(),
  currency: z.string().nullable().optional(),
})
export type CruiseSailingPricingResponse = z.infer<typeof cruiseSailingPricingResponseSchema>

/* ── cruise content (opaque payload, mapped by the consumer) ─────────── */

export const catalogContentProvenanceSchema = z.object({
  source_kind: z.string(),
  source_provider: z.string().nullable().optional(),
  source_connection_id: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
})
export type CatalogContentProvenance = z.infer<typeof catalogContentProvenanceSchema>

export const cruiseContentResponseSchema = z.object({
  data: z
    .object({
      content: z.unknown(),
      provenance: catalogContentProvenanceSchema.optional(),
    })
    .partial()
    .optional(),
})
export type CruiseContentResponse = z.infer<typeof cruiseContentResponseSchema>

/* ── availability slots ──────────────────────────────────────────────── */

export const catalogSlotSchema = z.object({
  id: z.string(),
  startsAt: z.string().optional(),
  status: z.string().nullable().optional(),
  unlimited: z.boolean().nullable().optional(),
  remainingPax: z.number().nullable().optional(),
  initialPax: z.number().nullable().optional(),
})
export type CatalogSlot = z.infer<typeof catalogSlotSchema>

export const catalogSlotsResponseSchema = z.object({
  rows: z.array(catalogSlotSchema),
})
export type CatalogSlotsResponse = z.infer<typeof catalogSlotsResponseSchema>
