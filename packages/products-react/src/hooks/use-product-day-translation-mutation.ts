"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductDayTranslationInput,
  productDayTranslationSingleResponse,
  successEnvelope,
  type UpdateProductDayTranslationInput,
} from "../schemas.js"

export function useProductDayTranslationMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const invalidate = async (productId: string, dayId: string) => {
    await queryClient.invalidateQueries({
      queryKey: productsQueryKeys.productDayTranslationsRoot(productId, dayId),
    })
    await queryClient.invalidateQueries({ queryKey: productsQueryKeys.product(productId) })
  }

  const create = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      input,
    }: {
      productId: string
      dayId: string
      input: CreateProductDayTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/translations`,
        productDayTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return { productId, dayId, translation: data }
    },
    onSuccess: ({ productId, dayId }) => invalidate(productId, dayId),
  })

  const update = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      translationId,
      input,
    }: {
      productId: string
      dayId: string
      translationId: string
      input: UpdateProductDayTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/translations/${translationId}`,
        productDayTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return { productId, dayId, translation: data }
    },
    onSuccess: ({ productId, dayId }) => invalidate(productId, dayId),
  })

  const remove = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      translationId,
    }: {
      productId: string
      dayId: string
      translationId: string
    }) => {
      await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/translations/${translationId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
      return { productId, dayId }
    },
    onSuccess: ({ productId, dayId }) => invalidate(productId, dayId),
  })

  return { create, update, remove }
}
