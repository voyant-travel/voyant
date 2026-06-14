"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertFacilityOperationScheduleSchema,
  updateFacilityOperationScheduleSchema,
} from "@voyant-travel/operations"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFacilitiesContext } from "../provider.js"
import { facilitiesQueryKeys } from "../query-keys.js"
import { facilityOperationScheduleSingleResponse, successEnvelope } from "../schemas.js"

export type CreateFacilityOperationScheduleInput = z.input<
  typeof insertFacilityOperationScheduleSchema
> & {
  facilityId: string
}
export type UpdateFacilityOperationScheduleInput = z.input<
  typeof updateFacilityOperationScheduleSchema
>

export function useFacilityOperationScheduleMutation() {
  const { baseUrl, fetcher } = useVoyantFacilitiesContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({ facilityId, ...input }: CreateFacilityOperationScheduleInput) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/facilities/${facilityId}/operation-schedules`,
        facilityOperationScheduleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: facilitiesQueryKeys.facilityOperationSchedules(),
      })
      queryClient.setQueryData(facilitiesQueryKeys.facilityOperationSchedule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateFacilityOperationScheduleInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/facility-operation-schedules/${id}`,
        facilityOperationScheduleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: facilitiesQueryKeys.facilityOperationSchedules(),
      })
      queryClient.setQueryData(facilitiesQueryKeys.facilityOperationSchedule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/facility-operation-schedules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({
        queryKey: facilitiesQueryKeys.facilityOperationSchedules(),
      })
      queryClient.removeQueries({ queryKey: facilitiesQueryKeys.facilityOperationSchedule(id) })
    },
  })

  return { create, update, remove }
}
