"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseProductExtrasOptions } from "./hooks/use-product-extras.js"
import { extrasQueryKeys } from "./query-keys.js"
import {
  productExtraListResponse,
  productExtraSingleResponse,
  slotExtraManifestResponse,
} from "./schemas.js"

export function getProductExtrasQueryOptions(
  client: FetchWithValidationOptions,
  options: UseProductExtrasOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: extrasQueryKeys.productExtrasList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.productId) params.set("productId", filters.productId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/extras/product-extras${qs ? `?${qs}` : ""}`,
        productExtraListResponse,
        client,
      )
    },
  })
}

export function getProductExtraQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: extrasQueryKeys.productExtra(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/extras/product-extras/${id}`,
        productExtraSingleResponse,
        client,
      )
      return data
    },
  })
}

export function getSlotExtraManifestQueryOptions(
  client: FetchWithValidationOptions,
  slotId: string,
) {
  return queryOptions({
    queryKey: extrasQueryKeys.slotManifest(slotId),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/extras/slot-manifests/${slotId}`,
        slotExtraManifestResponse,
        client,
      )
      return data
    },
  })
}
