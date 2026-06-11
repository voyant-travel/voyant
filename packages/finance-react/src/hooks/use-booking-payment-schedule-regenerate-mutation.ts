"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { type FinancePaymentPolicy, regenerateBookingPaymentScheduleResponse } from "../schemas.js"

export interface RegenerateBookingPaymentScheduleInput {
  /**
   * Booking-level policy override. When the property is present it is
   * persisted onto the booking before the cascade resolver runs; pass
   * `null` to clear an existing override (the cascade falls back to
   * listing → category → supplier → operator default). Omit the property
   * to regenerate with whatever is currently persisted.
   */
  customerPaymentPolicy?: FinancePaymentPolicy | null
}

/**
 * Regenerate a booking's customer payment schedule
 * (`POST /v1/admin/bookings/:bookingId/payment-schedule/regenerate`).
 * Returns the regenerated schedule rows, the persisted booking-level
 * override (or null) and which cascade layer the schedule came from.
 */
export function useBookingPaymentScheduleRegenerateMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RegenerateBookingPaymentScheduleInput = {}) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/payment-schedule/regenerate`,
        regenerateBookingPaymentScheduleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: financeQueryKeys.bookingPaymentSchedules(bookingId),
      })
    },
  })
}
