"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductComponentInput,
  type ImportProductComponentsInput,
  productComponentImportResponseSchema,
  productComponentSingleResponse,
  type UpdateProductComponentInput,
} from "../schemas.js"

export type CreateProductComponentMutationInput = CreateProductComponentInput & {
  productId: string
}

export type ImportProductComponentsMutationInput = ImportProductComponentsInput & {
  productId: string
}

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useProductComponentMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({ productId, ...input }: CreateProductComponentMutationInput) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/components`,
        productComponentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productComponents() })
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(data.productId) })
      void queryClient.invalidateQueries({
        queryKey: [...productsQueryKeys.product(data.productId), "action-ledger"],
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductComponentInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/components/${id}`,
        productComponentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productComponents() })
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(data.productId) })
      void queryClient.invalidateQueries({
        queryKey: [...productsQueryKeys.product(data.productId), "action-ledger"],
      })
      queryClient.setQueryData(productsQueryKeys.productComponent(data.id), data)
    },
  })

  const importComponents = useMutation({
    mutationFn: async ({ productId, ...input }: ImportProductComponentsMutationInput) =>
      fetchWithValidation(
        `/v1/products/${productId}/components/import`,
        productComponentImportResponseSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productComponents() })
      void queryClient.invalidateQueries({
        queryKey: productsQueryKeys.product(variables.productId),
      })
      void queryClient.invalidateQueries({
        queryKey: [...productsQueryKeys.product(variables.productId), "action-ledger"],
      })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/products/components/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.productComponents() })
    },
  })

  return { create, update, importComponents, remove }
}
