"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantLegalContext } from "../provider.js"
import type { LegalTermsListFilters } from "../query-keys.js"
import { getLegalTermsQueryOptions } from "../query-options.js"

export interface UseLegalTermsOptions extends LegalTermsListFilters {
  enabled?: boolean
}

export function useLegalTerms(options: UseLegalTermsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getLegalTermsQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
