"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productSingleResponse } from "../schemas.js"

export interface UseProductOptions {
  enabled?: boolean
}

export function useProduct(id: string | undefined, options: UseProductOptions = {}) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: productsQueryKeys.product(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("useProduct requires an id")
      const { data } = await fetchWithValidation(`/v1/products/${id}`, productSingleResponse, {
        baseUrl,
        fetcher,
      })
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
