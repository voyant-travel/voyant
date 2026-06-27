"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingGroupSingleResponse, successEnvelope } from "../schemas.js"

export interface CreateBookingGroupInput {
  kind?: "shared_room" | "other"
  label: string
  primaryBookingId?: string | null
  productId?: string | null
  optionUnitId?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateBookingGroupInput = Partial<CreateBookingGroupInput>

export function useBookingGroupMutation() {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.groups() })
  }

  const create = useMutation({
    mutationFn: async (input: CreateBookingGroupInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/bookings/groups",
        bookingGroupSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBookingGroupInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/groups/${id}`,
        bookingGroupSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/bookings/groups/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
