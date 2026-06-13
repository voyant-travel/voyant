"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productCategorySingleResponse } from "../schemas.js"

export interface UseProductCategoryOptions {
  enabled?: boolean
}

export function useProductCategory(
  id: string | null | undefined,
  options: UseProductCategoryOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: productsQueryKeys.productCategory(id ?? "__missing__"),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/products/product-categories/${id}`,
        productCategorySingleResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
