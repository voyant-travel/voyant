"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantContext } from "../provider.js"
import type { DelegateListFilters, RfpListFilters } from "../query-keys.js"
import {
  getDelegatesQueryOptions,
  getRfpQueryOptions,
  getRfpsQueryOptions,
  getRoomingQueryOptions,
  getSessionsQueryOptions,
} from "../query-options.js"

export function useProgramSessions(
  programId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getSessionsQueryOptions({ baseUrl, fetcher }, programId ?? ""),
    enabled: (options.enabled ?? true) && !!programId,
  })
}

export function useProgramDelegates(
  filters: DelegateListFilters,
  options: { enabled?: boolean } = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getDelegatesQueryOptions({ baseUrl, fetcher }, filters),
    enabled: (options.enabled ?? true) && !!filters.programId,
  })
}

export function useProgramRooming(
  programId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getRoomingQueryOptions({ baseUrl, fetcher }, programId ?? ""),
    enabled: (options.enabled ?? true) && !!programId,
  })
}

export function useProgramRfps(filters: RfpListFilters, options: { enabled?: boolean } = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getRfpsQueryOptions({ baseUrl, fetcher }, filters),
    enabled: (options.enabled ?? true) && !!filters.programId,
  })
}

/** A single RFP with its embedded invitations + bids (the sourcing funnel). */
export function useRfp(rfpId: string | undefined, options: { enabled?: boolean } = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  return useQuery({
    ...getRfpQueryOptions({ baseUrl, fetcher }, rfpId ?? ""),
    enabled: (options.enabled ?? true) && !!rfpId,
  })
}
