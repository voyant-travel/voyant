import { z } from "zod"
import { boardBasisSchema } from "./board-basis.js"
import { componentRefSchema } from "./component-ref.js"

export const travelComponentKindSchema = z.enum([
  "accommodation",
  "transport",
  "activity",
  "meal",
  "insurance",
  "other",
])

export const componentSelectionModeSchema = z.enum(["fixed", "choose_one", "multi", "optional"])

export const componentCommitmentBoundarySchema = z.enum([
  "internal",
  "dependent_component",
  "independent_component",
])

export const componentPriceDispositionSchema = z.enum(["included", "add_on"])

export const travelComponentMediaItemSchema = z.object({
  url: z.string(),
  type: z.enum(["image", "video", "document"]).default("image"),
  caption: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
})

export const travelComponentLocationSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
})

export const accommodationComponentPropertySchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  star_rating: z.number().min(0).max(5).nullable().optional(),
  hero_image_url: z.string().nullable().optional(),
  location: travelComponentLocationSchema.optional(),
  amenities: z.array(z.string()).optional().default([]),
  media: z.array(travelComponentMediaItemSchema).optional().default([]),
})

export const accommodationComponentRoomTypeSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  room_class: z.string().nullable().optional(),
  view: z.string().nullable().optional(),
  max_adults: z.number().int().nonnegative().nullable().optional(),
  max_children: z.number().int().nonnegative().nullable().optional(),
  max_occupancy: z.number().int().nonnegative().nullable().optional(),
})

export const accommodationComponentRatePlanSchema = z.object({
  id: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  board_basis: boardBasisSchema.nullable().optional(),
  inclusions: z.array(z.string()).optional().default([]),
  cancellation_summary: z.string().nullable().optional(),
})

export const accommodationComponentContentSchema = z.object({
  property: accommodationComponentPropertySchema,
  room_type: accommodationComponentRoomTypeSchema.optional(),
  rate_plan: accommodationComponentRatePlanSchema.optional(),
  board_basis: boardBasisSchema.nullable().optional(),
  nights: z.number().int().positive().nullable().optional(),
})

export const transportModeSchema = z.enum(["coach", "flight", "rail", "ferry", "transfer"])

export const transportLegSchema = z.object({
  mode: transportModeSchema,
  carrier: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  service_class: z.string().nullable().optional(),
  from: travelComponentLocationSchema.optional(),
  to: travelComponentLocationSchema.optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  duration_minutes: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const transportComponentContentSchema = z.object({
  legs: z.array(transportLegSchema).default([]),
  summary: z.string().nullable().optional(),
})

export const genericComponentContentSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  inclusions: z.array(z.string()).optional().default([]),
  media: z.array(travelComponentMediaItemSchema).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const componentPricingRefSchema = z.object({
  option_id: z.string().nullable().optional(),
  option_unit_id: z.string().nullable().optional(),
  pricing_category_id: z.string().nullable().optional(),
  price_catalog_id: z.string().nullable().optional(),
  price_schedule_id: z.string().nullable().optional(),
})

export const componentChoiceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  ref: componentRefSchema.optional(),
  pricing_ref: componentPricingRefSchema.optional(),
  is_default: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const travelComponentBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  selection: componentSelectionModeSchema.default("fixed"),
  commitment_boundary: componentCommitmentBoundarySchema.default("internal"),
  price_disposition: componentPriceDispositionSchema.default("included"),
  required: z.boolean().optional(),
  quantity: z.number().int().positive().nullable().optional(),
  sort_order: z.number().int().optional(),
  tags: z.array(z.string()).optional().default([]),
  choices: z.array(componentChoiceSchema).optional().default([]),
  media: z.array(travelComponentMediaItemSchema).optional().default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const travelComponentRefBindingSchema = z.object({
  type: z.literal("ref"),
  ref: componentRefSchema,
  summary: genericComponentContentSchema.optional(),
})

function inlineBindingSchema<T extends z.ZodTypeAny>(contentSchema: T) {
  return z.object({
    type: z.literal("inline"),
    content: contentSchema,
  })
}

export const accommodationTravelComponentSchema = travelComponentBaseSchema.extend({
  component_kind: z.literal("accommodation"),
  binding: z.union([
    travelComponentRefBindingSchema,
    inlineBindingSchema(accommodationComponentContentSchema),
  ]),
})

export const transportTravelComponentSchema = travelComponentBaseSchema.extend({
  component_kind: z.literal("transport"),
  binding: z.union([
    travelComponentRefBindingSchema,
    inlineBindingSchema(transportComponentContentSchema),
  ]),
})

export const activityTravelComponentSchema = travelComponentBaseSchema.extend({
  component_kind: z.literal("activity"),
  binding: z.union([
    travelComponentRefBindingSchema,
    inlineBindingSchema(genericComponentContentSchema),
  ]),
})

export const mealTravelComponentSchema = travelComponentBaseSchema.extend({
  component_kind: z.literal("meal"),
  binding: z.union([
    travelComponentRefBindingSchema,
    inlineBindingSchema(genericComponentContentSchema),
  ]),
})

export const insuranceTravelComponentSchema = travelComponentBaseSchema.extend({
  component_kind: z.literal("insurance"),
  binding: z.union([
    travelComponentRefBindingSchema,
    inlineBindingSchema(genericComponentContentSchema),
  ]),
})

export const otherTravelComponentSchema = travelComponentBaseSchema.extend({
  component_kind: z.literal("other"),
  binding: z.union([
    travelComponentRefBindingSchema,
    inlineBindingSchema(genericComponentContentSchema),
  ]),
})

export const travelComponentSchema = z.discriminatedUnion("component_kind", [
  accommodationTravelComponentSchema,
  transportTravelComponentSchema,
  activityTravelComponentSchema,
  mealTravelComponentSchema,
  insuranceTravelComponentSchema,
  otherTravelComponentSchema,
])

export type TravelComponentKind = z.infer<typeof travelComponentKindSchema>
export type ComponentSelectionMode = z.infer<typeof componentSelectionModeSchema>
export type ComponentCommitmentBoundary = z.infer<typeof componentCommitmentBoundarySchema>
export type ComponentPriceDisposition = z.infer<typeof componentPriceDispositionSchema>
export type TravelComponentMediaItem = z.infer<typeof travelComponentMediaItemSchema>
export type TravelComponentLocation = z.infer<typeof travelComponentLocationSchema>
export type AccommodationComponentContent = z.infer<typeof accommodationComponentContentSchema>
export type TransportMode = z.infer<typeof transportModeSchema>
export type TransportLeg = z.infer<typeof transportLegSchema>
export type TransportComponentContent = z.infer<typeof transportComponentContentSchema>
export type GenericComponentContent = z.infer<typeof genericComponentContentSchema>
export type ComponentPricingRef = z.infer<typeof componentPricingRefSchema>
export type ComponentChoice = z.infer<typeof componentChoiceSchema>
export type TravelComponent = z.infer<typeof travelComponentSchema>

export function validateTravelComponent(
  payload: unknown,
): { valid: true; component: TravelComponent } | { valid: false; reason: string } {
  const result = travelComponentSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, component: result.data }
  }
  const issue = result.error.issues[0]
  return {
    valid: false,
    reason: issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed",
  }
}
