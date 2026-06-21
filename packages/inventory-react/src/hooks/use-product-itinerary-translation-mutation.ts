"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductItineraryTranslationInput,
  productItineraryTranslationSingleResponse,
  successEnvelope,
  type UpdateProductItineraryTranslationInput,
} from "../schemas.js"

export function useProductItineraryTranslationMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const invalidate = async (productId: string, itineraryId: string) => {
    await queryClient.invalidateQueries({
      queryKey: productsQueryKeys.productItineraryTranslationsRoot(productId, itineraryId),
    })
    await queryClient.invalidateQueries({
      queryKey: productsQueryKeys.productItineraries(productId),
    })
  }

  const create = useMutation({
    mutationFn: async ({
      productId,
      itineraryId,
      input,
    }: {
      productId: string
      itineraryId: string
      input: CreateProductItineraryTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/itineraries/${itineraryId}/translations`,
        productItineraryTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return { productId, itineraryId, translation: data }
    },
    onSuccess: ({ productId, itineraryId }) => invalidate(productId, itineraryId),
  })

  const update = useMutation({
    mutationFn: async ({
      productId,
      itineraryId,
      translationId,
      input,
    }: {
      productId: string
      itineraryId: string
      translationId: string
      input: UpdateProductItineraryTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/itineraries/${itineraryId}/translations/${translationId}`,
        productItineraryTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return { productId, itineraryId, translation: data }
    },
    onSuccess: ({ productId, itineraryId }) => invalidate(productId, itineraryId),
  })

  const remove = useMutation({
    mutationFn: async ({
      productId,
      itineraryId,
      translationId,
    }: {
      productId: string
      itineraryId: string
      translationId: string
    }) => {
      await fetchWithValidation(
        `/v1/products/${productId}/itineraries/${itineraryId}/translations/${translationId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
      return { productId, itineraryId }
    },
    onSuccess: ({ productId, itineraryId }) => invalidate(productId, itineraryId),
  })

  return { create, update, remove }
}
