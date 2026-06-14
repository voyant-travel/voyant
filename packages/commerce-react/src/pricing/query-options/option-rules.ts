"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import type { UseOptionPriceRulesOptions } from "../hooks/use-option-price-rules.js"
import type { UseOptionUnitPriceRulesOptions } from "../hooks/use-option-unit-price-rules.js"
import type { UseOptionUnitTiersOptions } from "../hooks/use-option-unit-tiers.js"
import { pricingQueryKeys } from "../query-keys.js"
import {
  optionPriceRuleListResponse,
  optionPriceRuleSingleResponse,
  optionUnitPriceRuleListResponse,
  optionUnitPriceRuleSingleResponse,
  optionUnitTierListResponse,
  optionUnitTierSingleResponse,
} from "../schemas.js"

export function getOptionPriceRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseOptionPriceRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.optionPriceRulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.priceCatalogId) params.set("priceCatalogId", filters.priceCatalogId)
      if (filters.priceScheduleId) params.set("priceScheduleId", filters.priceScheduleId)
      if (filters.cancellationPolicyId) {
        params.set("cancellationPolicyId", filters.cancellationPolicyId)
      }
      if (filters.pricingMode) params.set("pricingMode", filters.pricingMode)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/option-price-rules${qs ? `?${qs}` : ""}`,
        optionPriceRuleListResponse,
        client,
      )
    },
  })
}

export function getOptionPriceRuleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.optionPriceRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/option-price-rules/${id}`,
        optionPriceRuleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getOptionUnitPriceRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseOptionUnitPriceRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.optionUnitPriceRulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.optionPriceRuleId) params.set("optionPriceRuleId", filters.optionPriceRuleId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.unitId) params.set("unitId", filters.unitId)
      if (filters.pricingCategoryId) params.set("pricingCategoryId", filters.pricingCategoryId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/option-unit-price-rules${qs ? `?${qs}` : ""}`,
        optionUnitPriceRuleListResponse,
        client,
      )
    },
  })
}

export function getOptionUnitPriceRuleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.optionUnitPriceRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/option-unit-price-rules/${id}`,
        optionUnitPriceRuleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getOptionUnitTiersQueryOptions(
  client: FetchWithValidationOptions,
  options: UseOptionUnitTiersOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.optionUnitTiersList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.optionUnitPriceRuleId) {
        params.set("optionUnitPriceRuleId", filters.optionUnitPriceRuleId)
      }
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/option-unit-tiers${qs ? `?${qs}` : ""}`,
        optionUnitTierListResponse,
        client,
      )
    },
  })
}

export function getOptionUnitTierQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.optionUnitTier(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/option-unit-tiers/${id}`,
        optionUnitTierSingleResponse,
        client,
      )
      return data
    },
  })
}
