"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertGroundVehicleSchema, updateGroundVehicleSchema } from "@voyantjs/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantGroundContext } from "../provider.js"
import { groundQueryKeys } from "../query-keys.js"
import { groundVehicleSingleResponse, successEnvelope } from "../schemas.js"

export type CreateGroundVehicleInput = z.input<typeof insertGroundVehicleSchema>
export type UpdateGroundVehicleInput = z.input<typeof updateGroundVehicleSchema>

export function useGroundVehicleMutation() {
  const { baseUrl, fetcher } = useVoyantGroundContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateGroundVehicleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/vehicles",
        groundVehicleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.vehicles() })
      queryClient.setQueryData(groundQueryKeys.vehicle(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateGroundVehicleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/vehicles/${id}`,
        groundVehicleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.vehicles() })
      queryClient.setQueryData(groundQueryKeys.vehicle(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/vehicles/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: groundQueryKeys.vehicles() })
      queryClient.removeQueries({ queryKey: groundQueryKeys.vehicle(id) })
    },
  })

  return { create, update, remove }
}
