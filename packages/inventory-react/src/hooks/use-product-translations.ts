"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation, withQueryParams } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productTranslationListResponse } from "../schemas.js"

export interface UseProductTranslationsOptions {
  languageTag?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
  enabled?: boolean | undefined
}

export function useProductTranslations(
  productId: string | null | undefined,
  options: UseProductTranslationsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: productsQueryKeys.productTranslations(productId ?? "", filters),
    queryFn: () => {
      if (!productId) throw new Error("useProductTranslations requires a productId")

      return fetchWithValidation(
        withQueryParams("/v1/admin/products/translations", {
          productId,
          languageTag: filters.languageTag,
          limit: filters.limit,
          offset: filters.offset,
        }),
        productTranslationListResponse,
        { baseUrl, fetcher },
      )
    },
    enabled: enabled && Boolean(productId),
  })
}
