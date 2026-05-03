/**
 * Hospitality content shape — the rich detail-page content shape
 * returned by `getContent` for sourced room types (bedbanks like
 * Hotelbeds / Expedia, direct-property feeds, hotel groups via Voyant
 * Connect).
 *
 * Per sourced-content §3.6, the hospitality content aggregate is
 * `{ hotel, room_types[], rate_plans[], meal_plans[], amenities[],
 * policies[] }` — one payload returned by a single `getContent`.
 * Pricing stays out (volatile-live, flows through `liveResolve`).
 *
 * The aggregate is **per property** — one row per property × locale ×
 * market — even though the sellable catalog entry is a room type.
 * That's because bedbanks return whole-property payloads and splitting
 * by room type would multiply cache writes and refresh work without
 * benefit. The vertical's read service projects the cached property
 * payload to the requested room-type detail page.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2, §3.5.4, §3.6.
 */

import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"
import { z } from "zod"

export const HOSPITALITY_CONTENT_SCHEMA_VERSION = "hospitality/v1"

export const hotelSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  star_rating: z.number().min(0).max(5).nullable().optional(),
  hero_image_url: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional(),
  brand: z.string().nullable().optional(),
  // Geo / location
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  // Operational
  check_in_time: z.string().nullable().optional(),
  check_out_time: z.string().nullable().optional(),
})

export const hospitalityRoomTypeSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  room_class: z.string().nullable().optional(), // e.g. "deluxe", "suite"
  /** Inside / outside / balcony / suite — bedbank conventions vary. */
  view: z.string().nullable().optional(),
  bedrooms: z.number().int().nonnegative().nullable().optional(),
  beds: z.array(z.string()).optional().default([]),
  size_sqm: z.number().int().nonnegative().nullable().optional(),
  max_adults: z.number().int().nonnegative().nullable().optional(),
  max_children: z.number().int().nonnegative().nullable().optional(),
  max_occupancy: z.number().int().nonnegative().nullable().optional(),
  amenities: z.array(z.string()).optional().default([]),
  images: z.array(z.string()).optional().default([]),
})

export const hospitalityRatePlanSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  /** "per_night" | "per_stay" — the plan's charge frequency. */
  charge_frequency: z.enum(["per_night", "per_stay"]).optional().default("per_night"),
  /** Room types this plan is bookable on; empty = all. */
  applies_to_room_type_ids: z.array(z.string()).optional().default([]),
  cancellation_policy: z.string().nullable().optional(),
  inclusions: z.array(z.string()).optional().default([]),
})

export const hospitalityMealPlanSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  /** "room_only" | "bed_breakfast" | "half_board" | "full_board" | "all_inclusive". */
  basis: z.string(),
  inclusions: z.array(z.string()).optional().default([]),
})

export const hospitalityAmenitySchema = z.object({
  id: z.string(),
  /** "pool" | "spa" | "wifi" | … */
  category: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  is_free: z.boolean().optional(),
})

export const hospitalityPolicySchema = z.object({
  kind: z.enum(["cancellation", "payment", "supplier_notes", "requirements", "check_in"]),
  body: z.string(),
  rules: z.unknown().optional(),
})

export const hospitalityContentSchema = z.object({
  hotel: hotelSummarySchema,
  room_types: z.array(hospitalityRoomTypeSchema).default([]),
  rate_plans: z.array(hospitalityRatePlanSchema).default([]),
  meal_plans: z.array(hospitalityMealPlanSchema).default([]),
  amenities: z.array(hospitalityAmenitySchema).default([]),
  policies: z.array(hospitalityPolicySchema).default([]),
})

export type HospitalityContent = z.infer<typeof hospitalityContentSchema>
export type HotelSummary = z.infer<typeof hotelSummarySchema>
export type HospitalityRoomType = z.infer<typeof hospitalityRoomTypeSchema>
export type HospitalityRatePlan = z.infer<typeof hospitalityRatePlanSchema>
export type HospitalityMealPlan = z.infer<typeof hospitalityMealPlanSchema>
export type HospitalityAmenity = z.infer<typeof hospitalityAmenitySchema>
export type HospitalityPolicy = z.infer<typeof hospitalityPolicySchema>

export function validateHospitalityContent(
  payload: unknown,
): { valid: true; content: HospitalityContent } | { valid: false; reason: string } {
  const result = hospitalityContentSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, content: result.data }
  }
  const issue = result.error.issues[0]
  return {
    valid: false,
    reason: issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed",
  }
}

export function mergeOverlaysIntoHospitalityContent(
  payload: HospitalityContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): HospitalityContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    validate(p) {
      const r = validateHospitalityContent(p)
      return r.valid ? { valid: true } : { valid: false, reason: r.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  return hospitalityContentSchema.parse(merged)
}
