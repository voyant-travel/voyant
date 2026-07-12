"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertMarketCurrencySchema,
  updateMarketCurrencySchema,
} from "@voyant-travel/commerce/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantMarketsContext } from "../provider.js"
import { marketsQueryKeys } from "../query-keys.js"
import { marketCurrencySingleResponse, successEnvelope } from "../schemas.js"

export type CreateMarketCurrencyInput = z.input<typeof insertMarketCurrencySchema>
export type UpdateMarketCurrencyInput = z.input<typeof updateMarketCurrencySchema>

export function useMarketCurrencyMutation() {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      marketId,
      input,
    }: {
      marketId: string
      input: CreateMarketCurrencyInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/markets/markets/${marketId}/currencies`,
        marketCurrencySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketCurrencies() })
      queryClient.setQueryData(marketsQueryKeys.marketCurrency(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateMarketCurrencyInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/markets/market-currencies/${id}`,
        marketCurrencySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketCurrencies() })
      queryClient.setQueryData(marketsQueryKeys.marketCurrency(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/markets/market-currencies/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketCurrencies() })
      queryClient.removeQueries({ queryKey: marketsQueryKeys.marketCurrency(id) })
    },
  })

  return { create, update, remove }
}
