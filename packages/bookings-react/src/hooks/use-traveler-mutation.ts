"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingSingleResponse, bookingTravelersResponse, successEnvelope } from "../schemas.js"

export interface CreateTravelerInput {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  travelerCategory?: string | null
  isPrimary?: boolean | null
  notes?: string | null
}

export type UpdateTravelerInput = Partial<CreateTravelerInput>

export function useTravelerMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.booking(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.travelers(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.actionLedger(bookingId) })
  }

  const create = useMutation({
    mutationFn: async (input: CreateTravelerInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/travelers`,
        bookingSingleResponse.extend({
          data: bookingTravelersResponse.shape.data.element,
        }),
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTravelerInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/travelers/${id}`,
        bookingSingleResponse.extend({
          data: bookingTravelersResponse.shape.data.element,
        }),
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (travelerId: string) =>
      fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/travelers/${travelerId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
