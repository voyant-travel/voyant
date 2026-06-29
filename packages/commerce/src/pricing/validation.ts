import { booleanQueryParam } from "@voyant-travel/db/helpers"
import { z } from "zod"

import {
  addonPricingModeSchema,
  cancellationChargeTypeSchema,
  cancellationPolicyTypeSchema,
  optionPricingModeSchema,
  optionStartTimeRuleModeSchema,
  optionUnitPricingModeSchema,
  priceAdjustmentTypeSchema,
  priceCatalogTypeSchema,
  pricingCategoryTypeSchema,
  pricingDependencyTypeSchema,
} from "./validation-shared.js"

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const currencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/)
const nullableDateSchema = z.string().date().nullable().optional()
const moneySchema = z.number().int().min(0).nullable().optional()

type StripDefault<T extends z.core.SomeType> = T extends z.ZodDefault<infer U> ? U : T
type StripDefaultShape<T extends z.ZodRawShape> = {
  [K in keyof T]: StripDefault<T[K]>
}

const stripDefaultsFromShape = <T extends z.ZodRawShape>(shape: T): StripDefaultShape<T> =>
  Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [
      key,
      schema instanceof z.ZodDefault ? schema.unwrap() : schema,
    ]),
  ) as StripDefaultShape<T>

const partialWithoutDefaults = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  z.object(stripDefaultsFromShape(schema.shape)).partial()

const pricingCategoryCoreSchema = z.object({
  productId: z.string().nullable().optional(),
  optionId: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
  code: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255),
  categoryType: pricingCategoryTypeSchema.default("other"),
  seatOccupancy: z.number().int().min(0).default(1),
  groupSize: z.number().int().min(1).nullable().optional(),
  isAgeQualified: z.boolean().default(false),
  minAge: z.number().int().min(0).nullable().optional(),
  maxAge: z.number().int().min(0).nullable().optional(),
  internalUseOnly: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPricingCategorySchema = pricingCategoryCoreSchema
export const updatePricingCategorySchema = partialWithoutDefaults(pricingCategoryCoreSchema)
export const pricingCategoryListQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  optionId: z.string().optional(),
  unitId: z.string().optional(),
  categoryType: pricingCategoryTypeSchema.optional(),
  active: booleanQueryParam.optional(),
  search: z.string().optional(),
})

