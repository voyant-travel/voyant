"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductDayInput,
  productDayResponse,
  successEnvelope,
  type UpdateProductDayInput,
} from "../schemas.js"

export function useProductDayMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      productId,
      itineraryId,
      ...input
    }: CreateProductDayInput & { productId: string; itineraryId?: string }) => {
      const { data } = await fetchWithValidation(
        itineraryId
          ? `/v1/products/${productId}/itineraries/${itineraryId}/days`
          : `/v1/products/${productId}/days`,
        productDayResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDays(variables.productId),
      })
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productItineraryDays(variables.productId, data.itineraryId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      input,
    }: {
      productId: string
      dayId: string
      input: UpdateProductDayInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}`,
        productDayResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDays(variables.productId),
      })
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productItineraryDays(variables.productId, data.itineraryId),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async ({
      productId,
      dayId,
    }: {
      productId: string
      dayId: string
      itineraryId?: string
    }) =>
      fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDays(variables.productId),
      })
      if (variables.itineraryId) {
        await queryClient.invalidateQueries({
          queryKey: productsQueryKeys.productItineraryDays(
            variables.productId,
            variables.itineraryId,
          ),
        })
      }
    },
  })

  return { create, update, remove }
}
