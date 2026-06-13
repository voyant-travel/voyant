"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantAvailabilityContext } from "../provider.js"
import { availabilityQueryKeys } from "../query-keys.js"
import {
  availabilitySlotRecordResponse,
  type CreateAvailabilitySlotInput,
  successEnvelope,
  type UpdateAvailabilitySlotInput,
} from "../schemas.js"

export function useAvailabilitySlotMutation() {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateAvailabilitySlotInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/availability/slots",
        availabilitySlotRecordResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.slots() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.slotsList({ productId: data.productId }),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateAvailabilitySlotInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/availability/slots/${id}`,
        availabilitySlotRecordResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.slots() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.slotDetail(data.id),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/availability/slots/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.slots() })
    },
  })

  return { create, update, remove }
}
