"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { type ProductCategoryPaymentPolicy, productCategorySingleResponse } from "../schemas.js"

export interface CreateProductCategoryInput {
  name: string
  slug: string
  parentId?: string | null
  description?: string | null
  sortOrder?: number
  active?: boolean
  customerPaymentPolicy?: ProductCategoryPaymentPolicy | null
  metadata?: Record<string, unknown> | null
}

export type UpdateProductCategoryInput = Partial<CreateProductCategoryInput>

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useProductCategoryMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateProductCategoryInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/products/product-categories",
        productCategorySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productCategories() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductCategoryInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/products/product-categories/${id}`,
        productCategorySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productCategories() })
      queryClient.setQueryData(productsQueryKeys.productCategory(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/products/product-categories/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productCategories() })
      queryClient.removeQueries({ queryKey: productsQueryKeys.productCategory(id) })
    },
  })

  return { create, update, remove }
}
