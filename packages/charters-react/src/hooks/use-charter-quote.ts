import { useMutation } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantChartersContext } from "../provider.js"
import {
  type PerSuiteQuote,
  perSuiteQuoteResponse,
  type WholeYachtQuote,
  wholeYachtQuoteResponse,
} from "../schemas.js"

export interface PerSuiteQuoteRequest {
  /** For local voyages this is a `chst_*` TypeID; for external voyages it's the upstream suite externalId. */
  suiteId: string
  /** ISO-4217 currency code. The server resolves it against the suite's `pricesByCurrency` map. */
  currency: string
}

export interface WholeYachtQuoteRequest {
  /** ISO-4217 currency code. The server resolves it against the voyage's `wholeYachtPricesByCurrency` map. */
  currency: string
}

/**
 * Compose a per-suite quote against a voyage. Mutation rather than query
 * because the server validates inputs and runs the composePerSuiteQuote
 * pipeline — caching is the caller's choice.
 */
export function usePerSuiteQuote() {
  const { baseUrl, fetcher } = useVoyantChartersContext()
  const client = { baseUrl, fetcher }
  return useMutation({
    mutationFn: async ({
      voyageKey,
      input,
    }: {
      voyageKey: string
      input: PerSuiteQuoteRequest
    }): Promise<PerSuiteQuote> => {
      const result = await fetchWithValidation(
        `/v1/admin/charters/voyages/${encodeURIComponent(voyageKey)}/quote/per-suite`,
        perSuiteQuoteResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return result.data
    },
  })
}

/** Whole-yacht quote (charter fee + APA). Same mutation-shape as per-suite. */
export function useWholeYachtQuote() {
  const { baseUrl, fetcher } = useVoyantChartersContext()
  const client = { baseUrl, fetcher }
  return useMutation({
    mutationFn: async ({
      voyageKey,
      input,
    }: {
      voyageKey: string
      input: WholeYachtQuoteRequest
    }): Promise<WholeYachtQuote> => {
      const result = await fetchWithValidation(
        `/v1/admin/charters/voyages/${encodeURIComponent(voyageKey)}/quote/whole-yacht`,
        wholeYachtQuoteResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return result.data
    },
  })
}
