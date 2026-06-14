"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertGroundDriverSchema, updateGroundDriverSchema } from "@voyantjs/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantGroundContext } from "../provider.js"
import { groundQueryKeys } from "../query-keys.js"
import { groundDriverSingleResponse, successEnvelope } from "../schemas.js"

export type CreateGroundDriverInput = z.input<typeof insertGroundDriverSchema>
export type UpdateGroundDriverInput = z.input<typeof updateGroundDriverSchema>

export function useGroundDriverMutation() {
  const { baseUrl, fetcher } = useVoyantGroundContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateGroundDriverInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/drivers",
        groundDriverSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.drivers() })
      queryClient.setQueryData(groundQueryKeys.driver(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateGroundDriverInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/drivers/${id}`,
        groundDriverSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.drivers() })
      queryClient.setQueryData(groundQueryKeys.driver(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/drivers/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.drivers() })
      queryClient.removeQueries({ queryKey: groundQueryKeys.driver(id) })
    },
  })

  return { create, update, remove }
}
