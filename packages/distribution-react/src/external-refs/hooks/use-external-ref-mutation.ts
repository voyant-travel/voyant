"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertExternalRefSchema, updateExternalRefSchema } from "@voyant-travel/distribution"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantExternalRefsContext } from "../provider.js"
import { externalRefsQueryKeys } from "../query-keys.js"
import { externalRefSingleResponse, successEnvelope } from "../schemas.js"

export type CreateExternalRefInput = z.input<typeof insertExternalRefSchema>
export type UpdateExternalRefInput = z.input<typeof updateExternalRefSchema>

export function useExternalRefMutation() {
  const { baseUrl, fetcher } = useVoyantExternalRefsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateExternalRefInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/external-refs/refs",
        externalRefSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: externalRefsQueryKeys.refs() })
      queryClient.setQueryData(externalRefsQueryKeys.ref(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateExternalRefInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/external-refs/refs/${id}`,
        externalRefSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: externalRefsQueryKeys.refs() })
      queryClient.setQueryData(externalRefsQueryKeys.ref(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/external-refs/refs/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: externalRefsQueryKeys.refs() })
      queryClient.removeQueries({ queryKey: externalRefsQueryKeys.ref(id) })
    },
  })

  return { create, update, remove }
}
