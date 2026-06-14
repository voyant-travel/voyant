"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UsePipelinesOptions } from "./hooks/use-pipelines.js"
import type { UseQuoteVersionsOptions } from "./hooks/use-quote-versions.js"
import type { UseQuotesOptions } from "./hooks/use-quotes.js"
import type { UseStagesOptions } from "./hooks/use-stages.js"
import { quotesQueryKeys } from "./query-keys.js"
import {
  pipelineListResponse,
  pipelineSingleResponse,
  quoteListResponse,
  quoteSingleResponse,
  quoteVersionLineListResponse,
  quoteVersionListResponse,
  quoteVersionSingleResponse,
  stageListResponse,
  stageSingleResponse,
} from "./schemas.js"

const basePath = "/v1/quotes"

export function getPipelinesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePipelinesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: quotesQueryKeys.pipelinesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.entityType) params.set("entityType", filters.entityType)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `${basePath}/pipelines${qs ? `?${qs}` : ""}`,
        pipelineListResponse,
        {
          baseUrl: client.baseUrl,
          fetcher: client.fetcher,
        },
      )
    },
  })
}

export function getPipelineQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: quotesQueryKeys.pipeline(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `${basePath}/pipelines/${id}`,
        pipelineSingleResponse,
        {
          baseUrl: client.baseUrl,
          fetcher: client.fetcher,
        },
      )
      return data
    },
  })
}

export function getStagesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseStagesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: quotesQueryKeys.stagesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.pipelineId) params.set("pipelineId", filters.pipelineId)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(`${basePath}/stages${qs ? `?${qs}` : ""}`, stageListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
    },
  })
}

export function getStageQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: quotesQueryKeys.stage(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(`${basePath}/stages/${id}`, stageSingleResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
      return data
    },
  })
}

export function getQuotesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseQuotesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: quotesQueryKeys.quotesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.personId) params.set("personId", filters.personId)
      if (filters.organizationId) params.set("organizationId", filters.organizationId)
      if (filters.pipelineId) params.set("pipelineId", filters.pipelineId)
      if (filters.stageId) params.set("stageId", filters.stageId)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.status) params.set("status", filters.status)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(`${basePath}/quotes${qs ? `?${qs}` : ""}`, quoteListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
    },
  })
}

export function getQuoteQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: quotesQueryKeys.quote(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(`${basePath}/quotes/${id}`, quoteSingleResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
      return data
    },
  })
}

export function getQuoteVersionsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseQuoteVersionsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: quotesQueryKeys.quoteVersionsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.quoteId) params.set("quoteId", filters.quoteId)
      if (filters.status) params.set("status", filters.status)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `${basePath}/quote-versions${qs ? `?${qs}` : ""}`,
        quoteVersionListResponse,
        {
          baseUrl: client.baseUrl,
          fetcher: client.fetcher,
        },
      )
    },
  })
}

export function getQuoteVersionQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: quotesQueryKeys.quoteVersion(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `${basePath}/quote-versions/${id}`,
        quoteVersionSingleResponse,
        {
          baseUrl: client.baseUrl,
          fetcher: client.fetcher,
        },
      )
      return data
    },
  })
}

export function getQuoteVersionLinesQueryOptions(
  client: FetchWithValidationOptions,
  quoteVersionId: string,
) {
  return queryOptions({
    queryKey: quotesQueryKeys.quoteVersionLines(quoteVersionId),
    queryFn: async () => {
      const data = await fetchWithValidation(
        `${basePath}/quote-versions/${quoteVersionId}/lines`,
        quoteVersionLineListResponse,
        {
          baseUrl: client.baseUrl,
          fetcher: client.fetcher,
        },
      )
      return data.data
    },
  })
}
