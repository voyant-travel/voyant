// agent-quality: file-size exception -- owner: pricing-react; existing module stays co-located until a dedicated split preserves behavior and tests.
"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseCancellationPoliciesOptions } from "./hooks/use-cancellation-policies.js"
import type { UseCancellationPolicyRulesOptions } from "./hooks/use-cancellation-policy-rules.js"
import type { UseDeparturePriceOverridesOptions } from "./hooks/use-departure-price-overrides.js"
import type { UseDropoffPriceRulesOptions } from "./hooks/use-dropoff-price-rules.js"
import type { UseExtraPriceRulesOptions } from "./hooks/use-extra-price-rules.js"
import type { UseOptionPriceRulesOptions } from "./hooks/use-option-price-rules.js"
import type { UseOptionStartTimeRulesOptions } from "./hooks/use-option-start-time-rules.js"
import type { UseOptionUnitPriceRulesOptions } from "./hooks/use-option-unit-price-rules.js"
import type { UseOptionUnitTiersOptions } from "./hooks/use-option-unit-tiers.js"
import type { UsePickupPriceRulesOptions } from "./hooks/use-pickup-price-rules.js"
import type { UsePriceCatalogsOptions } from "./hooks/use-price-catalogs.js"
import type { UsePriceSchedulesOptions } from "./hooks/use-price-schedules.js"
import type { UsePricingCategoriesOptions } from "./hooks/use-pricing-categories.js"
import type { UsePricingCategoryDependenciesOptions } from "./hooks/use-pricing-category-dependencies.js"
import { pricingQueryKeys } from "./query-keys.js"
import {
  cancellationPolicyListResponse,
  cancellationPolicyRuleListResponse,
  cancellationPolicyRuleSingleResponse,
  cancellationPolicySingleResponse,
  departurePriceOverrideListResponse,
  departurePriceOverrideSingleResponse,
  dropoffPriceRuleListResponse,
  dropoffPriceRuleSingleResponse,
  extraPriceRuleListResponse,
  extraPriceRuleSingleResponse,
  optionPriceRuleListResponse,
  optionPriceRuleSingleResponse,
  optionStartTimeRuleListResponse,
  optionStartTimeRuleSingleResponse,
  optionUnitPriceRuleListResponse,
  optionUnitPriceRuleSingleResponse,
  optionUnitTierListResponse,
  optionUnitTierSingleResponse,
  pickupPriceRuleListResponse,
  pickupPriceRuleSingleResponse,
  priceCatalogListResponse,
  priceCatalogSingleResponse,
  priceScheduleListResponse,
  priceScheduleSingleResponse,
  pricingCategoryDependencyListResponse,
  pricingCategoryListResponse,
  pricingCategorySingleResponse,
} from "./schemas.js"

export function getPricingCategoryQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.pricingCategory(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/pricing-categories/${id}`,
        pricingCategorySingleResponse,
        client,
      )
      return data
    },
  })
}

export function getPricingCategoriesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePricingCategoriesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.pricingCategoriesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.unitId) params.set("unitId", filters.unitId)
      if (filters.categoryType) params.set("categoryType", filters.categoryType)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/pricing-categories${qs ? `?${qs}` : ""}`,
        pricingCategoryListResponse,
        client,
      )
    },
  })
}

export function getPricingCategoryDependenciesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePricingCategoryDependenciesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.pricingCategoryDependenciesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.pricingCategoryId) params.set("pricingCategoryId", filters.pricingCategoryId)
      if (filters.masterPricingCategoryId) {
        params.set("masterPricingCategoryId", filters.masterPricingCategoryId)
      }
      if (filters.dependencyType) params.set("dependencyType", filters.dependencyType)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/pricing-category-dependencies${qs ? `?${qs}` : ""}`,
        pricingCategoryDependencyListResponse,
        client,
      )
    },
  })
}

export function getPriceCatalogsQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePriceCatalogsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.priceCatalogsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/price-catalogs${qs ? `?${qs}` : ""}`,
        priceCatalogListResponse,
        client,
      )
    },
  })
}

export function getPriceCatalogQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: [...pricingQueryKeys.priceCatalogs(), "detail", id] as const,
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/price-catalogs/${id}`,
        priceCatalogSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getCancellationPoliciesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseCancellationPoliciesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.cancellationPoliciesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/cancellation-policies${qs ? `?${qs}` : ""}`,
        cancellationPolicyListResponse,
        client,
      )
    },
  })
}

