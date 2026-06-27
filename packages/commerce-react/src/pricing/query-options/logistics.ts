"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import type { UseDropoffPriceRulesOptions } from "../hooks/use-dropoff-price-rules.js"
import type { UseExtraPriceRulesOptions } from "../hooks/use-extra-price-rules.js"
import type { UseOptionStartTimeRulesOptions } from "../hooks/use-option-start-time-rules.js"
import type { UsePickupPriceRulesOptions } from "../hooks/use-pickup-price-rules.js"
import { pricingQueryKeys } from "../query-keys.js"
import {
  dropoffPriceRuleListResponse,
  dropoffPriceRuleSingleResponse,
  extraPriceRuleListResponse,
  extraPriceRuleSingleResponse,
  optionStartTimeRuleListResponse,
  optionStartTimeRuleSingleResponse,
  pickupPriceRuleListResponse,
  pickupPriceRuleSingleResponse,
} from "../schemas.js"

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
        `/v1/admin/pricing/pickup-price-rules${qs ? `?${qs}` : ""}`,
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
        `/v1/admin/pricing/pickup-price-rules/${id}`,
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
        `/v1/admin/pricing/dropoff-price-rules${qs ? `?${qs}` : ""}`,
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
        `/v1/admin/pricing/dropoff-price-rules/${id}`,
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
        `/v1/admin/pricing/extra-price-rules${qs ? `?${qs}` : ""}`,
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
        `/v1/admin/pricing/extra-price-rules/${id}`,
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
        `/v1/admin/pricing/option-start-time-rules${qs ? `?${qs}` : ""}`,
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
        `/v1/admin/pricing/option-start-time-rules/${id}`,
        optionStartTimeRuleSingleResponse,
        client,
      )
      return data
    },
  })
}
