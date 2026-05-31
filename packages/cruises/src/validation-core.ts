import {
  cruiseSailingDirectionSchema,
  cruiseStatusSchema,
  cruiseTypeSchema,
  cruiseVoyageGroupKindSchema,
  cruiseVoyageSegmentKindSchema,
  cruiseVoyageSegmentRoleSchema,
  currencyCodeSchema,
  externalRefsSchema,
  isoDateSchema,
  moneyStringSchema,
  sailingSalesStatusSchema,
  slugSchema,
  z,
} from "./validation-shared.js"

const voyageGroupCoreSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255),
  groupKind: cruiseVoyageGroupKindSchema,
  lineSupplierId: z.string().optional().nullable(),
  nights: z.number().int().min(0),
  embarkPortFacilityId: z.string().optional().nullable(),
  embarkPortCanonicalPlaceId: z.string().optional().nullable(),
  disembarkPortFacilityId: z.string().optional().nullable(),
  disembarkPortCanonicalPlaceId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  highlights: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  heroImageUrl: z.string().url().optional().nullable(),
  mapImageUrl: z.string().url().optional().nullable(),
  status: cruiseStatusSchema.default("draft"),
  lowestPriceCached: moneyStringSchema.optional().nullable(),
  lowestPriceCurrencyCached: currencyCodeSchema.optional().nullable(),
  earliestDepartureCached: isoDateSchema.optional().nullable(),
  latestDepartureCached: isoDateSchema.optional().nullable(),
  externalRefs: externalRefsSchema,
})

export const insertVoyageGroupSchema = voyageGroupCoreSchema
export const updateVoyageGroupSchema = voyageGroupCoreSchema.partial()

export const voyageGroupListQuerySchema = z.object({
  groupKind: cruiseVoyageGroupKindSchema.optional(),
  status: cruiseStatusSchema.optional(),
  lineSupplierId: z.string().optional(),
  region: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertVoyageGroup = z.infer<typeof insertVoyageGroupSchema>
export type UpdateVoyageGroup = z.infer<typeof updateVoyageGroupSchema>
export type VoyageGroupListQuery = z.infer<typeof voyageGroupListQuerySchema>

const cruiseCoreSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255),
  cruiseType: cruiseTypeSchema,
  lineSupplierId: z.string().optional().nullable(),
  defaultShipId: z.string().optional().nullable(),
  nights: z.number().int().positive(),
  embarkPortFacilityId: z.string().optional().nullable(),
  embarkPortCanonicalPlaceId: z.string().optional().nullable(),
  disembarkPortFacilityId: z.string().optional().nullable(),
  disembarkPortCanonicalPlaceId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  highlights: z.array(z.string()).default([]),
  inclusionsHtml: z.string().optional().nullable(),
  exclusionsHtml: z.string().optional().nullable(),
  regions: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  heroImageUrl: z.string().url().optional().nullable(),
  mapImageUrl: z.string().url().optional().nullable(),
  status: cruiseStatusSchema.default("draft"),
  externalRefs: externalRefsSchema,
})

export const insertCruiseSchema = cruiseCoreSchema
export const updateCruiseSchema = cruiseCoreSchema.partial()

export const cruiseListQuerySchema = z.object({
  cruiseType: cruiseTypeSchema.optional(),
  status: cruiseStatusSchema.optional(),
  lineSupplierId: z.string().optional(),
  region: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertCruise = z.infer<typeof insertCruiseSchema>
export type UpdateCruise = z.infer<typeof updateCruiseSchema>
export type CruiseListQuery = z.infer<typeof cruiseListQuerySchema>

const sailingCoreSchema = z.object({
  cruiseId: z.string(),
  shipId: z.string(),
  departureDate: isoDateSchema,
  returnDate: isoDateSchema,
  embarkPortFacilityId: z.string().optional().nullable(),
  embarkPortCanonicalPlaceId: z.string().optional().nullable(),
  disembarkPortFacilityId: z.string().optional().nullable(),
  disembarkPortCanonicalPlaceId: z.string().optional().nullable(),
  direction: cruiseSailingDirectionSchema.optional().nullable(),
  availabilityNote: z.string().optional().nullable(),
  isCharter: z.boolean().default(false),
  salesStatus: sailingSalesStatusSchema.default("open"),
  externalRefs: externalRefsSchema,
})

export const insertSailingSchema = sailingCoreSchema
export const updateSailingSchema = sailingCoreSchema.partial()

export const sailingListQuerySchema = z.object({
  cruiseId: z.string().optional(),
  shipId: z.string().optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  salesStatus: sailingSalesStatusSchema.optional(),
  direction: cruiseSailingDirectionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertSailing = z.infer<typeof insertSailingSchema>
export type UpdateSailing = z.infer<typeof updateSailingSchema>
export type SailingListQuery = z.infer<typeof sailingListQuerySchema>

const voyageGroupSegmentFields = {
  voyageGroupId: z.string(),
  sortOrder: z.number().int().min(0),
  segmentKind: cruiseVoyageSegmentKindSchema,
  segmentRole: cruiseVoyageSegmentRoleSchema.default("core"),
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  cruiseId: z.string().optional().nullable(),
  sailingId: z.string().optional().nullable(),
  startDay: z.number().int().positive().optional().nullable(),
  endDay: z.number().int().positive().optional().nullable(),
  startDate: isoDateSchema.optional().nullable(),
  endDate: isoDateSchema.optional().nullable(),
  embarkPortFacilityId: z.string().optional().nullable(),
  embarkPortCanonicalPlaceId: z.string().optional().nullable(),
  disembarkPortFacilityId: z.string().optional().nullable(),
  disembarkPortCanonicalPlaceId: z.string().optional().nullable(),
  nights: z.number().int().min(0).optional().nullable(),
  externalRefs: externalRefsSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
} satisfies z.ZodRawShape

function validateVoyageSegmentRange(
  value: {
    startDay?: number | null
    endDay?: number | null
    startDate?: string | null
    endDate?: string | null
  },
  ctx: z.RefinementCtx,
) {
  if (value.startDay && value.endDay && value.endDay < value.startDay) {
    ctx.addIssue({
      code: "custom",
      path: ["endDay"],
      message: "endDay must be greater than or equal to startDay",
    })
  }
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be greater than or equal to startDate",
    })
  }
}

const voyageGroupSegmentBaseSchema = z.object(voyageGroupSegmentFields)
const voyageGroupSegmentCoreSchema = voyageGroupSegmentBaseSchema.superRefine(
  validateVoyageSegmentRange,
)

export const insertVoyageGroupSegmentSchema = voyageGroupSegmentCoreSchema
export const insertVoyageGroupScopedSegmentSchema = z
  .object({
    ...voyageGroupSegmentFields,
    voyageGroupId: z.string().optional(),
  })
  .superRefine(validateVoyageSegmentRange)
export const updateVoyageGroupSegmentSchema = voyageGroupSegmentBaseSchema
  .partial()
  .superRefine(validateVoyageSegmentRange)

export const voyageGroupSegmentListQuerySchema = z.object({
  voyageGroupId: z.string().optional(),
  cruiseId: z.string().optional(),
  sailingId: z.string().optional(),
  segmentKind: cruiseVoyageSegmentKindSchema.optional(),
  segmentRole: cruiseVoyageSegmentRoleSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type InsertVoyageGroupSegment = z.infer<typeof insertVoyageGroupSegmentSchema>
export type UpdateVoyageGroupSegment = z.infer<typeof updateVoyageGroupSegmentSchema>
export type VoyageGroupSegmentListQuery = z.infer<typeof voyageGroupSegmentListQuerySchema>
