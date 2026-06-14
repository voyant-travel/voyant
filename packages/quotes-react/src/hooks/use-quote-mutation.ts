"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteSingleResponse } from "../schemas.js"

export interface CreateQuoteInput {
  title: string
  pipelineId: string
  stageId: string
  personId?: string | null
  organizationId?: string | null
  ownerId?: string | null
  status?: string
  acceptedVersionId?: string | null
  valueAmountCents?: number | null
  valueCurrency?: string | null
  expectedCloseDate?: string | null
  source?: string | null
  sourceRef?: string | null
  lostReason?: string | null
  tags?: string[]
  [key: string]: unknown
}

export type UpdateQuoteInput = Partial<CreateQuoteInput>

const deleteResponseSchema = z.object({ success: z.boolean() })

export function useQuoteMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateQuoteInput) => {
      const { data } = await fetchWithValidation(
        "/v1/quotes/quotes",
        quoteSingleResponse,
        {
          baseUrl,
          fetcher,
        },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quotes() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateQuoteInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/quotes/quotes/${id}`,
        quoteSingleResponse,
        {
          baseUrl,
          fetcher,
        },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quotes() })
      queryClient.setQueryData(quotesQueryKeys.quote(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/quotes/quotes/${id}`,
        deleteResponseSchema,
        {
          baseUrl,
          fetcher,
        },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quotes() })
      queryClient.removeQueries({ queryKey: quotesQueryKeys.quote(id) })
    },
  })

  return { create, update, remove }
}
