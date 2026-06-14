"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertGroundOperatorSchema,
  updateGroundOperatorSchema,
} from "@voyant-travel/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantGroundContext } from "../provider.js"
import { groundQueryKeys } from "../query-keys.js"
import { groundOperatorSingleResponse, successEnvelope } from "../schemas.js"

export type CreateGroundOperatorInput = z.input<typeof insertGroundOperatorSchema>
export type UpdateGroundOperatorInput = z.input<typeof updateGroundOperatorSchema>

export function useGroundOperatorMutation() {
  const { baseUrl, fetcher } = useVoyantGroundContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateGroundOperatorInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/operators",
        groundOperatorSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.operators() })
      queryClient.setQueryData(groundQueryKeys.operator(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateGroundOperatorInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/operators/${id}`,
        groundOperatorSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.operators() })
      queryClient.setQueryData(groundQueryKeys.operator(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/operators/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.operators() })
      queryClient.removeQueries({ queryKey: groundQueryKeys.operator(id) })
    },
  })

  return { create, update, remove }
}
