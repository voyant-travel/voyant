"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertFacilitySchema, updateFacilitySchema } from "@voyantjs/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFacilitiesContext } from "../provider.js"
import { facilitiesQueryKeys } from "../query-keys.js"
import { facilitySingleResponse, successEnvelope } from "../schemas.js"

export type CreateFacilityInput = z.input<typeof insertFacilitySchema>
export type UpdateFacilityInput = z.input<typeof updateFacilitySchema>

export function useFacilityMutation() {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateFacilityInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/facilities",
        facilitySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.facilities() })
      queryClient.setQueryData(facilitiesQueryKeys.facility(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateFacilityInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/facilities/${id}`,
        facilitySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.facilities() })
      queryClient.setQueryData(facilitiesQueryKeys.facility(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/facilities/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.facilities() })
      queryClient.removeQueries({ queryKey: facilitiesQueryKeys.facility(id) })
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.properties() })
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.facilityFeatures() })
      void queryClient.invalidateQueries({
        queryKey: facilitiesQueryKeys.facilityOperationSchedules(),
      })
    },
  })

  return { create, update, remove }
}
