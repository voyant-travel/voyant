"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseSellabilityPoliciesOptions } from "./hooks/use-sellability-policies.js"
import { sellabilityQueryKeys } from "./query-keys.js"
import { sellabilityPolicyListResponse, sellabilityPolicySingleResponse } from "./schemas.js"

function toQueryString(filters: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function getSellabilityPoliciesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseSellabilityPoliciesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: sellabilityQueryKeys.policiesList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/sellability/policies${toQueryString(filters)}`,
        sellabilityPolicyListResponse,
        client,
      ),
  })
}

export function getSellabilityPolicyQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: sellabilityQueryKeys.policy(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/sellability/policies/${id}`,
        sellabilityPolicySingleResponse,
        client,
      )
      return data
    },
  })
}
