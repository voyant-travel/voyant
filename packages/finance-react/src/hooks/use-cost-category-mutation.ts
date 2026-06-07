"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { costCategorySingleResponse } from "../schemas.js"

export interface CreateCostCategoryInput {
  name: string
  sortOrder?: number
}
export interface UpdateCostCategoryInput {
  name?: string
  sortOrder?: number
  archived?: boolean
}

export function useCostCategoryMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const client = { baseUrl, fetcher }
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: financeQueryKeys.costCategories() })

  const create = useMutation({
    mutationFn: async (input: CreateCostCategoryInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/finance/cost-categories",
        costCategorySingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCostCategoryInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/cost-categories/${id}`,
        costCategorySingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { create, update }
}
