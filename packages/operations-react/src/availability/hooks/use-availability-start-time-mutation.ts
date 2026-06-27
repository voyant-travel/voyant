"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantAvailabilityContext } from "../provider.js"
import { availabilityQueryKeys } from "../query-keys.js"
import {
  availabilityStartTimeSingleResponse,
  type CreateAvailabilityStartTimeInput,
  successEnvelope,
  type UpdateAvailabilityStartTimeInput,
} from "../schemas.js"

export function useAvailabilityStartTimeMutation() {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateAvailabilityStartTimeInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/operations/availability/start-times",
        availabilityStartTimeSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.startTimes() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.startTimesList({ productId: data.productId }),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateAvailabilityStartTimeInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/availability/start-times/${id}`,
        availabilityStartTimeSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.startTimes() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.startTimeDetail(data.id),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/operations/availability/start-times/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.startTimes() })
    },
  })

  return { create, update, remove }
}
