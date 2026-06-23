"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CreateSessionBody, UpdateSessionBody } from "@voyant-travel/mice"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { miceQueryKeys } from "../query-keys.js"
import { sessionSingleResponse } from "../schemas.js"

const basePath = "/v1/admin/mice"

/**
 * Create/update mutations for a program's agenda sessions. Both invalidate the
 * owning program's session list so the section refreshes in place.
 */
export function useSessionMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const invalidate = (programId: string) =>
    queryClient.invalidateQueries({ queryKey: miceQueryKeys.sessionsList(programId) })

  const create = useMutation({
    mutationFn: async (input: CreateSessionBody) => {
      const { data } = await fetchWithValidation(
        `${basePath}/sessions`,
        sessionSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (session) => {
      void invalidate(session.programId)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateSessionBody & { id: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/sessions/${id}`,
        sessionSingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (session) => {
      void invalidate(session.programId)
    },
  })

  return { create, update }
}