const pricingCategoryDependencyCoreSchema = z.object({
  pricingCategoryId: z.string(),
  masterPricingCategoryId: z.string(),
  dependencyType: pricingDependencyTypeSchema.default("requires"),
  maxPerMaster: z.number().int().min(0).nullable().optional(),
  maxDependentSum: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

export const insertPricingCategoryDependencySchema = pricingCategoryDependencyCoreSchema
export const updatePricingCategoryDependencySchema = partialWithoutDefaults(
  pricingCategoryDependencyCoreSchema,
)
export const pricingCategoryDependencyListQuerySchema = paginationSchema.extend({
  pricingCategoryId: z.string().optional(),
  masterPricingCategoryId: z.string().optional(),
  dependencyType: pricingDependencyTypeSchema.optional(),
  active: booleanQueryParam.optional(),
})

const cancellationPolicyCoreSchema = z.object({
  code: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255),
  policyType: cancellationPolicyTypeSchema.default("custom"),
  simpleCutoffHours: z.number().int().min(0).nullable().optional(),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertCancellationPolicySchema = cancellationPolicyCoreSchema
export const updateCancellationPolicySchema = partialWithoutDefaults(cancellationPolicyCoreSchema)
export const cancellationPolicyListQuerySchema = paginationSchema.extend({
  policyType: cancellationPolicyTypeSchema.optional(),
  active: booleanQueryParam.optional(),
  isDefault: booleanQueryParam.optional(),
  search: z.string().optional(),
})

const cancellationPolicyRuleCoreSchema = z.object({
  cancellationPolicyId: z.string(),
  sortOrder: z.number().int().default(0),
  cutoffMinutesBefore: z.number().int().min(0).nullable().optional(),
  chargeType: cancellationChargeTypeSchema.default("none"),
  chargeAmountCents: moneySchema,
  chargePercentBasisPoints: z.number().int().min(0).max(10000).nullable().optional(),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

export const insertCancellationPolicyRuleSchema = cancellationPolicyRuleCoreSchema
export const updateCancellationPolicyRuleSchema = partialWithoutDefaults(
  cancellationPolicyRuleCoreSchema,
)
export const cancellationPolicyRuleListQuerySchema = paginationSchema.extend({
  cancellationPolicyId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const priceCatalogCoreSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  currencyCode: currencyCodeSchema.nullable().optional(),
  catalogType: priceCatalogTypeSchema.default("public"),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPriceCatalogSchema = priceCatalogCoreSchema
export const updatePriceCatalogSchema = partialWithoutDefaults(priceCatalogCoreSchema)
export const priceCatalogListQuerySchema = paginationSchema.extend({
  currencyCode: currencyCodeSchema.optional(),
  catalogType: priceCatalogTypeSchema.optional(),
  active: booleanQueryParam.optional(),
  search: z.string().optional(),
})

const priceScheduleCoreSchema = z.object({
  priceCatalogId: z.string(),
  code: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255),
  recurrenceRule: z.string().min(1),
  timezone: z.string().max(100).nullable().optional(),
  validFrom: nullableDateSchema,
  validTo: nullableDateSchema,
  weekdays: z
    .array(z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]))
    .nullable()
    .optional(),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertPriceScheduleSchema = priceScheduleCoreSchema
export const updatePriceScheduleSchema = partialWithoutDefaults(priceScheduleCoreSchema)
export const priceScheduleListQuerySchema = paginationSchema.extend({
  priceCatalogId: z.string().optional(),
  active: booleanQueryParam.optional(),
  search: z.string().optional(),
})

const optionPriceRuleCoreSchema = z.object({
  productId: z.string(),
  optionId: z.string(),
  priceCatalogId: z.string(),
  priceScheduleId: z.string().nullable().optional(),
  cancellationPolicyId: z.string().nullable().optional(),
  code: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  pricingMode: optionPricingModeSchema.default("per_person"),
  baseSellAmountCents: moneySchema,
  baseCostAmountCents: moneySchema,
  minPerBooking: z.number().int().min(0).nullable().optional(),
  maxPerBooking: z.number().int().min(0).nullable().optional(),
  allPricingCategories: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertOptionPriceRuleSchema = optionPriceRuleCoreSchema
export const updateOptionPriceRuleSchema = partialWithoutDefaults(optionPriceRuleCoreSchema)
export const optionPriceRuleListQuerySchema = paginationSchema.extend({
  productId: z.string().optional(),
  optionId: z.string().optional(),
  priceCatalogId: z.string().optional(),
  priceScheduleId: z.string().optional(),
  cancellationPolicyId: z.string().optional(),
  pricingMode: optionPricingModeSchema.optional(),
  active: booleanQueryParam.optional(),
})

const optionUnitPriceRuleCoreSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  unitId: z.string(),
  pricingCategoryId: z.string().nullable().optional(),
  pricingMode: optionUnitPricingModeSchema.default("per_unit"),
  sellAmountCents: moneySchema,
  costAmountCents: moneySchema,
  minQuantity: z.number().int().min(0).nullable().optional(),
  maxQuantity: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertOptionUnitPriceRuleSchema = optionUnitPriceRuleCoreSchema
export const updateOptionUnitPriceRuleSchema = partialWithoutDefaults(optionUnitPriceRuleCoreSchema)
export const optionUnitPriceRuleListQuerySchema = paginationSchema.extend({
  optionPriceRuleId: z.string().optional(),
  optionId: z.string().optional(),
  unitId: z.string().optional(),
  pricingCategoryId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const optionStartTimeRuleCoreSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  startTimeId: z.string(),
  ruleMode: optionStartTimeRuleModeSchema.default("included"),
  adjustmentType: priceAdjustmentTypeSchema.nullable().optional(),
  sellAdjustmentCents: moneySchema,
  costAdjustmentCents: moneySchema,
  adjustmentBasisPoints: z.number().int().min(0).max(10000).nullable().optional(),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

export const insertOptionStartTimeRuleSchema = optionStartTimeRuleCoreSchema
export const updateOptionStartTimeRuleSchema = partialWithoutDefaults(optionStartTimeRuleCoreSchema)
export const optionStartTimeRuleListQuerySchema = paginationSchema.extend({
  optionPriceRuleId: z.string().optional(),
  optionId: z.string().optional(),
  startTimeId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const optionUnitTierCoreSchema = z.object({
  optionUnitPriceRuleId: z.string(),
  minQuantity: z.number().int().min(1),
  maxQuantity: z.number().int().min(1).nullable().optional(),
  sellAmountCents: moneySchema,
  costAmountCents: moneySchema,
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const insertOptionUnitTierSchema = optionUnitTierCoreSchema
export const updateOptionUnitTierSchema = partialWithoutDefaults(optionUnitTierCoreSchema)
export const optionUnitTierListQuerySchema = paginationSchema.extend({
  optionUnitPriceRuleId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const pickupPriceRuleCoreSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  pickupPointId: z.string(),
  pricingMode: addonPricingModeSchema.default("included"),
  sellAmountCents: moneySchema,
  costAmountCents: moneySchema,
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
})

export const insertPickupPriceRuleSchema = pickupPriceRuleCoreSchema
export const updatePickupPriceRuleSchema = partialWithoutDefaults(pickupPriceRuleCoreSchema)
export const pickupPriceRuleListQuerySchema = paginationSchema.extend({
  optionPriceRuleId: z.string().optional(),
  optionId: z.string().optional(),
  pickupPointId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const dropoffPriceRuleCoreSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  facilityId: z.string().nullable().optional(),
  dropoffCode: z.string().max(100).nullable().optional(),
  dropoffName: z.string().min(1).max(255),
  pricingMode: addonPricingModeSchema.default("included"),
  sellAmountCents: moneySchema,
  costAmountCents: moneySchema,
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
})

export const insertDropoffPriceRuleSchema = dropoffPriceRuleCoreSchema
export const updateDropoffPriceRuleSchema = partialWithoutDefaults(dropoffPriceRuleCoreSchema)
export const dropoffPriceRuleListQuerySchema = paginationSchema.extend({
  optionPriceRuleId: z.string().optional(),
  optionId: z.string().optional(),
  facilityId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const extraPriceRuleCoreSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  productExtraId: z.string().nullable().optional(),
  optionExtraConfigId: z.string().nullable().optional(),
  pricingMode: addonPricingModeSchema.default("included"),
  sellAmountCents: moneySchema,
  costAmountCents: moneySchema,
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertExtraPriceRuleSchema = extraPriceRuleCoreSchema
export const updateExtraPriceRuleSchema = partialWithoutDefaults(extraPriceRuleCoreSchema)
export const extraPriceRuleListQuerySchema = paginationSchema.extend({
  optionPriceRuleId: z.string().optional(),
  optionId: z.string().optional(),
  productExtraId: z.string().optional(),
  optionExtraConfigId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

const departurePriceOverrideCoreSchema = z.object({
  departureId: z.string(),
  optionId: z.string(),
  optionUnitId: z.string(),
  priceCatalogId: z.string(),
  sellAmountCents: z.number().int().min(0),
  costAmountCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const insertDeparturePriceOverrideSchema = departurePriceOverrideCoreSchema
export const updateDeparturePriceOverrideSchema = partialWithoutDefaults(
  departurePriceOverrideCoreSchema,
)
export const departurePriceOverrideListQuerySchema = paginationSchema.extend({
  departureId: z.string().optional(),
  optionId: z.string().optional(),
  optionUnitId: z.string().optional(),
  priceCatalogId: z.string().optional(),
  active: booleanQueryParam.optional(),
})

export * from "./validation-public.js"
export * from "./validation-shared.js"
