"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertMarketProductRuleSchema,
  updateMarketProductRuleSchema,
} from "@voyant-travel/commerce/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantMarketsContext } from "../provider.js"
import { marketsQueryKeys } from "../query-keys.js"
import { marketProductRuleSingleResponse, successEnvelope } from "../schemas.js"

export type CreateMarketProductRuleInput = z.input<typeof insertMarketProductRuleSchema>
export type UpdateMarketProductRuleInput = z.input<typeof updateMarketProductRuleSchema>

export function useMarketProductRuleMutation() {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateMarketProductRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/markets/product-rules",
        marketProductRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketProductRules() })
      queryClient.setQueryData(marketsQueryKeys.marketProductRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateMarketProductRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/markets/product-rules/${id}`,
        marketProductRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketProductRules() })
      queryClient.setQueryData(marketsQueryKeys.marketProductRule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/markets/product-rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketProductRules() })
      queryClient.removeQueries({ queryKey: marketsQueryKeys.marketProductRule(id) })
    },
  })

  return { create, update, remove }
}
