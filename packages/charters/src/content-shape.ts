/**
 * Charters content shape — the rich detail-page content shape returned
 * by `getContent` for sourced charter products.
 *
 * The charters content aggregate is `{ charter, yacht, voyages[],
 * suites[], schedule_days[], policies[] }` — one payload returned by a
 * single `getContent`. Pricing stays out (volatile-live, flows through
 * `liveResolve`). Voyages here carry departure dates and structural
 * info; their fares come through `liveResolve`.
 *
 * Charters' MYBA-style products often include APA (Advance
 * Provisioning Allowance) terms in the policy block — captured under
 * `policies[].kind: "supplier_notes"` or a structured rule shape. The
 * synthesizer flattens what the projection knows.
 *
 * See `docs/architecture/catalog-sourced-content.md` §3.2, §3.5.4, §3.6.
 */

import {
  type ContentOverlay,
  type MergeOverlaysOptions,
  mergeOverlaysIntoContent,
} from "@voyantjs/catalog"
import { z } from "zod"

export const CHARTERS_CONTENT_SCHEMA_VERSION = "charters/v1"

export const charterSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
  description: z.string().nullable().optional(),
  charter_type: z.string().nullable().optional(), // "per_suite" | "whole_yacht"
  hero_image_url: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional(),
  cruising_area: z.string().nullable().optional(),
  base_port: z.string().nullable().optional(),
  duration_nights: z.number().int().nonnegative().nullable().optional(),
})

export const charterYachtSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.string().nullable().optional(), // motor / sail / catamaran
  length_meters: z.number().nullable().optional(),
  beam_meters: z.number().nullable().optional(),
  capacity_guests: z.number().int().nonnegative().nullable().optional(),
  capacity_crew: z.number().int().nonnegative().nullable().optional(),
  cabins: z.number().int().nonnegative().nullable().optional(),
  year_built: z.number().int().nonnegative().nullable().optional(),
  builder: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  amenities: z.array(z.string()).optional().default([]),
  images: z.array(z.string()).optional().default([]),
})

export const charterVoyageSchema = z.object({
  id: z.string(),
  source_ref: z.string().nullable().optional(),
  departure_date: z.string(),
  return_date: z.string().nullable().optional(),
  duration_nights: z.number().int().nonnegative().nullable().optional(),
  status: z.string().nullable().optional(), // "open" | "on_request" | "sold_out"
  embarkation_port: z.string().nullable().optional(),
  disembarkation_port: z.string().nullable().optional(),
  /** Whole-yacht voyages set this to false; per-suite voyages set true. */
  per_suite_bookable: z.boolean().optional(),
})

export const charterSuiteSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(), // "owner" | "vip" | "guest"
  capacity: z.number().int().nonnegative().nullable().optional(),
  has_balcony: z.boolean().optional(),
  size_sqm: z.number().int().nonnegative().nullable().optional(),
})

export const charterScheduleDaySchema = z.object({
  day_number: z.number().int().positive(),
  date: z.string().nullable().optional(),
  port_or_anchorage: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_at_sea: z.boolean().optional().default(false),
})

export const charterPolicySchema = z.object({
  kind: z.enum(["cancellation", "payment", "supplier_notes", "requirements", "apa"]),
  body: z.string(),
  rules: z.unknown().optional(),
})

export const charterContentSchema = z.object({
  charter: charterSummarySchema,
  yacht: charterYachtSchema.nullable().optional(),
  voyages: z.array(charterVoyageSchema).default([]),
  suites: z.array(charterSuiteSchema).default([]),
  schedule_days: z.array(charterScheduleDaySchema).default([]),
  policies: z.array(charterPolicySchema).default([]),
})

export type CharterContent = z.infer<typeof charterContentSchema>
export type CharterSummary = z.infer<typeof charterSummarySchema>
export type CharterYachtContent = z.infer<typeof charterYachtSchema>
export type CharterVoyageContent = z.infer<typeof charterVoyageSchema>
export type CharterSuiteContent = z.infer<typeof charterSuiteSchema>
export type CharterScheduleDay = z.infer<typeof charterScheduleDaySchema>
export type CharterPolicy = z.infer<typeof charterPolicySchema>

export function validateCharterContent(
  payload: unknown,
): { valid: true; content: CharterContent } | { valid: false; reason: string } {
  const result = charterContentSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, content: result.data }
  }
  const issue = result.error.issues[0]
  return {
    valid: false,
    reason: issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed",
  }
}

export function mergeOverlaysIntoCharterContent(
  payload: CharterContent,
  overlays: ReadonlyArray<ContentOverlay>,
  options: Pick<MergeOverlaysOptions, "onOverlayError"> = {},
): CharterContent {
  const merged = mergeOverlaysIntoContent(payload, overlays, {
    validate(p) {
      const r = validateCharterContent(p)
      return r.valid ? { valid: true } : { valid: false, reason: r.reason }
    },
    onOverlayError: options.onOverlayError,
  })
  return charterContentSchema.parse(merged)
}
