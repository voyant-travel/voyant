"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantLegalContext } from "../provider.js"
import { getLegalTermQueryOptions } from "../query-options.js"

export interface UseLegalTermOptions {
  enabled?: boolean
}

export function useLegalTerm(id: string, options: UseLegalTermOptions = {}) {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const { enabled = true } = options

  return useQuery({
    ...getLegalTermQueryOptions({ baseUrl, fetcher }, id),
    enabled,
  })
}
