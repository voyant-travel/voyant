import type { z } from "zod"

import type {
  insertOfferExpirationEventSchema,
  insertOfferRefreshRunSchema,
  insertSellabilityExplanationSchema,
  insertSellabilityPolicyResultSchema,
  insertSellabilityPolicySchema,
  offerExpirationEventListQuerySchema,
  offerRefreshRunListQuerySchema,
  SellabilityResolveQuery,
  sellabilityExplanationListQuerySchema,
  sellabilityPolicyListQuerySchema,
  sellabilityPolicyResultListQuerySchema,
  updateOfferExpirationEventSchema,
  updateOfferRefreshRunSchema,
  updateSellabilityExplanationSchema,
  updateSellabilityPolicyResultSchema,
  updateSellabilityPolicySchema,
} from "./validation.js"

export type { SellabilityResolveQuery } from "./validation.js"

export type RequestedUnit = SellabilityResolveQuery["requestedUnits"][number]

export type SellabilitySnapshotListQuery = {
  limit: number
  offset: number
  offerId?: string
  marketId?: string
  channelId?: string
  productId?: string
  optionId?: string
  slotId?: string
  status?: "resolved" | "offer_constructed" | "expired"
}

export type SellabilitySnapshotItemListQuery = {
  limit: number
  offset: number
  snapshotId?: string
  productId?: string
  optionId?: string
  slotId?: string
  unitId?: string
}

export type SellabilityPolicyListQuery = z.infer<typeof sellabilityPolicyListQuerySchema>
export type CreateSellabilityPolicyInput = z.infer<typeof insertSellabilityPolicySchema>
export type UpdateSellabilityPolicyInput = z.infer<typeof updateSellabilityPolicySchema>
export type SellabilityPolicyResultListQuery = z.infer<
  typeof sellabilityPolicyResultListQuerySchema
>
export type CreateSellabilityPolicyResultInput = z.infer<typeof insertSellabilityPolicyResultSchema>
export type UpdateSellabilityPolicyResultInput = z.infer<typeof updateSellabilityPolicyResultSchema>
export type OfferRefreshRunListQuery = z.infer<typeof offerRefreshRunListQuerySchema>
export type CreateOfferRefreshRunInput = z.infer<typeof insertOfferRefreshRunSchema>
export type UpdateOfferRefreshRunInput = z.infer<typeof updateOfferRefreshRunSchema>
export type OfferExpirationEventListQuery = z.infer<typeof offerExpirationEventListQuerySchema>
export type CreateOfferExpirationEventInput = z.infer<typeof insertOfferExpirationEventSchema>
export type UpdateOfferExpirationEventInput = z.infer<typeof updateOfferExpirationEventSchema>
export type SellabilityExplanationListQuery = z.infer<typeof sellabilityExplanationListQuerySchema>
export type CreateSellabilityExplanationInput = z.infer<typeof insertSellabilityExplanationSchema>
export type UpdateSellabilityExplanationInput = z.infer<typeof updateSellabilityExplanationSchema>

export type ResolvedPriceBreakdown = {
  requestRef: string | null
  unitId: string | null
  unitName: string | null
  unitType: string | null
  pricingCategoryId: string | null
  pricingCategoryName: string | null
  quantity: number
  pricingMode: string
  sellAmountCents: number
  costAmountCents: number
  sourceRuleId: string | null
  tierId: string | null
}

export type ResolvedPriceComponent = {
  kind: "base" | "unit" | "pickup" | "start_time_adjustment"
  title: string
  quantity: number
  pricingMode: string
  sellAmountCents: number
  costAmountCents: number
  unitId: string | null
  unitName: string | null
  unitType: string | null
  pricingCategoryId: string | null
  pricingCategoryName: string | null
  requestRef: string | null
  sourceRuleId: string | null
  tierId: string | null
}

export function weekdayCandidates(dateLocal: string) {
  const weekday = new Date(`${dateLocal}T00:00:00Z`).getUTCDay()
  const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  const longNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return [String(weekday), names[weekday], longNames[weekday]]
}

export function scheduleMatches(
  schedule: {
    validFrom: string | null
    validTo: string | null
    weekdays: string[] | null
  },
  dateLocal?: string,
) {
  if (!dateLocal) return true
  if (schedule.validFrom && dateLocal < schedule.validFrom) return false
  if (schedule.validTo && dateLocal > schedule.validTo) return false
  if (!schedule.weekdays || schedule.weekdays.length === 0) return true
  const candidates = weekdayCandidates(dateLocal)
  return schedule.weekdays.some((entry) => candidates.includes(entry.toLowerCase()))
}

