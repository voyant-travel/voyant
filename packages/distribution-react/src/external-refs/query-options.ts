"use client"

import { queryOptions } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "./client.js"
import type { UseExternalRefsOptions } from "./hooks/use-external-refs.js"
import { externalRefsQueryKeys } from "./query-keys.js"
import { externalRefListResponse, externalRefSingleResponse } from "./schemas.js"

function toQueryString(filters: Record<string, string | number | boolean | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function getExternalRefsQueryOptions(
  client: FetchWithValidationOptions,
  options: UseExternalRefsOptions = {},
) {
  const { enabled: _enabled = true, ...filters } = options
  return queryOptions({
    queryKey: externalRefsQueryKeys.refsList(filters),
    queryFn: () =>
      fetchWithValidation(
        `/v1/external-refs/refs${toQueryString(filters)}`,
        externalRefListResponse,
        client,
      ),
  })
}

export function getExternalRefQueryOptions(client: FetchWithValidationOptions, id: string) {
  return queryOptions({
    queryKey: externalRefsQueryKeys.ref(id),
    queryFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/external-refs/refs/${id}`,
        externalRefSingleResponse,
        client,
      )
      return data
    },
  })
}
