import { listResponse } from "@voyant-travel/types"
import type { z } from "zod"
import type {
  cancellationPolicyListQuerySchema,
  cancellationPolicyRuleListQuerySchema,
  departurePriceOverrideListQuerySchema,
  dropoffPriceRuleListQuerySchema,
  extraPriceRuleListQuerySchema,
  insertCancellationPolicyRuleSchema,
  insertCancellationPolicySchema,
  insertDeparturePriceOverrideSchema,
  insertDropoffPriceRuleSchema,
  insertExtraPriceRuleSchema,
  insertOptionPriceRuleSchema,
  insertOptionStartTimeRuleSchema,
  insertOptionUnitPriceRuleSchema,
  insertOptionUnitTierSchema,
  insertPickupPriceRuleSchema,
  insertPriceCatalogSchema,
  insertPriceScheduleSchema,
  insertPricingCategoryDependencySchema,
  insertPricingCategorySchema,
  optionPriceRuleListQuerySchema,
  optionStartTimeRuleListQuerySchema,
  optionUnitPriceRuleListQuerySchema,
  optionUnitTierListQuerySchema,
  pickupPriceRuleListQuerySchema,
  priceCatalogListQuerySchema,
  priceScheduleListQuerySchema,
  pricingCategoryDependencyListQuerySchema,
  pricingCategoryListQuerySchema,
  updateCancellationPolicyRuleSchema,
  updateCancellationPolicySchema,
  updateDeparturePriceOverrideSchema,
  updateDropoffPriceRuleSchema,
  updateExtraPriceRuleSchema,
  updateOptionPriceRuleSchema,
  updateOptionStartTimeRuleSchema,
  updateOptionUnitPriceRuleSchema,
  updateOptionUnitTierSchema,
  updatePickupPriceRuleSchema,
  updatePriceCatalogSchema,
  updatePriceScheduleSchema,
  updatePricingCategoryDependencySchema,
  updatePricingCategorySchema,
} from "./validation.js"

export type PricingCategoryListQuery = z.infer<typeof pricingCategoryListQuerySchema>
export type PricingCategoryDependencyListQuery = z.infer<
  typeof pricingCategoryDependencyListQuerySchema
>
export type CancellationPolicyListQuery = z.infer<typeof cancellationPolicyListQuerySchema>
export type CancellationPolicyRuleListQuery = z.infer<typeof cancellationPolicyRuleListQuerySchema>
export type PriceCatalogListQuery = z.infer<typeof priceCatalogListQuerySchema>
export type PriceScheduleListQuery = z.infer<typeof priceScheduleListQuerySchema>
export type OptionPriceRuleListQuery = z.infer<typeof optionPriceRuleListQuerySchema>
export type OptionUnitPriceRuleListQuery = z.infer<typeof optionUnitPriceRuleListQuerySchema>
export type OptionStartTimeRuleListQuery = z.infer<typeof optionStartTimeRuleListQuerySchema>
export type OptionUnitTierListQuery = z.infer<typeof optionUnitTierListQuerySchema>
export type PickupPriceRuleListQuery = z.infer<typeof pickupPriceRuleListQuerySchema>
export type DropoffPriceRuleListQuery = z.infer<typeof dropoffPriceRuleListQuerySchema>
export type ExtraPriceRuleListQuery = z.infer<typeof extraPriceRuleListQuerySchema>
export type DeparturePriceOverrideListQuery = z.infer<typeof departurePriceOverrideListQuerySchema>

export type CreatePricingCategoryInput = z.infer<typeof insertPricingCategorySchema>
export type UpdatePricingCategoryInput = z.infer<typeof updatePricingCategorySchema>
export type CreatePricingCategoryDependencyInput = z.infer<
  typeof insertPricingCategoryDependencySchema
>
export type UpdatePricingCategoryDependencyInput = z.infer<
  typeof updatePricingCategoryDependencySchema
>
export type CreateCancellationPolicyInput = z.infer<typeof insertCancellationPolicySchema>
export type UpdateCancellationPolicyInput = z.infer<typeof updateCancellationPolicySchema>
export type CreateCancellationPolicyRuleInput = z.infer<typeof insertCancellationPolicyRuleSchema>
export type UpdateCancellationPolicyRuleInput = z.infer<typeof updateCancellationPolicyRuleSchema>
export type CreatePriceCatalogInput = z.infer<typeof insertPriceCatalogSchema>
export type UpdatePriceCatalogInput = z.infer<typeof updatePriceCatalogSchema>
export type CreatePriceScheduleInput = z.infer<typeof insertPriceScheduleSchema>
export type UpdatePriceScheduleInput = z.infer<typeof updatePriceScheduleSchema>
export type CreateOptionPriceRuleInput = z.infer<typeof insertOptionPriceRuleSchema>
export type UpdateOptionPriceRuleInput = z.infer<typeof updateOptionPriceRuleSchema>
export type CreateOptionUnitPriceRuleInput = z.infer<typeof insertOptionUnitPriceRuleSchema>
export type UpdateOptionUnitPriceRuleInput = z.infer<typeof updateOptionUnitPriceRuleSchema>
export type CreateOptionStartTimeRuleInput = z.infer<typeof insertOptionStartTimeRuleSchema>
export type UpdateOptionStartTimeRuleInput = z.infer<typeof updateOptionStartTimeRuleSchema>
export type CreateOptionUnitTierInput = z.infer<typeof insertOptionUnitTierSchema>
export type UpdateOptionUnitTierInput = z.infer<typeof updateOptionUnitTierSchema>
export type CreatePickupPriceRuleInput = z.infer<typeof insertPickupPriceRuleSchema>
export type UpdatePickupPriceRuleInput = z.infer<typeof updatePickupPriceRuleSchema>
export type CreateDropoffPriceRuleInput = z.infer<typeof insertDropoffPriceRuleSchema>
export type UpdateDropoffPriceRuleInput = z.infer<typeof updateDropoffPriceRuleSchema>
export type CreateExtraPriceRuleInput = z.infer<typeof insertExtraPriceRuleSchema>
export type UpdateExtraPriceRuleInput = z.infer<typeof updateExtraPriceRuleSchema>
export type CreateDeparturePriceOverrideInput = z.infer<typeof insertDeparturePriceOverrideSchema>
export type UpdateDeparturePriceOverrideInput = z.infer<typeof updateDeparturePriceOverrideSchema>

export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return listResponse(data, { total: countResult[0]?.count ?? 0, limit, offset })
}
