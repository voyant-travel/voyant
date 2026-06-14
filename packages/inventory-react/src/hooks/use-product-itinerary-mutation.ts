"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductItineraryInput,
  type DuplicateProductItineraryInput,
  productItineraryResponse,
  successEnvelope,
  type UpdateProductItineraryInput,
} from "../schemas.js"

export function useProductItineraryMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      productId,
      input,
    }: {
      productId: string
      input: CreateProductItineraryInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/itineraries`,
        productItineraryResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productItineraries(data.productId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      productId,
      itineraryId,
      input,
    }: {
      productId: string
      itineraryId: string
      input: UpdateProductItineraryInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/itineraries/${itineraryId}`,
        productItineraryResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return { productId, itinerary: data }
    },
    onSuccess: async ({ productId, itinerary }) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productItineraries(productId),
      })
      if (itinerary.isDefault) {
        await queryClient.invalidateQueries({
          queryKey: productsQueryKeys.productDays(productId),
        })
      }
    },
  })

  const remove = useMutation({
    mutationFn: async ({ productId, itineraryId }: { productId: string; itineraryId: string }) =>
      fetchWithValidation(
        `/v1/products/itineraries/${itineraryId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ).then(() => ({ productId })),
    onSuccess: async ({ productId }) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productItineraries(productId),
      })
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDays(productId),
      })
    },
  })

  const duplicate = useMutation({
    mutationFn: async ({
      productId,
      itineraryId,
      input,
    }: {
      productId: string
      itineraryId: string
      input?: DuplicateProductItineraryInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/itineraries/${itineraryId}/duplicate`,
        productItineraryResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return { productId, itinerary: data }
    },
    onSuccess: async ({ productId }) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productItineraries(productId),
      })
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDays(productId),
      })
    },
  })

  return { create, update, remove, duplicate }
}