export function getCancellationPolicyQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: [...pricingQueryKeys.cancellationPolicies(), "detail", id] as const,
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/cancellation-policies/${id}`,
        cancellationPolicySingleResponse,
        client,
      )
      return data
    },
  })
}

export function getCancellationPolicyRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseCancellationPolicyRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.cancellationPolicyRulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.cancellationPolicyId) {
        params.set("cancellationPolicyId", filters.cancellationPolicyId)
      }
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/cancellation-policy-rules${qs ? `?${qs}` : ""}`,
        cancellationPolicyRuleListResponse,
        client,
      )
    },
  })
}

export function getCancellationPolicyRuleQueryOptions(
  client: FetchWithValidationOptions,
  id: string,
) {
  return queryOptions({
    queryKey: pricingQueryKeys.cancellationPolicyRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/cancellation-policy-rules/${id}`,
        cancellationPolicyRuleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getPriceSchedulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePriceSchedulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.priceSchedulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.priceCatalogId) params.set("priceCatalogId", filters.priceCatalogId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/price-schedules${qs ? `?${qs}` : ""}`,
        priceScheduleListResponse,
        client,
      )
    },
  })
}

export function getPriceScheduleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: [...pricingQueryKeys.priceSchedules(), "detail", id] as const,
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/price-schedules/${id}`,
        priceScheduleSingleResponse,
        client,
      )
      return data
    },
  })
}

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

export function getPickupPriceRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePickupPriceRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.pickupPriceRulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.optionPriceRuleId) params.set("optionPriceRuleId", filters.optionPriceRuleId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.pickupPointId) params.set("pickupPointId", filters.pickupPointId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/pickup-price-rules${qs ? `?${qs}` : ""}`,
        pickupPriceRuleListResponse,
        client,
      )
    },
  })
}

export function getPickupPriceRuleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.pickupPriceRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/pickup-price-rules/${id}`,
        pickupPriceRuleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getDropoffPriceRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseDropoffPriceRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.dropoffPriceRulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.optionPriceRuleId) params.set("optionPriceRuleId", filters.optionPriceRuleId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.facilityId) params.set("facilityId", filters.facilityId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/dropoff-price-rules${qs ? `?${qs}` : ""}`,
        dropoffPriceRuleListResponse,
        client,
      )
    },
  })
}

export function getDropoffPriceRuleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.dropoffPriceRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/dropoff-price-rules/${id}`,
        dropoffPriceRuleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getExtraPriceRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseExtraPriceRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.extraPriceRulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.optionPriceRuleId) params.set("optionPriceRuleId", filters.optionPriceRuleId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.productExtraId) params.set("productExtraId", filters.productExtraId)
      if (filters.optionExtraConfigId) {
        params.set("optionExtraConfigId", filters.optionExtraConfigId)
      }
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/extra-price-rules${qs ? `?${qs}` : ""}`,
        extraPriceRuleListResponse,
        client,
      )
    },
  })
}

export function getExtraPriceRuleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.extraPriceRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/extra-price-rules/${id}`,
        extraPriceRuleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getOptionStartTimeRulesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseOptionStartTimeRulesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.optionStartTimeRulesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.optionPriceRuleId) params.set("optionPriceRuleId", filters.optionPriceRuleId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.startTimeId) params.set("startTimeId", filters.startTimeId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/option-start-time-rules${qs ? `?${qs}` : ""}`,
        optionStartTimeRuleListResponse,
        client,
      )
    },
  })
}

export function getOptionStartTimeRuleQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: pricingQueryKeys.optionStartTimeRule(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/option-start-time-rules/${id}`,
        optionStartTimeRuleSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getDeparturePriceOverridesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseDeparturePriceOverridesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: pricingQueryKeys.departurePriceOverridesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.departureId) params.set("departureId", filters.departureId)
      if (filters.optionId) params.set("optionId", filters.optionId)
      if (filters.optionUnitId) params.set("optionUnitId", filters.optionUnitId)
      if (filters.priceCatalogId) params.set("priceCatalogId", filters.priceCatalogId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/pricing/departure-price-overrides${qs ? `?${qs}` : ""}`,
        departurePriceOverrideListResponse,
        client,
      )
    },
  })
}

export function getDeparturePriceOverrideQueryOptions(
  client: FetchWithValidationOptions,
  id: string,
) {
  return queryOptions({
    queryKey: pricingQueryKeys.departurePriceOverride(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/departure-price-overrides/${id}`,
        departurePriceOverrideSingleResponse,
        client,
      )
      return data
    },
  })
}
