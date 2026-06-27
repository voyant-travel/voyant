"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { type PipelinesListFilters, quotesQueryKeys } from "../query-keys.js"
import { pipelineListResponse, pipelineSingleResponse } from "../schemas.js"

export interface UsePipelinesOptions extends PipelinesListFilters {
  enabled?: boolean
}

export function usePipelines(options: UsePipelinesOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true, ...filters } = options

  return useQuery({
    queryKey: quotesQueryKeys.pipelinesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.entityType) params.set("entityType", filters.entityType)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchWithValidation(
        `/v1/admin/quotes/pipelines${qs ? `?${qs}` : ""}`,
        pipelineListResponse,
        {
          baseUrl,
          fetcher,
        },
      )
    },
    enabled,
  })
}

export interface UsePipelineOptions {
  enabled?: boolean
}

export function usePipeline(id: string | undefined, options: UsePipelineOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: quotesQueryKeys.pipeline(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("usePipeline requires an id")
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/pipelines/${id}`,
        pipelineSingleResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
