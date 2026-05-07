import {
  booleanQueryParam,
  optionUnitTypeSchema,
  productBookingModeSchema,
  productCapacityModeSchema,
  productOptionStatusSchema,
  productStatusSchema,
  productVisibilitySchema,
  typeIdSchema,
  z,
} from "./validation-shared.js"

const productDepositRuleSchema = z.object({
  kind: z.enum(["none", "percent", "fixed_cents"]),
  percent: z.number().min(0).max(100).optional(),
  amountCents: z.number().int().min(0).optional(),
})

const productCustomerPaymentPolicySchema = z.object({
  deposit: productDepositRuleSchema,
  minDaysBeforeDepartureForDeposit: z.number().int().min(0),
  balanceDueDaysBeforeDeparture: z.number().int().min(0),
  balanceDueMinDaysFromNow: z.number().int().min(0),
})

const productCoreSchema = z.object({
  name: z.string().min(1).max(255),
  status: productStatusSchema.default("draft"),
  description: z.string().optional().nullable(),
  bookingMode: productBookingModeSchema.default("date"),
  capacityMode: productCapacityModeSchema.default("limited"),
  timezone: z.string().max(100).optional().nullable(),
  visibility: productVisibilitySchema.default("private"),
  activated: z.boolean().default(false),
  reservationTimeoutMinutes: z.number().int().min(0).optional().nullable(),
  sellCurrency: z.string().min(3).max(3),
  facilityId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  productTypeId: z.string().optional().nullable(),
  taxClassId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  pax: z.number().int().positive().optional().nullable(),
  customerPaymentPolicy: productCustomerPaymentPolicySchema.optional().nullable(),
  tags: z.array(z.string()).default([]),
})

const productPricingFields = {
  sellAmountCents: z.number().int().min(0).optional().nullable(),
  costAmountCents: z.number().int().min(0).optional().nullable(),
  marginPercent: z.number().int().optional().nullable(),
}

export const insertProductSchema = productCoreSchema.extend(productPricingFields)
export const updateProductSchema = productCoreSchema.partial().extend(productPricingFields)
export const selectProductSchema = productCoreSchema.extend({
  id: typeIdSchema("products"),
  sellAmountCents: z.number().int().nullable(),
  costAmountCents: z.number().int().nullable(),
  marginPercent: z.number().int().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export const productListQuerySchema = z.object({
  status: productStatusSchema.optional(),
  bookingMode: productBookingModeSchema.optional(),
  visibility: productVisibilitySchema.optional(),
  activated: booleanQueryParam.optional(),
  facilityId: z.string().optional(),
  supplierId: z.string().optional(),
  productTypeId: z.string().optional(),
  taxClassId: z.string().optional(),
  categoryId: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const productAggregatesQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
export type InsertProduct = z.infer<typeof insertProductSchema>
export type UpdateProduct = z.infer<typeof updateProductSchema>
export type SelectProduct = z.infer<typeof selectProductSchema>

const productOptionCoreSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  status: productOptionStatusSchema.default("draft"),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  availableFrom: z.string().optional().nullable(),
  availableTo: z.string().optional().nullable(),
})
export const insertProductOptionSchema = productOptionCoreSchema
export const updateProductOptionSchema = productOptionCoreSchema.partial()
export const productOptionListQuerySchema = z.object({
  productId: z.string().optional(),
  status: productOptionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type InsertProductOption = z.infer<typeof insertProductOptionSchema>
export type UpdateProductOption = z.infer<typeof updateProductOptionSchema>

const optionUnitCoreSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  unitType: optionUnitTypeSchema.default("person"),
  minQuantity: z.number().int().min(0).optional().nullable(),
  maxQuantity: z.number().int().min(0).optional().nullable(),
  minAge: z.number().int().min(0).optional().nullable(),
  maxAge: z.number().int().min(0).optional().nullable(),
  occupancyMin: z.number().int().min(0).optional().nullable(),
  occupancyMax: z.number().int().min(0).optional().nullable(),
  isRequired: z.boolean().default(false),
  isHidden: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

// Room and vehicle units carry capacity that the storefront pricing math
// multiplies by (e.g. `room.occupancy * room.quantity` for per_person
// totals in service-departures). Without occupancyMin set, the multiplier
// silently falls back to 1 and the booking under-charges — see #481.
const OCCUPANCY_REQUIRED_TYPES = new Set(["room", "vehicle"])

type OccupancyShape = {
  unitType?: string | null | undefined
  occupancyMin?: number | null | undefined
  occupancyMax?: number | null | undefined
}

type OccupancyIssue = { path: string[]; message: string }

function collectOccupancyIssues(data: OccupancyShape): OccupancyIssue[] {
  const issues: OccupancyIssue[] = []
  if (
    data.unitType &&
    OCCUPANCY_REQUIRED_TYPES.has(data.unitType) &&
    (data.occupancyMin == null || data.occupancyMin < 1)
  ) {
    issues.push({
      path: ["occupancyMin"],
      message: `${data.unitType} units must declare occupancyMin (≥ 1)`,
    })
  }
  if (
    data.occupancyMin != null &&
    data.occupancyMax != null &&
    data.occupancyMax < data.occupancyMin
  ) {
    issues.push({
      path: ["occupancyMax"],
      message: "occupancyMax must be ≥ occupancyMin",
    })
  }
  return issues
}

export const insertOptionUnitSchema = optionUnitCoreSchema.superRefine((data, ctx) => {
  for (const issue of collectOccupancyIssues(data)) {
    ctx.addIssue({ code: "custom", ...issue })
  }
})

// Partial-update schema only enforces what's statically decidable from the
// patch alone. The "unitType room/vehicle requires occupancyMin" rule needs
// the merged record state, so it lives in the service layer below
// (validateMergedOptionUnit).
export const updateOptionUnitSchema = optionUnitCoreSchema.partial().superRefine((data, ctx) => {
  if (
    data.occupancyMin != null &&
    data.occupancyMax != null &&
    data.occupancyMax < data.occupancyMin
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["occupancyMax"],
      message: "occupancyMax must be ≥ occupancyMin",
    })
  }
})

/**
 * Validate the merged state of an option unit — the persisted record with a
 * patch applied. The partial-update schema only sees the patch payload, so
 * it can't catch e.g. PATCH `{ occupancyMin: null }` clearing occupancy on a
 * unit whose persisted unitType is already "room". The service layer fetches
 * the existing row, applies the patch, and runs this against the merged
 * shape before writing.
 */
export function validateMergedOptionUnit(
  merged: OccupancyShape,
): { ok: true } | { ok: false; issues: OccupancyIssue[] } {
  const issues = collectOccupancyIssues(merged)
  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}
export const optionUnitListQuerySchema = z.object({
  optionId: z.string().optional(),
  unitType: optionUnitTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type InsertOptionUnit = z.infer<typeof insertOptionUnitSchema>
export type UpdateOptionUnit = z.infer<typeof updateOptionUnitSchema>

export const insertVersionSchema = z.object({
  notes: z.string().max(10000).optional().nullable(),
})
export type InsertVersion = z.infer<typeof insertVersionSchema>

export const insertProductNoteSchema = z.object({
  content: z.string().min(1).max(10000),
})
