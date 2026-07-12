"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertMarketLocaleSchema,
  updateMarketLocaleSchema,
} from "@voyant-travel/commerce/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantMarketsContext } from "../provider.js"
import { marketsQueryKeys } from "../query-keys.js"
import { marketLocaleSingleResponse, successEnvelope } from "../schemas.js"

export type CreateMarketLocaleInput = z.input<typeof insertMarketLocaleSchema>
export type UpdateMarketLocaleInput = z.input<typeof updateMarketLocaleSchema>

export function useMarketLocaleMutation() {
  const { baseUrl, fetcher } = useVoyantMarketsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      marketId,
      input,
    }: {
      marketId: string
      input: CreateMarketLocaleInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/markets/markets/${marketId}/locales`,
        marketLocaleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketLocales() })
      queryClient.setQueryData(marketsQueryKeys.marketLocale(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateMarketLocaleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/markets/market-locales/${id}`,
        marketLocaleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketLocales() })
      queryClient.setQueryData(marketsQueryKeys.marketLocale(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/markets/market-locales/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: marketsQueryKeys.marketLocales() })
      queryClient.removeQueries({ queryKey: marketsQueryKeys.marketLocale(id) })
    },
  })

  return { create, update, remove }
}
