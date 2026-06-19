"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import { quoteParticipantListResponse } from "../schemas.js"

export interface UseQuoteParticipantsOptions {
  enabled?: boolean
}

/** Lists a quote's participants (the travelers / PAX). */
export function useQuoteParticipants(
  quoteId: string | undefined,
  options: UseQuoteParticipantsOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: quotesQueryKeys.quoteParticipants(quoteId ?? ""),
    queryFn: () =>
      fetchWithValidation(
        `/v1/quotes/quotes/${quoteId}/participants`,
        quoteParticipantListResponse,
        { baseUrl, fetcher },
      ),
    enabled: enabled && Boolean(quoteId),
  })
}
