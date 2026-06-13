"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductMediaInput,
  productMediaResponse,
  type ReorderProductMediaInput,
  type UpdateProductMediaInput,
} from "../schemas.js"

const reorderResponseSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
})

export function useProductMediaMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      productId,
      ...input
    }: CreateProductMediaInput & { productId: string }) => {
      const path = input.dayId
        ? `/v1/products/${productId}/days/${input.dayId}/media`
        : `/v1/products/${productId}/media`
      const { data } = await fetchWithValidation(
        path,
        productMediaResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productMedia(data.productId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ mediaId, input }: { mediaId: string; input: UpdateProductMediaInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/media/${mediaId}`,
        productMediaResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productMedia(data.productId),
      })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.productMediaItem(data.id) })
    },
  })

  const remove = useMutation({
    mutationFn: async (mediaId: string) =>
      fetchWithValidation(
        `/v1/products/media/${mediaId}`,
        productMediaResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productMedia(data.productId),
      })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.productMediaItem(data.id) })
    },
  })

  const setCover = useMutation({
    mutationFn: async (mediaId: string) => {
      const { data } = await fetchWithValidation(
        `/v1/products/media/${mediaId}/set-cover`,
        productMediaResponse,
        { baseUrl, fetcher },
        { method: "PATCH" },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productMedia(data.productId),
      })
    },
  })

  const reorder = useMutation({
    mutationFn: async ({ productId, items }: ReorderProductMediaInput & { productId: string }) =>
      fetchWithValidation(
        `/v1/products/${productId}/media/reorder`,
        reorderResponseSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({ items }) },
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productMedia(variables.productId),
      })
    },
  })

  return { create, update, remove, reorder, setCover }
}
