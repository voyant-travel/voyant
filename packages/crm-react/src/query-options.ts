"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseActivitiesOptions } from "./hooks/use-activities.js"
import type { UseOpportunitiesOptions } from "./hooks/use-opportunities.js"
import type { UseOrganizationsOptions } from "./hooks/use-organizations.js"
import type { UsePeopleOptions } from "./hooks/use-people.js"
import type { UsePipelinesOptions } from "./hooks/use-pipelines.js"
import type { UseQuotesOptions } from "./hooks/use-quotes.js"
import type { UseStagesOptions } from "./hooks/use-stages.js"
import { crmQueryKeys } from "./query-keys.js"
import {
  activityListResponse,
  opportunityListResponse,
  opportunitySingleResponse,
  organizationListResponse,
  organizationSingleResponse,
  personListResponse,
  personNoteListResponse,
  personSingleResponse,
  pipelineListResponse,
  pipelineSingleResponse,
  quoteLineListResponse,
  quoteListResponse,
  quoteSingleResponse,
  stageListResponse,
  stageSingleResponse,
} from "./schemas.js"

export function getActivitiesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseActivitiesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: crmQueryKeys.activitiesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.status) params.set("status", filters.status)
      if (filters.type) params.set("type", filters.type)
      if (filters.entityType) params.set("entityType", filters.entityType)
      if (filters.entityId) params.set("entityId", filters.entityId)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(`/v1/crm/activities${qs ? `?${qs}` : ""}`, activityListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
    },
  })
}

export function getPeopleQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePeopleOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: crmQueryKeys.peopleList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.organizationId) params.set("organizationId", filters.organizationId)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.relation) params.set("relation", filters.relation)
      if (filters.status) params.set("status", filters.status)
      if (filters.sortBy) params.set("sortBy", filters.sortBy)
      if (filters.sortDir) params.set("sortDir", filters.sortDir)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(`/v1/crm/people${qs ? `?${qs}` : ""}`, personListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
    },
  })
}

export function getPersonQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: crmQueryKeys.person(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(`/v1/crm/people/${id}`, personSingleResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
      return data
    },
  })
}

export function getPersonNotesQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: ["person-notes", id],
    queryFn: () =>
      fetchWithValidation(`/v1/crm/people/${id}/notes`, personNoteListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      }),
  })
}

export function getPersonActivitiesQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: ["person-activities", id],
    queryFn: () =>
      fetchWithValidation(
        `/v1/crm/activities?entityType=person&entityId=${id}&limit=50`,
        activityListResponse,
        { baseUrl: client.baseUrl, fetcher: client.fetcher },
      ),
  })
}

export function getPersonOpportunitiesQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: ["person-opportunities", id],
    queryFn: () =>
      fetchWithValidation(
        `/v1/crm/opportunities?personId=${id}&limit=20`,
        opportunityListResponse,
        {
          baseUrl: client.baseUrl,
          fetcher: client.fetcher,
        },
      ),
  })
}

export function getOrganizationsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseOrganizationsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: crmQueryKeys.organizationsList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.search) params.set("search", filters.search)
      if (filters.taxId) params.set("taxId", filters.taxId)
      if (filters.ownerId) params.set("ownerId", filters.ownerId)
      if (filters.relation) params.set("relation", filters.relation)
      if (filters.status) params.set("status", filters.status)
      if (filters.sortBy) params.set("sortBy", filters.sortBy)
      if (filters.sortDir) params.set("sortDir", filters.sortDir)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(
        `/v1/crm/organizations${qs ? `?${qs}` : ""}`,
        organizationListResponse,
        { baseUrl: client.baseUrl, fetcher: client.fetcher },
      )
    },
  })
}

export function getOrganizationQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: crmQueryKeys.organization(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/crm/organizations/${id}`,
        organizationSingleResponse,
        { baseUrl: client.baseUrl, fetcher: client.fetcher },
      )
      return data
    },
  })
}

export function getPipelinesQueryOptions(
  client: FetchWithValidationOptions,
  options: UsePipelinesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: crmQueryKeys.pipelinesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.entityType) params.set("entityType", filters.entityType)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(`/v1/crm/pipelines${qs ? `?${qs}` : ""}`, pipelineListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
    },
  })
}

export function getPipelineQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: crmQueryKeys.pipeline(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/crm/pipelines/${id}`,
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
    queryKey: crmQueryKeys.stagesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.pipelineId) params.set("pipelineId", filters.pipelineId)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(`/v1/crm/stages${qs ? `?${qs}` : ""}`, stageListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
    },
  })
}

export function getStageQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: crmQueryKeys.stage(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(`/v1/crm/stages/${id}`, stageSingleResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
      return data
    },
  })
}

export function getOpportunitiesQueryOptions(
  client: FetchWithValidationOptions,
  options: UseOpportunitiesOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options

  return queryOptions({
    queryKey: crmQueryKeys.opportunitiesList(filters),
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

      return fetchWithValidation(
        `/v1/crm/opportunities${qs ? `?${qs}` : ""}`,
        opportunityListResponse,
        { baseUrl: client.baseUrl, fetcher: client.fetcher },
      )
    },
  })
}

export function getOpportunityQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: crmQueryKeys.opportunity(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/crm/opportunities/${id}`,
        opportunitySingleResponse,
        { baseUrl: client.baseUrl, fetcher: client.fetcher },
      )
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
    queryKey: crmQueryKeys.quotesList(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.opportunityId) params.set("opportunityId", filters.opportunityId)
      if (filters.status) params.set("status", filters.status)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()

      return fetchWithValidation(`/v1/crm/quotes${qs ? `?${qs}` : ""}`, quoteListResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
    },
  })
}

export function getQuoteQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: crmQueryKeys.quote(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(`/v1/crm/quotes/${id}`, quoteSingleResponse, {
        baseUrl: client.baseUrl,
        fetcher: client.fetcher,
      })
      return data
    },
  })
}

export function getQuoteLinesQueryOptions(client: FetchWithValidationOptions, quoteId: string) {
  return queryOptions({
    queryKey: crmQueryKeys.quoteLines(quoteId),
    queryFn: async () => {
      const data = await fetchWithValidation(
        `/v1/crm/quotes/${quoteId}/lines`,
        quoteLineListResponse,
        {
          baseUrl: client.baseUrl,
          fetcher: client.fetcher,
        },
      )
      return data.data
    },
  })
}
