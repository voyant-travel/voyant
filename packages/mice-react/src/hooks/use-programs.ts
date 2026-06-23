"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantContext } from "../provider.js"
import type { ProgramListFilters } from "../query-keys.js"
import {
  getProgramCostSheetQueryOptions,
  getProgramQueryOptions,
  getProgramsQueryOptions,
} from "../query-options.js"

export interface UseProgramsOptions extends ProgramListFilters {
  enabled?: boolean
}

export function usePrograms(options: UseProgramsOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options
  return useQuery({ ...getProgramsQueryOptions({ baseUrl, fetcher }, filters), enabled })
}

export function useProgram(id: string | undefined, options: { enabled?: boolean } = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getProgramQueryOptions({ baseUrl, fetcher }, id ?? ""),
    enabled: (options.enabled ?? true) && !!id,
  })
}

export function useProgramCostSheet(id: string | undefined, options: { enabled?: boolean } = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getProgramCostSheetQueryOptions({ baseUrl, fetcher }, id ?? ""),
    enabled: (options.enabled ?? true) && !!id,
  })
}
