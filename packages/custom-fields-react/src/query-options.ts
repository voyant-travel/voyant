import { queryOptions } from "@tanstack/react-query"
import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import { type CustomFieldDefinitionListFilters, customFieldsQueryKeys } from "./query-keys.js"
import { customFieldDefinitionListResponse, customFieldTargetsResponse } from "./schemas.js"
export function getCustomFieldTargetsQueryOptions(client: FetchWithValidationOptions) {
  return queryOptions({
    queryKey: customFieldsQueryKeys.targets(),
    queryFn: () =>
      fetchWithValidation("/v1/admin/custom-fields/targets", customFieldTargetsResponse, client),
  })
}
export function getCustomFieldDefinitionsQueryOptions(
  client: FetchWithValidationOptions,
  filters: CustomFieldDefinitionListFilters = {},
) {
  const params = new URLSearchParams()
  if (filters.entityType) params.set("entityType", filters.entityType)
  if (filters.limit !== undefined) params.set("limit", String(filters.limit))
  if (filters.offset !== undefined) params.set("offset", String(filters.offset))
  const query = params.toString()
  return queryOptions({
    queryKey: customFieldsQueryKeys.definitionsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/admin/custom-fields${query ? `?${query}` : ""}`,
        customFieldDefinitionListResponse,
        client,
      ),
  })
}
