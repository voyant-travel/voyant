import {
  optionUnitTypeSchema,
  productBookingModeSchema,
  productCapacityModeSchema,
  productOptionStatusSchema,
} from "@voyant-travel/products-contracts/validation"
import { z } from "zod"

import {
  optionPricingModeSchema,
  optionStartTimeRuleModeSchema,
  optionUnitPricingModeSchema,
  priceAdjustmentTypeSchema,
} from "./validation-shared.js"

const isoDateSchema = z.string().date()

const publicAvailabilitySlotStatusSchema = z.enum(["open", "closed", "sold_out", "cancelled"])

export const publicProductPricingQuerySchema = z.object({
  catalogId: z.string().optional(),
  optionId: z.string().optional(),
  date: isoDateSchema.optional(),
  departureId: z.string().optional(),
})

export const publicAvailabilitySnapshotQuerySchema = z.object({
  optionId: z.string().optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  status: publicAvailabilitySlotStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const publicPriceCatalogSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  currencyCode: z.string().nullable(),
})

export const publicPricingTierSchema = z.object({
  id: z.string(),
  minQuantity: z.number().int(),
  maxQuantity: z.number().int().nullable(),
  sellAmountCents: z.number().int().nullable(),
  sortOrder: z.number().int(),
})

export const publicOptionUnitPriceSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  unitName: z.string(),
  unitType: optionUnitTypeSchema,
  pricingMode: optionUnitPricingModeSchema,
  sellAmountCents: z.number().int().nullable(),
  minQuantity: z.number().int().nullable(),
  maxQuantity: z.number().int().nullable(),
  pricingCategoryId: z.string().nullable(),
  sortOrder: z.number().int(),
  tiers: z.array(publicPricingTierSchema),
})

export const publicStartTimeAdjustmentSchema = z.object({
  id: z.string(),
  startTimeId: z.string(),
  label: z.string().nullable(),
  startTimeLocal: z.string(),
  ruleMode: optionStartTimeRuleModeSchema,
  adjustmentType: priceAdjustmentTypeSchema.nullable(),
  sellAdjustmentCents: z.number().int().nullable(),
  adjustmentBasisPoints: z.number().int().nullable(),
})

export const publicOptionPricingRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  pricingMode: optionPricingModeSchema,
  baseSellAmountCents: z.number().int().nullable(),
  minPerBooking: z.number().int().nullable(),
  maxPerBooking: z.number().int().nullable(),
  isDefault: z.boolean(),
  cancellationPolicyId: z.string().nullable(),
  unitPrices: z.array(publicOptionUnitPriceSchema),
  startTimeAdjustments: z.array(publicStartTimeAdjustmentSchema),
})

export const publicPricedOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: productOptionStatusSchema,
  isDefault: z.boolean(),
  bookingMode: productBookingModeSchema,
  capacityMode: productCapacityModeSchema,
  pricingRules: z.array(publicOptionPricingRuleSchema),
})

export const publicProductPricingSnapshotSchema = z.object({
  productId: z.string(),
  catalog: publicPriceCatalogSchema,
  options: z.array(publicPricedOptionSchema),
})

export const publicAvailabilityStartTimeSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  startTimeLocal: z.string(),
  durationMinutes: z.number().int().nullable(),
})

export const publicAvailabilitySlotSchema = z.object({
  id: z.string(),
  optionId: z.string().nullable(),
  dateLocal: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  timezone: z.string(),
  status: publicAvailabilitySlotStatusSchema,
  unlimited: z.boolean(),
  remainingPax: z.number().int().nullable(),
  remainingResources: z.number().int().nullable(),
  pastCutoff: z.boolean(),
  tooEarly: z.boolean(),
  startTime: publicAvailabilityStartTimeSchema.nullable(),
})

export const publicAvailabilitySnapshotSchema = z.object({
  productId: z.string(),
  slots: z.array(publicAvailabilitySlotSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export type PublicProductPricingQuery = z.infer<typeof publicProductPricingQuerySchema>
export type PublicAvailabilitySnapshotQuery = z.infer<typeof publicAvailabilitySnapshotQuerySchema>
