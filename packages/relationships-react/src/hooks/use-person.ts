"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import { personSingleResponse } from "../schemas.js"

export interface UsePersonOptions {
  enabled?: boolean
}

/**
 * Fetches a single person by id. Returns `null` for unknown ids (the API
 * responds with 404 which is treated as a thrown error — callers can wrap
 * with a React Query `onError` or check `query.isError`).
 */
export function usePerson(id: string | undefined, options: UsePersonOptions = {}) {
  const { baseUrl, fetcher } = useVoyantContext()
  const { enabled = true } = options

  return useQuery({
    queryKey: relationshipsQueryKeys.person(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("usePerson requires an id")
      const { data } = await fetchWithValidation(
        `/v1/relationships/people/${id}`,
        personSingleResponse,
        {
          baseUrl,
          fetcher,
        },
      )
      return data
    },
    enabled: enabled && Boolean(id),
  })
}
