"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import type { UseCancellationPoliciesOptions } from "../hooks/use-cancellation-policies.js"
import type { UseCancellationPolicyRulesOptions } from "../hooks/use-cancellation-policy-rules.js"
import { pricingQueryKeys } from "../query-keys.js"
import {
  cancellationPolicyListResponse,
  cancellationPolicyRuleListResponse,
  cancellationPolicyRuleSingleResponse,
  cancellationPolicySingleResponse,
} from "../schemas.js"

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
