"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertFacilityFeatureSchema,
  updateFacilityFeatureSchema,
} from "@voyant-travel/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFacilitiesContext } from "../provider.js"
import { facilitiesQueryKeys } from "../query-keys.js"
import { facilityFeatureSingleResponse, successEnvelope } from "../schemas.js"

export type CreateFacilityFeatureInput = z.input<typeof insertFacilityFeatureSchema> & {
  facilityId: string
}
export type UpdateFacilityFeatureInput = z.input<typeof updateFacilityFeatureSchema>

export function useFacilityFeatureMutation() {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({ facilityId, ...input }: CreateFacilityFeatureInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/facilities/${facilityId}/features`,
        facilityFeatureSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.facilityFeatures() })
      queryClient.setQueryData(facilitiesQueryKeys.facilityFeature(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateFacilityFeatureInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/facility-features/${id}`,
        facilityFeatureSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.facilityFeatures() })
      queryClient.setQueryData(facilitiesQueryKeys.facilityFeature(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/operations/facility-features/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: facilitiesQueryKeys.facilityFeatures() })
      queryClient.removeQueries({ queryKey: facilitiesQueryKeys.facilityFeature(id) })
    },
  })

  return { create, update, remove }
}