export function applyAdjustment(
  total: { sellAmountCents: number; costAmountCents: number },
  adjustment: {
    adjustmentType: "fixed" | "percentage" | null
    sellAdjustmentCents: number | null
    costAdjustmentCents: number | null
    adjustmentBasisPoints: number | null
  },
) {
  if (adjustment.adjustmentType === "fixed") {
    return {
      sellAmountCents: total.sellAmountCents + (adjustment.sellAdjustmentCents ?? 0),
      costAmountCents: total.costAmountCents + (adjustment.costAdjustmentCents ?? 0),
    }
  }

  if (adjustment.adjustmentType === "percentage" && adjustment.adjustmentBasisPoints) {
    return {
      sellAmountCents:
        total.sellAmountCents +
        Math.round((total.sellAmountCents * adjustment.adjustmentBasisPoints) / 10_000),
      costAmountCents:
        total.costAmountCents +
        Math.round((total.costAmountCents * adjustment.adjustmentBasisPoints) / 10_000),
    }
  }

  return total
}

export function computeUnitAmounts(
  request: RequestedUnit,
  details: {
    unitName: string | null
    unitType: string | null
    pricingCategoryName: string | null
  },
  unitRule: {
    id: string
    pricingMode: string
    sellAmountCents: number | null
    costAmountCents: number | null
  } | null,
  tier: {
    id: string
    sellAmountCents: number | null
    costAmountCents: number | null
  } | null,
  override: {
    sellAmountCents: number
    costAmountCents: number | null
  } | null,
): ResolvedPriceBreakdown {
  const pricingMode = unitRule?.pricingMode ?? "per_unit"
  const baseSell =
    override?.sellAmountCents ?? tier?.sellAmountCents ?? unitRule?.sellAmountCents ?? 0
  const baseCost =
    override?.costAmountCents ?? tier?.costAmountCents ?? unitRule?.costAmountCents ?? 0

  if (pricingMode === "included" || pricingMode === "free") {
    return {
      requestRef: request.requestRef ?? null,
      unitId: request.unitId ?? null,
      unitName: details.unitName,
      unitType: details.unitType,
      pricingCategoryId: request.pricingCategoryId ?? null,
      pricingCategoryName: details.pricingCategoryName,
      quantity: request.quantity,
      pricingMode,
      sellAmountCents: 0,
      costAmountCents: 0,
      sourceRuleId: unitRule?.id ?? null,
      tierId: tier?.id ?? null,
    }
  }

  const multiplier = pricingMode === "per_booking" ? 1 : request.quantity

  return {
    requestRef: request.requestRef ?? null,
    unitId: request.unitId ?? null,
    unitName: details.unitName,
    unitType: details.unitType,
    pricingCategoryId: request.pricingCategoryId ?? null,
    pricingCategoryName: details.pricingCategoryName,
    quantity: request.quantity,
    pricingMode,
    sellAmountCents: baseSell * multiplier,
    costAmountCents: baseCost * multiplier,
    sourceRuleId: unitRule?.id ?? null,
    tierId: tier?.id ?? null,
  }
}

export function chooseBestScheduledRule<
  T extends { isDefault?: boolean | null; priceScheduleId?: string | null },
>(rows: T[]) {
  return (
    [...rows].sort((a, b) => {
      const scoreA = Number(Boolean(a.priceScheduleId)) * 10 + Number(Boolean(a.isDefault))
      const scoreB = Number(Boolean(b.priceScheduleId)) * 10 + Number(Boolean(b.isDefault))
      return scoreB - scoreA
    })[0] ?? null
  )
}

export function chooseBestSpecificRule<T extends { optionId?: string | null }>(rows: T[]) {
  return (
    [...rows].sort((a, b) => Number(Boolean(b.optionId)) - Number(Boolean(a.optionId)))[0] ?? null
  )
}

export function toNumeric(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  return typeof value === "number" ? value : Number(value)
}

export function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T
}

export async function paginate<T extends object>(
  rowsQuery: Promise<T[]>,
  countQuery: Promise<Array<{ count: number }>>,
  limit: number,
  offset: number,
) {
  const [data, countResult] = await Promise.all([rowsQuery, countQuery])
  return { data, total: countResult[0]?.count ?? 0, limit, offset }
}

export function normalizeDateTime(value: string | null | undefined) {
  return value ? new Date(value) : null
}

export type PaginatedResult<T extends object> = Awaited<ReturnType<typeof paginate<T>>>
