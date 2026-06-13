"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productTagSingleResponse } from "../schemas.js"

export interface UseProductTagOptions {
  enabled?: boolean
}

export function useProductTag(id: string | null | undefined, options: UseProductTagOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: productsQueryKeys.productTag(id ?? "__missing__"),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/products/product-tags/${id}`,
        productTagSingleResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
