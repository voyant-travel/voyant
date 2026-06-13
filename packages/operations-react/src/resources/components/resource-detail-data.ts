"use client"

import type { QueryClient } from "@tanstack/react-query"
import { queryOptions, useQuery } from "@tanstack/react-query"
import {
  getAllocationQueryOptions,
  getAllocationsQueryOptions,
  getAssignmentQueryOptions,
  getAssignmentsQueryOptions,
  getBookingsQueryOptions,
  getCloseoutsQueryOptions,
  getPoolQueryOptions,
  getPoolsQueryOptions,
  getProductsQueryOptions,
  getResourceQueryOptions,
  getResourcesQueryOptions,
  getRulesQueryOptions,
  getSlotsQueryOptions,
  getStartTimesQueryOptions,
  getSuppliersQueryOptions,
  resourcesQueryKeys,
  useVoyantResourcesContext,
  type VoyantResourcesContextValue,
} from "../index.js"

const DETAIL_LIMIT = 25

export type ResourcePoolMemberRow = {
  id: string
  poolId: string
  resourceId: string
}

type ListResponse<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
}

type PoolMemberFilters = {
  poolId?: string | undefined
  resourceId?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

async function fetchJson<T>(client: VoyantResourcesContextValue, path: string): Promise<T> {
  const response = await client.fetcher(joinUrl(client.baseUrl, path))

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Voyant API error: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

export function getResourcePoolMembersQueryOptions(
  client: VoyantResourcesContextValue,
  filters: PoolMemberFilters = {},
) {
  return queryOptions({
    queryKey: [...resourcesQueryKeys.all, "pool-members", "list", filters] as const,
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.poolId) params.set("poolId", filters.poolId)
      if (filters.resourceId) params.set("resourceId", filters.resourceId)
      if (filters.limit !== undefined) params.set("limit", String(filters.limit))
      if (filters.offset !== undefined) params.set("offset", String(filters.offset))
      const qs = params.toString()
      return fetchJson<ListResponse<ResourcePoolMemberRow>>(
        client,
        `/v1/operations/resources/pool-members${qs ? `?${qs}` : ""}`,
      )
    },
  })
}

export function useResourcePoolMembers(filters: PoolMemberFilters = {}) {
  const client = useVoyantResourcesContext()
  const enabled = Boolean(filters.poolId || filters.resourceId)

  return useQuery({
    ...getResourcePoolMembersQueryOptions(client, filters),
    enabled,
  })
}

export async function ensureResourceDetailPageData(
  queryClient: QueryClient,
  client: VoyantResourcesContextValue,
  id: string,
) {
  await queryClient.ensureQueryData(getResourceQueryOptions(client, id))

  await Promise.all([
    queryClient.ensureQueryData(
      getResourcePoolMembersQueryOptions(client, { resourceId: id, limit: DETAIL_LIMIT }),
    ),
    queryClient.ensureQueryData(getPoolsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(
      getAssignmentsQueryOptions(client, { resourceId: id, limit: DETAIL_LIMIT }),
    ),
    queryClient.ensureQueryData(getSlotsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(getBookingsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(
      getCloseoutsQueryOptions(client, { resourceId: id, limit: DETAIL_LIMIT }),
    ),
    queryClient.ensureQueryData(getSuppliersQueryOptions(client, { limit: DETAIL_LIMIT })),
  ])
}

export async function ensureResourcePoolDetailPageData(
  queryClient: QueryClient,
  client: VoyantResourcesContextValue,
  id: string,
) {
  await queryClient.ensureQueryData(getPoolQueryOptions(client, id))

  await Promise.all([
    queryClient.ensureQueryData(
      getResourcePoolMembersQueryOptions(client, { poolId: id, limit: DETAIL_LIMIT }),
    ),
    queryClient.ensureQueryData(getResourcesQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(
      getAllocationsQueryOptions(client, { poolId: id, limit: DETAIL_LIMIT }),
    ),
    queryClient.ensureQueryData(
      getAssignmentsQueryOptions(client, { poolId: id, limit: DETAIL_LIMIT }),
    ),
    queryClient.ensureQueryData(getSlotsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(getBookingsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(getProductsQueryOptions(client, { limit: DETAIL_LIMIT })),
  ])
}

export async function ensureResourceAllocationDetailPageData(
  queryClient: QueryClient,
  client: VoyantResourcesContextValue,
  id: string,
) {
  const allocation = await queryClient.ensureQueryData(getAllocationQueryOptions(client, id))

  await Promise.all([
    queryClient.ensureQueryData(getPoolQueryOptions(client, allocation.poolId)),
    queryClient.ensureQueryData(getProductsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(
      getRulesQueryOptions(client, { productId: allocation.productId, limit: DETAIL_LIMIT }),
    ),
    queryClient.ensureQueryData(
      getStartTimesQueryOptions(client, { productId: allocation.productId, limit: DETAIL_LIMIT }),
    ),
  ])
}

export async function ensureResourceAssignmentDetailPageData(
  queryClient: QueryClient,
  client: VoyantResourcesContextValue,
  id: string,
) {
  const assignment = await queryClient.ensureQueryData(getAssignmentQueryOptions(client, id))

  await Promise.all([
    assignment.poolId
      ? queryClient.ensureQueryData(getPoolQueryOptions(client, assignment.poolId))
      : Promise.resolve(),
    assignment.resourceId
      ? queryClient.ensureQueryData(getResourceQueryOptions(client, assignment.resourceId))
      : Promise.resolve(),
    queryClient.ensureQueryData(getSlotsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(getBookingsQueryOptions(client, { limit: DETAIL_LIMIT })),
    queryClient.ensureQueryData(getProductsQueryOptions(client, { limit: DETAIL_LIMIT })),
  ])
}
