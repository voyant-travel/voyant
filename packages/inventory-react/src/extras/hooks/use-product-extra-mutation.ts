"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertProductExtraSchema, updateProductExtraSchema } from "@voyantjs/inventory/extras"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantExtrasContext } from "../provider.js"
import { extrasQueryKeys } from "../query-keys.js"
import { productExtraSingleResponse, successEnvelope } from "../schemas.js"

export type CreateProductExtraInput = z.input<typeof insertProductExtraSchema>
export type UpdateProductExtraInput = z.input<typeof updateProductExtraSchema>

export function useProductExtraMutation() {
  const { baseUrl, fetcher } = useVoyantExtrasContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateProductExtraInput) => {
      const { data } = await fetchWithValidation(
        "/v1/extras/product-extras",
        productExtraSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: extrasQueryKeys.productExtras() })
      queryClient.setQueryData(extrasQueryKeys.productExtra(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateProductExtraInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/extras/product-extras/${id}`,
        productExtraSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: extrasQueryKeys.productExtras() })
      queryClient.setQueryData(extrasQueryKeys.productExtra(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/extras/product-extras/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: extrasQueryKeys.productExtras() })
      queryClient.removeQueries({ queryKey: extrasQueryKeys.productExtra(id) })
    },
  })

  return { create, update, remove }
}
