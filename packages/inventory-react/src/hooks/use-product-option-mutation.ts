"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productOptionSingleResponse } from "../schemas.js"

export interface CreateProductOptionInput {
  productId: string
  name: string
  code?: string | null
  description?: string | null
  status?: "draft" | "active" | "archived"
  isDefault?: boolean
  sortOrder?: number
  availableFrom?: string | null
  availableTo?: string | null
}

export type UpdateProductOptionInput = Omit<Partial<CreateProductOptionInput>, "productId">

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useProductOptionMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({ productId, ...input }: CreateProductOptionInput) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/options`,
        productOptionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productOptions() })
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(data.productId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductOptionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/options/${id}`,
        productOptionSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productOptions() })
      queryClient.setQueryData(productsQueryKeys.productOption(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/products/options/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productOptions() })
    },
  })

  return { create, update, remove }
}
