"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantLegalContext } from "../provider.js"
import type { LegalContractTemplateDefaultFilters } from "../query-keys.js"
import { getDefaultLegalContractTemplateQueryOptions } from "../query-options.js"

export interface UseDefaultLegalContractTemplateOptions
  extends LegalContractTemplateDefaultFilters {
  enabled?: boolean
}

export function useDefaultLegalContractTemplate(
  options: UseDefaultLegalContractTemplateOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    ...getDefaultLegalContractTemplateQueryOptions({ baseUrl, fetcher }, filters),
    enabled,
  })
}
