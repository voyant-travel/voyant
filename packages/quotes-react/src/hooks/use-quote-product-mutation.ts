"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteProductSingleResponse, successEnvelope } from "../schemas.js"

export interface CreateQuoteProductInput {
  nameSnapshot: string
  quantity?: number
  unitPriceAmountCents?: number | null
  currency?: string | null
  description?: string | null
  productId?: string | null
  supplierServiceId?: string | null
  costAmountCents?: number | null
  discountAmountCents?: number | null
}

export type UpdateQuoteProductInput = Partial<CreateQuoteProductInput>

/** Create / update / remove a quote's line-item products. */
export function useQuoteProductMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidate = (quoteId: string) => {
    void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteProducts(quoteId) })
    void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quote(quoteId) })
  }

  const create = useMutation({
    mutationFn: async ({ quoteId, input }: { quoteId: string; input: CreateQuoteProductInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/quotes/quotes/${quoteId}/products`,
        quoteProductSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      quoteId: string
      input: UpdateQuoteProductInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/quotes/quote-products/${id}`,
        quoteProductSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; quoteId: string }) => {
      await fetchWithValidation(
        `/v1/quotes/quote-products/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  return { create, update, remove }
}
