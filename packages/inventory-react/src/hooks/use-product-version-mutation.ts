"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { type CreateProductVersionInput, productVersionResponse } from "../schemas.js"

export function useProductVersionMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      productId,
      ...input
    }: CreateProductVersionInput & { productId: string }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/versions`,
        productVersionResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productVersions(data.productId),
      })
    },
  })

  return { create }
}
