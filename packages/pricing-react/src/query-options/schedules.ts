"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import type { UsePriceSchedulesOptions } from "../hooks/use-price-schedules.js"
import { pricingQueryKeys } from "../query-keys.js"
import { priceScheduleListResponse, priceScheduleSingleResponse } from "../schemas.js"

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
