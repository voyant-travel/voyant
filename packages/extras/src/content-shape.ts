/**
 * Extras content shape — the rich detail-page content shape returned
 * by `getContent` for sourced extras (excursions, transfers, add-on
 * services).
 *
 * The extras content aggregate is `{ extra, options[], media[],
 * policies[] }` — one payload returned by a single `getContent`.
 * Pricing stays out (volatile-live, flows through `liveResolve`).
 *
 * Extras are simpler than the other verticals because they're add-ons,
 * not standalone products. There's no day-by-day itinerary, no
 * room-type / cabin-category map, no ship spec — just an extra
 * description, optional sub-options (e.g. "half-day vs full-day"),
 * media, and the operational/cancellation policies.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2, §3.5.4, §3.6.
 */

import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"
import { z } from "zod"

export const EXTRAS_CONTENT_SCHEMA_VERSION = "extras/v1"

export const extraSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  description: z.string().nullable().optional(),
  /**
   * Selection type — mirrors the owned `extra_selection_type` enum:
   * "optional" | "required" | "default_selected" | "unavailable".
   * Sourced adapters set what they support; thin synthesis defaults to
   * "optional".
   */
  selection_type: z.string().optional(),
  /**
   * Pricing mode — mirrors the owned `extra_pricing_mode` enum:
   * "included" | "per_person" | "per_booking" | "quantity_based" |
   * "on_request" | "free". Captures the structural pricing model the
   * upstream advertises; actual prices come through `liveResolve`.
   */
  pricing_mode: z.string().optional(),
  /** Hint — true when the extra is priced per traveler, not per booking. */
  priced_per_person: z.boolean().optional(),
  /** Service category (e.g. "transfer", "excursion", "insurance", "spa"). */
  category: z.string().nullable().optional(),
  /** Hero media URL. */
  hero_image_url: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional(),
  /** Free-form supplier hint surfaced to ops (not customer-facing). */
  supplier: z.string().nullable().optional(),
  /** Estimated duration in minutes for time-bound extras (excursions). */
  duration_minutes: z.number().int().nonnegative().nullable().optional(),
  /** Constraints / requirements summary surfaced on the booking flow. */
  requirements_summary: z.string().nullable().optional(),
})

export const extraOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  /** Whether this option auto-selects when the extra is selected. */
  default_selected: z.boolean().optional(),
})

export const extraMediaItemSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "video", "document"]).default("image"),
  caption: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
})

export const extraPolicySchema = z.object({
  kind: z.enum(["cancellation", "payment", "supplier_notes", "requirements"]),
  body: z.string(),
  rules: z.unknown().optional(),
})

export const extraContentSchema = z.object({
  extra: extraSummarySchema,
  options: z.array(extraOptionSchema).default([]),
  media: z.array(extraMediaItemSchema).default([]),
  policies: z.array(extraPolicySchema).default([]),
})

export type ExtraContent = z.infer<typeof extraContentSchema>
export type ExtraSummary = z.infer<typeof extraSummarySchema>
export type ExtraOption = z.infer<typeof extraOptionSchema>
export type ExtraMediaItem = z.infer<typeof extraMediaItemSchema>
export type ExtraPolicy = z.infer<typeof extraPolicySchema>

export function validateExtraContent(
  payload: unknown,
): { valid: true; content: ExtraContent } | { valid: false; reason: string } {
  const result = extraContentSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, content: result.data }
  }
  const issue = result.error.issues[0]
  return {
    valid: false,
    reason: issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed",
  }
}

export function mergeOverlaysIntoExtraContent(
  payload: ExtraContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): ExtraContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    validate(p) {
      const r = validateExtraContent(p)
      return r.valid ? { valid: true } : { valid: false, reason: r.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  return extraContentSchema.parse(merged)
}
