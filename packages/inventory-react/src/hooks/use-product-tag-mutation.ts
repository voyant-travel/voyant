"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { productTagSingleResponse } from "../schemas.js"

export interface CreateProductTagInput {
  name: string
}

export type UpdateProductTagInput = Partial<CreateProductTagInput>

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useProductTagMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateProductTagInput) => {
      const { data } = await fetchWithValidation(
        "/v1/products/product-tags",
        productTagSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productTags() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductTagInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/product-tags/${id}`,
        productTagSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productTags() })
      queryClient.setQueryData(productsQueryKeys.productTag(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/products/product-tags/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productTags() })
      queryClient.removeQueries({ queryKey: productsQueryKeys.productTag(id) })
    },
  })

  return { create, update, remove }
}
