"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { pricingCategoryDependencySingleResponse, successEnvelope } from "../schemas.js"

export interface CreatePricingCategoryDependencyInput {
  pricingCategoryId: string
  masterPricingCategoryId: string
  dependencyType?: "requires" | "limits_per_master" | "limits_sum" | "excludes"
  maxPerMaster?: number | null
  maxDependentSum?: number | null
  active?: boolean
  notes?: string | null
}

export type UpdatePricingCategoryDependencyInput = Partial<CreatePricingCategoryDependencyInput>

export function usePricingCategoryDependencyMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePricingCategoryDependencyInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/pricing-category-dependencies",
        pricingCategoryDependencySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.pricingCategoryDependencies(),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdatePricingCategoryDependencyInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/pricing-category-dependencies/${id}`,
        pricingCategoryDependencySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.pricingCategoryDependencies(),
      })
      queryClient.setQueryData(pricingQueryKeys.pricingCategoryDependency(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/pricing-category-dependencies/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.pricingCategoryDependencies(),
      })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.pricingCategoryDependency(id) })
    },
  })

  return { create, update, remove }
}
