"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteParticipantSingleResponse, successEnvelope } from "../schemas.js"

export interface CreateQuoteParticipantInput {
  personId: string
  role?: "traveler" | "booker" | "decision_maker" | "finance" | "other"
  isPrimary?: boolean
}

/** Add / remove travelers (participants / PAX) on a quote. */
export function useQuoteParticipantMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidate = (quoteId: string) => {
    void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteParticipants(quoteId) })
  }

  const create = useMutation({
    mutationFn: async ({
      quoteId,
      input,
    }: {
      quoteId: string
      input: CreateQuoteParticipantInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quotes/${quoteId}/participants`,
        quoteParticipantSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string; quoteId: string }) => {
      await fetchWithValidation(
        `/v1/admin/quotes/quote-participants/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, vars) => invalidate(vars.quoteId),
  })

  return { create, remove }
}
