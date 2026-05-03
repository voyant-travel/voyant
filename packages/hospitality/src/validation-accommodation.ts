import {
  booleanQueryParam,
  hospitalityGuaranteeModeSchema,
  hospitalityInventoryModeSchema,
  nullableInt,
  nullableMoney,
  nullableString,
  paginationSchema,
  ratePlanChargeFrequencySchema,
  roomUnitStatusSchema,
  z,
} from "./validation-shared.js"

export const roomTypeCoreSchema = z.object({
  propertyId: z.string(),
  supplierId: nullableString,
  code: nullableString,
  name: z.string().min(1).max(255),
  description: nullableString,
  inventoryMode: hospitalityInventoryModeSchema.default("pooled"),
  roomClass: nullableString,
  maxAdults: nullableInt,
  maxChildren: nullableInt,
  maxInfants: nullableInt,
  standardOccupancy: nullableInt,
  maxOccupancy: nullableInt,
  minOccupancy: nullableInt,
  bedroomCount: nullableInt,
  bathroomCount: nullableInt,
  areaValue: nullableInt,
  areaUnit: nullableString,
  accessibilityNotes: nullableString,
  smokingAllowed: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertRoomTypeSchema = roomTypeCoreSchema
export const updateRoomTypeSchema = roomTypeCoreSchema.partial()
export const roomTypeListQuerySchema = paginationSchema.extend({
  propertyId: z.string().optional(),
  supplierId: z.string().optional(),
  active: booleanQueryParam.optional(),
  inventoryMode: hospitalityInventoryModeSchema.optional(),
  search: z.string().optional(),
})

export const roomTypeBedConfigCoreSchema = z.object({
  roomTypeId: z.string(),
  bedType: z.string().min(1).max(100),
  quantity: z.number().int().min(1).default(1),
  isPrimary: z.boolean().default(false),
  notes: nullableString,
})
export const insertRoomTypeBedConfigSchema = roomTypeBedConfigCoreSchema
export const updateRoomTypeBedConfigSchema = roomTypeBedConfigCoreSchema.partial()
export const roomTypeBedConfigListQuerySchema = paginationSchema.extend({
  roomTypeId: z.string().optional(),
  bedType: z.string().optional(),
})

export const roomUnitCoreSchema = z.object({
  propertyId: z.string(),
  roomTypeId: z.string(),
  code: nullableString,
  roomNumber: nullableString,
  floor: nullableString,
  wing: nullableString,
  status: roomUnitStatusSchema.default("active"),
  viewCode: nullableString,
  accessibilityCode: nullableString,
  genderRestriction: nullableString,
  notes: nullableString,
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertRoomUnitSchema = roomUnitCoreSchema
export const updateRoomUnitSchema = roomUnitCoreSchema.partial()
export const roomUnitListQuerySchema = paginationSchema.extend({
  propertyId: z.string().optional(),
  roomTypeId: z.string().optional(),
  status: roomUnitStatusSchema.optional(),
  search: z.string().optional(),
})

export const mealPlanCoreSchema = z.object({
  propertyId: z.string(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: nullableString,
  includesBreakfast: z.boolean().default(false),
  includesLunch: z.boolean().default(false),
  includesDinner: z.boolean().default(false),
  includesDrinks: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertMealPlanSchema = mealPlanCoreSchema
export const updateMealPlanSchema = mealPlanCoreSchema.partial()
export const mealPlanListQuerySchema = paginationSchema.extend({
  propertyId: z.string().optional(),
  active: booleanQueryParam.optional(),
  search: z.string().optional(),
})

export const ratePlanCoreSchema = z.object({
  propertyId: z.string(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: nullableString,
  mealPlanId: z.string().nullable().optional(),
  priceCatalogId: z.string().nullable().optional(),
  cancellationPolicyId: z.string().nullable().optional(),
  marketId: z.string().nullable().optional(),
  currencyCode: z.string().length(3),
  chargeFrequency: ratePlanChargeFrequencySchema.default("per_night"),
  guaranteeMode: hospitalityGuaranteeModeSchema.default("none"),
  commissionable: z.boolean().default(true),
  refundable: z.boolean().default(true),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})
export const insertRatePlanSchema = ratePlanCoreSchema
export const updateRatePlanSchema = ratePlanCoreSchema.partial()
export const ratePlanListQuerySchema = paginationSchema.extend({
  propertyId: z.string().optional(),
  mealPlanId: z.string().optional(),
  marketId: z.string().optional(),
  active: booleanQueryParam.optional(),
  search: z.string().optional(),
})

export const ratePlanRoomTypeCoreSchema = z.object({
  ratePlanId: z.string(),
  roomTypeId: z.string(),
  productId: z.string().nullable().optional(),
  optionId: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})
export const insertRatePlanRoomTypeSchema = ratePlanRoomTypeCoreSchema
export const updateRatePlanRoomTypeSchema = ratePlanRoomTypeCoreSchema.partial()
export const ratePlanRoomTypeListQuerySchema = paginationSchema.extend({
  ratePlanId: z.string().optional(),
  roomTypeId: z.string().optional(),
  productId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export const roomTypeRateCoreSchema = z.object({
  ratePlanId: z.string(),
  roomTypeId: z.string(),
  priceScheduleId: z.string().nullable().optional(),
  currencyCode: z.string().length(3),
  baseAmountCents: nullableMoney,
  extraAdultAmountCents: nullableMoney,
  extraChildAmountCents: nullableMoney,
  extraInfantAmountCents: nullableMoney,
  active: z.boolean().default(true),
  notes: nullableString,
})
export const insertRoomTypeRateSchema = roomTypeRateCoreSchema
export const updateRoomTypeRateSchema = roomTypeRateCoreSchema.partial()
export const roomTypeRateListQuerySchema = paginationSchema.extend({
  ratePlanId: z.string().optional(),
  roomTypeId: z.string().optional(),
  priceScheduleId: z.string().optional(),
  active: booleanQueryParam.optional(),
})
