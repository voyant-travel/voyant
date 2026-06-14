"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { type ProductCategoriesListFilters, productsQueryKeys } from "../query-keys.js"
import { productCategoryListResponse } from "../schemas.js"

export interface UseProductCategoriesOptions extends ProductCategoriesListFilters {
  enabled?: boolean
}

export function useProductCategories(options: UseProductCategoriesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: productsQueryKeys.productCategoriesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.parentId) params.set("parentId", filters.parentId)
      if (filters.active !== undefined) params.set("active", String(filters.active))
      if (filters.search) params.set("search", filters.search)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/products/product-categories${qs ? `?${qs}` : ""}`,
        productCategoryListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled,
  })
}
