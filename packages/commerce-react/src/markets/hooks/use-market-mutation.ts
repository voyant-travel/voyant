"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertMarketSchema, updateMarketSchema } from "@voyant-travel/commerce/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantMarketsContext } from "../provider.js"
import { marketsQueryKeys } from "../query-keys.js"
import { marketSingleResponse, successEnvelope } from "../schemas.js"

export type CreateMarketInput = z.input<typeof insertMarketSchema>
export type UpdateMarketInput = z.input<typeof updateMarketSchema>

export function useMarketMutation() {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateMarketInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/markets/markets",
        marketSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.markets() })
      queryClient.setQueryData(marketsQueryKeys.market(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateMarketInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/markets/markets/${id}`,
        marketSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.markets() })
      queryClient.setQueryData(marketsQueryKeys.market(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/markets/markets/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.markets() })
      queryClient.removeQueries({ queryKey: marketsQueryKeys.market(id) })
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketLocales() })
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketCurrencies() })
    },
  })

  return { create, update, remove }
}
