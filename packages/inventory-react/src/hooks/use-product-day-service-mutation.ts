"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import {
  type CreateProductDayServiceInput,
  productDayServiceResponse,
  successEnvelope,
  type UpdateProductDayServiceInput,
} from "../schemas.js"

export function useProductDayServiceMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      ...input
    }: CreateProductDayServiceInput & { productId: string; dayId: string }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/services`,
        productDayServiceResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return { dayId, data }
    },
    onSuccess: async ({ dayId }, variables) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDayServices(variables.productId, dayId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      serviceId,
      input,
    }: {
      productId: string
      dayId: string
      serviceId: string
      input: UpdateProductDayServiceInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/services/${serviceId}`,
        productDayServiceResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return { dayId, data }
    },
    onSuccess: async ({ dayId }, variables) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDayServices(variables.productId, dayId),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async ({
      productId,
      dayId,
      serviceId,
    }: {
      productId: string
      dayId: string
      serviceId: string
    }) =>
      fetchWithValidation(
        `/v1/products/${productId}/days/${dayId}/services/${serviceId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productDayServices(variables.productId, variables.dayId),
      })
    },
  })

  return { create, update, remove }
}
