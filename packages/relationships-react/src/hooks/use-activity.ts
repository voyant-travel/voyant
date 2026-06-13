"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import { activityLinkListResponse, activitySingleResponse } from "../schemas.js"

export interface UseActivityOptions {
  enabled?: boolean
}

export function useActivity(id: string | undefined, options: UseActivityOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.activity(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("useActivity requires an id")
      const { data } = await fetchWithValidation(
        `/v1/relationships/activities/${id}`,
        activitySingleResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}

export function useActivityLinks(activityId: string | undefined, options: UseActivityOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.activityLinks(activityId ?? ""),
    queryFn: async () => {
      if (!activityId) throw new Error("useActivityLinks requires an activityId")
      const { data } = await fetchWithValidation(
        `/v1/relationships/activities/${activityId}/links`,
        activityLinkListResponse,
        { baseUrl, fetcher },
      )
      return data
    },
    enabled: enabled && Boolean(activityId),
  })
}
