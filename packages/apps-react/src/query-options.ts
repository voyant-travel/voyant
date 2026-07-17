import { queryOptions } from "@tanstack/react-query"
import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import { type AppListFilters, appsQueryKeys, type InstallationListFilters } from "./query-keys.js"
import {
  appListResponse,
  appReleasesResponse,
  appSingleResponse,
  auditListResponse,
  installationDetailResponse,
  installationListResponse,
} from "./schemas.js"

function withQuery(path: string, params: URLSearchParams) {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function getAppsQueryOptions(
  client: FetchWithValidationOptions,
  filters: AppListFilters = {},
) {
  const params = new URLSearchParams()
  if (filters.ownerId) params.set("ownerId", filters.ownerId)
  if (filters.distribution) params.set("distribution", filters.distribution)
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters.offset !== undefined) params.set("offset", String(filters.offset))
  return queryOptions({
    queryKey: appsQueryKeys.appsList(filters),
    queryFn: () =>
      fetchWithValidation(withQuery("/v1/admin/apps", params), appListResponse, client),
  })
}

export function getAppQueryOptions(client: FetchWithValidationOptions, appId: string) {
  return queryOptions({
    queryKey: appsQueryKeys.app(appId),
    queryFn: () => fetchWithValidation(`/v1/admin/apps/${appId}`, appSingleResponse, client),
  })
}

export function getAppReleasesQueryOptions(client: FetchWithValidationOptions, appId: string) {
  return queryOptions({
    queryKey: appsQueryKeys.appReleases(appId),
    queryFn: () =>
      fetchWithValidation(`/v1/admin/apps/${appId}/releases`, appReleasesResponse, client),
  })
}

export function getInstallationsQueryOptions(
  client: FetchWithValidationOptions,
  filters: InstallationListFilters = {},
) {
  const params = new URLSearchParams()
  if (filters.appId) params.set("appId", filters.appId)
  if (filters.status) params.set("status", filters.status)
  if (filters.deploymentId) params.set("deploymentId", filters.deploymentId)
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters.offset !== undefined) params.set("offset", String(filters.offset))
  return queryOptions({
    queryKey: appsQueryKeys.installationsList(filters),
    queryFn: () =>
      fetchWithValidation(
        withQuery("/v1/admin/apps/installations", params),
        installationListResponse,
        client,
      ),
  })
}

export function getInstallationQueryOptions(
  client: FetchWithValidationOptions,
  installationId: string,
) {
  return queryOptions({
    queryKey: appsQueryKeys.installation(installationId),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/apps/installations/${installationId}`,
        installationDetailResponse,
        client,
      ),
  })
}

export function getInstallationAuditQueryOptions(
  client: FetchWithValidationOptions,
  installationId: string,
  limit?: number,
) {
  const params = new URLSearchParams()
  if (limit !== undefined) params.set("limit", String(limit))
  return queryOptions({
    queryKey: appsQueryKeys.installationAudit(installationId, limit),
    queryFn: () =>
      fetchWithValidation(
        withQuery(`/v1/admin/apps/installations/${installationId}/audit`, params),
        auditListResponse,
        client,
      ),
  })
}
