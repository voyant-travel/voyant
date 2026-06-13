"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { pricingCategorySingleResponse, successEnvelope } from "../schemas.js"

export interface CreatePricingCategoryInput {
  productId?: string | null
  optionId?: string | null
  unitId?: string | null
  code?: string | null
  name: string
  categoryType?:
    | "adult"
    | "child"
    | "infant"
    | "senior"
    | "group"
    | "room"
    | "vehicle"
    | "service"
    | "other"
  seatOccupancy?: number
  groupSize?: number | null
  isAgeQualified?: boolean
  minAge?: number | null
  maxAge?: number | null
  internalUseOnly?: boolean
  active?: boolean
  sortOrder?: number
  metadata?: Record<string, unknown> | null
}

export type UpdatePricingCategoryInput = Partial<CreatePricingCategoryInput>

export function usePricingCategoryMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePricingCategoryInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/pricing-categories",
        pricingCategorySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.pricingCategories() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePricingCategoryInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/pricing-categories/${id}`,
        pricingCategorySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.pricingCategories() })
      queryClient.setQueryData(pricingQueryKeys.pricingCategory(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/pricing-categories/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.pricingCategories() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.pricingCategory(id) })
    },
  })

  return { create, update, remove }
}
