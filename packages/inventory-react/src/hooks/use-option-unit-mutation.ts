"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantProductsContext } from "../provider.js"
import { productsQueryKeys } from "../query-keys.js"
import { optionUnitSingleResponse } from "../schemas.js"

export interface CreateOptionUnitInput {
  optionId: string
  name: string
  code?: string | null
  description?: string | null
  unitType?: "person" | "group" | "room" | "vehicle" | "service" | "other"
  minQuantity?: number | null
  maxQuantity?: number | null
  minAge?: number | null
  maxAge?: number | null
  occupancyMin?: number | null
  occupancyMax?: number | null
  isRequired?: boolean
  isHidden?: boolean
  sortOrder?: number
}

export type UpdateOptionUnitInput = Omit<Partial<CreateOptionUnitInput>, "optionId">

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useOptionUnitMutation() {
  const { baseUrl, fetcher } = useVoyantProductsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({ optionId, ...input }: CreateOptionUnitInput) => {
      const { data } = await fetchWithValidation(
        `/v1/products/options/${optionId}/units`,
        optionUnitSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.optionUnits() })
      void queryClient.invalidateQueries({
        queryKey: productsQueryKeys.productOption(data.optionId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOptionUnitInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/products/units/${id}`,
        optionUnitSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.optionUnits() })
      queryClient.setQueryData(productsQueryKeys.optionUnit(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/products/units/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productsQueryKeys.optionUnits() })
    },
  })

  return { create, update, remove }
}
