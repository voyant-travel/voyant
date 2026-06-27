"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductTranslationInput,
  productTranslationSingleResponse,
  successEnvelope,
  type UpdateProductTranslationInput,
} from "../schemas.js"

export function useProductTranslationMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      productId,
      input,
    }: {
      productId: string
      input: CreateProductTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/products/${productId}/translations`,
        productTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productTranslationsRoot(data.productId),
      })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(data.productId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      productId,
      translationId,
      input,
    }: {
      productId: string
      translationId: string
      input: UpdateProductTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/products/translations/${translationId}`,
        productTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return { productId, translation: data }
    },
    onSuccess: async ({ productId }) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productTranslationsRoot(productId),
      })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(productId) })
    },
  })

  const remove = useMutation({
    mutationFn: async ({
      productId,
      translationId,
    }: {
      productId: string
      translationId: string
    }) => {
      await fetchWithValidation(
        `/v1/admin/products/translations/${translationId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
      return { productId }
    },
    onSuccess: async ({ productId }) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productTranslationsRoot(productId),
      })
      await queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(productId) })
    },
  })

  return { create, update, remove }
}
