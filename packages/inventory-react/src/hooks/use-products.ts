"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { type ProductsListFilters, productsQueryKeys } from "../query-keys.js"
import { productListResponse } from "../schemas.js"

export interface UseProductsOptions extends ProductsListFilters {
  enabled?: boolean
}

export function useProducts(options: UseProductsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: productsQueryKeys.productsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.status) params.set("status", filters.status)
      if (filters.bookingMode) params.set("bookingMode", filters.bookingMode)
      if (filters.visibility) params.set("visibility", filters.visibility)
      if (filters.activated !== undefined) params.set("activated", String(filters.activated))
      if (filters.facilityId) params.set("facilityId", filters.facilityId)
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(`/v1/products${qs ? `?${qs}` : ""}`, productListResponse, {
        baseUrl,
        fetcher,
      })
    },
    enabled,
  })
}
