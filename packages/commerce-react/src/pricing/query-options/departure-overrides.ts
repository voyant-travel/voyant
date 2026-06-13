"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import type { UseDeparturePriceOverridesOptions } from "../hooks/use-departure-price-overrides.js"
import { pricingQueryKeys } from "../query-keys.js"
import {
  departurePriceOverrideListResponse,
  departurePriceOverrideSingleResponse,
} from "../schemas.js"

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
