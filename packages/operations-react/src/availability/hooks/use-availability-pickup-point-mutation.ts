"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantAvailabilityContext } from "../provider.js"
import { availabilityQueryKeys } from "../query-keys.js"
import {
  availabilityPickupPointSingleResponse,
  type CreateAvailabilityPickupPointInput,
  successEnvelope,
  type UpdateAvailabilityPickupPointInput,
} from "../schemas.js"

export function useAvailabilityPickupPointMutation() {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateAvailabilityPickupPointInput) => {
      const { data } = await fetchWithValidation(
        "/v1/operations/availability/pickup-points",
        availabilityPickupPointSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.pickupPoints() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.pickupPointsList({ productId: data.productId }),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdateAvailabilityPickupPointInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/operations/availability/pickup-points/${id}`,
        availabilityPickupPointSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.pickupPoints() })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/operations/availability/pickup-points/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.pickupPoints() })
    },
  })

  return { create, update, remove }
}
