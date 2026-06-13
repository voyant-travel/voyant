"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { type ProductTagsListFilters, productsQueryKeys } from "../query-keys.js"
import { productTagListResponse } from "../schemas.js"

export interface UseProductTagsOptions extends ProductTagsListFilters {
  enabled?: boolean
}

export function useProductTags(options: UseProductTagsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: productsQueryKeys.productTagsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/products/product-tags${qs ? `?${qs}` : ""}`,
        productTagListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}
