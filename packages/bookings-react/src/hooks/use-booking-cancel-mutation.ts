"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingSingleResponse } from "../schemas.js"

export interface CancelBookingInput {
  note?: string | null
}

/**
 * Cancels a booking via POST /v1/admin/bookings/:id/cancel.
 * The backend releases allocations, cancels items, and logs a status-change activity.
 */
export function useBookingCancelMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CancelBookingInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/cancel`,
        bookingSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.booking(bookingId) })
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    },
  })
}
