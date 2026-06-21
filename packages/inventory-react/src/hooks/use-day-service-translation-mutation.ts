"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateDayServiceTranslationInput,
  dayServiceTranslationSingleResponse,
  successEnvelope,
  type UpdateDayServiceTranslationInput,
} from "../schemas.js"

export function useDayServiceTranslationMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const invalidate = async (productId: string, dayId: string, serviceId: string) => {
    await queryClient.invalidateQueries({
      queryKey: productsQueryKeys.dayServiceTranslationsRoot(productId, dayId, serviceId),
    })
    await queryClient.invalidateQueries({
      queryKey: productsQueryKeys.productDayServices(productId, dayId),
    })
  }

  const create = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      serviceId,
      input,
    }: {
      productId: string
      dayId: string
      serviceId: string
      input: CreateDayServiceTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/services/${serviceId}/translations`,
        dayServiceTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return { productId, dayId, serviceId, translation: data }
    },
    onSuccess: ({ productId, dayId, serviceId }) => invalidate(productId, dayId, serviceId),
  })

  const update = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      serviceId,
      translationId,
      input,
    }: {
      productId: string
      dayId: string
      serviceId: string
      translationId: string
      input: UpdateDayServiceTranslationInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/services/${serviceId}/translations/${translationId}`,
        dayServiceTranslationSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return { productId, dayId, serviceId, translation: data }
    },
    onSuccess: ({ productId, dayId, serviceId }) => invalidate(productId, dayId, serviceId),
  })

  const remove = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      serviceId,
      translationId,
    }: {
      productId: string
      dayId: string
      serviceId: string
      translationId: string
    }) => {
      await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/services/${serviceId}/translations/${translationId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
      return { productId, dayId, serviceId }
    },
    onSuccess: ({ productId, dayId, serviceId }) => invalidate(productId, dayId, serviceId),
  })

  return { create, update, remove }
}
