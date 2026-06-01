/**
 * Cruises content shape — the rich detail-page content shape returned
 * by `getContent` for sourced cruises.
 *
 * The doc's "cruise content aggregate" (§E in the migration plan +
 * §3.2): `{ cruise, ship, sailings[], cabinCategories[], itineraryStops[],
 * policies[] }` is one content payload returned by a single getContent.
 * The cruise adapter's existing internal multi-call composition
 * (`fetchCruise / fetchSailing / fetchShip / fetchItinerary`) flattens
 * to one `GetContentResult.content` blob; the public adapter contract
 * gets one method, not five.
 *
 * Full pricing stays out — it's volatile and continues to flow through
 * `liveResolve`. The content blob carries structural cabin categories and
 * itinerary stops, plus optional per-sailing browse price summaries as
 * integer minor units paired with currency.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2, §E.
 */

import { z } from "zod"

import {
  CABIN_ACCESSIBILITY_FEATURES,
  CABIN_BED_CONFIGURATIONS,
  CABIN_VIEW_TYPES,
} from "./cabin-features.js"

export const CRUISES_CONTENT_SCHEMA_VERSION = "cruises/v1"

export const cruiseSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  description: z.string().nullable().optional(),
  cruise_type: z.string().nullable().optional(),
  hero_image_url: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional(),
  cruise_line: z.string().nullable().optional(),
  duration_nights: z.number().int().nonnegative().nullable().optional(),
  embarkation_port: z.string().nullable().optional(),
  disembarkation_port: z.string().nullable().optional(),
})

export const cruiseShipSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  /** ocean / river / expedition / yacht / sailing / coastal. */
  ship_type: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  capacity: z.number().int().nonnegative().nullable().optional(),
  decks: z.number().int().nonnegative().nullable().optional(),
  year_built: z.number().int().nonnegative().nullable().optional(),
  /** Ship photo URLs (cover first). */
  gallery: z.array(z.string()).optional().default([]),
})

export const cruiseItineraryStopSchema = z.object({
  day_number: z.number().int().positive(),
  date: z.string().nullable().optional(),
  port_name: z.string(),
  arrival_time: z.string().nullable().optional(),
  departure_time: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_at_sea: z.boolean().optional().default(false),
})

export const cruiseSailingSchema = z
  .object({
    id: z.string(),
    source_ref: z.string().nullable().optional(),
    start_date: z.string(),
    end_date: z.string(),
    duration_nights: z.number().int().nonnegative().nullable().optional(),
    status: z.string().nullable().optional(),
    embarkation_port: z.string().nullable().optional(),
    disembarkation_port: z.string().nullable().optional(),
    itinerary_stops: z.array(cruiseItineraryStopSchema).default([]),
    lowest_price_cents: z.number().int().nonnegative().nullable().default(null),
    currency: z.string().min(1).nullable().default(null),
  })
  .superRefine((sailing, ctx) => {
    const hasLowestPrice = sailing.lowest_price_cents !== null
    const hasCurrency = sailing.currency !== null
    if (hasLowestPrice === hasCurrency) return
    ctx.addIssue({
      code: "custom",
      path: hasLowestPrice ? ["currency"] : ["lowest_price_cents"],
      message: "lowest_price_cents and currency must both be present or both be null",
    })
  })

export const cruiseCabinCategorySchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.string().nullable().optional(), // inside, outside, balcony, suite
  capacity_min: z.number().int().nonnegative().nullable().optional(),
  capacity_max: z.number().int().nonnegative().nullable().optional(),
  /** Cabin photo URLs (cover first). */
  images: z.array(z.string()).optional().default([]),
  /** Cabin size, as the source reports it (e.g. "270" sqft). */
  square_feet: z.string().nullable().optional(),
  inclusions: z.array(z.string()).optional().default([]),
  feature_codes: z.array(z.string()).default([]),
  bed_configurations: z.array(z.enum(CABIN_BED_CONFIGURATIONS)).default([]),
  accessibility_features: z.array(z.enum(CABIN_ACCESSIBILITY_FEATURES)).default([]),
  view_type: z.enum(CABIN_VIEW_TYPES).nullable().default(null),
})

export const cruisePolicySchema = z.object({
  kind: z.enum(["cancellation", "payment", "supplier_notes", "requirements"]),
  body: z.string(),
  rules: z.unknown().optional(),
})

export const cruiseContentSchema = z.object({
  cruise: cruiseSummarySchema,
  ship: cruiseShipSchema.nullable().optional(),
  sailings: z.array(cruiseSailingSchema).default([]),
  cabin_categories: z.array(cruiseCabinCategorySchema).default([]),
  itinerary_stops: z.array(cruiseItineraryStopSchema).default([]),
  policies: z.array(cruisePolicySchema).default([]),
})

export type CruiseContent = z.infer<typeof cruiseContentSchema>
export type CruiseSummary = z.infer<typeof cruiseSummarySchema>
export type CruiseShip = z.infer<typeof cruiseShipSchema>
export type CruiseSailing = z.infer<typeof cruiseSailingSchema>
export type CruiseCabinCategory = z.infer<typeof cruiseCabinCategorySchema>
export type CruiseItineraryStop = z.infer<typeof cruiseItineraryStopSchema>
export type CruisePolicy = z.infer<typeof cruisePolicySchema>

export function validateCruiseContent(
  payload: unknown,
): { valid: true; content: CruiseContent } | { valid: false; reason: string } {
  const result = cruiseContentSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, content: result.data }
  }
  const issue = result.error.issues[0]
  return {
    valid: false,
    reason: issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed",
  }
}
