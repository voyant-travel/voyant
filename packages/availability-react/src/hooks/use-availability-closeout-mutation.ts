"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantAvailabilityContext } from "../provider.js"
import { availabilityQueryKeys } from "../query-keys.js"
import {
  availabilityCloseoutSingleResponse,
  type CreateAvailabilityCloseoutInput,
  successEnvelope,
  type UpdateAvailabilityCloseoutInput,
} from "../schemas.js"

export function useAvailabilityCloseoutMutation() {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateAvailabilityCloseoutInput) => {
      const { data } = await fetchWithValidation(
        "/v1/availability/closeouts",
        availabilityCloseoutSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.closeouts() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.closeoutsList({ productId: data.productId }),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateAvailabilityCloseoutInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/availability/closeouts/${id}`,
        availabilityCloseoutSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.closeouts() })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/availability/closeouts/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.closeouts() })
    },
  })

  return { create, update, remove }
}
