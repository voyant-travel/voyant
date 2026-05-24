"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { dispatchBookingStatusChange } from "@voyantjs/bookings/status-dispatch"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { type BookingRecord, bookingSingleResponse } from "../schemas.js"

type BookingStatus = BookingRecord["status"]

export interface UpdateBookingStatusInput {
  /**
   * Current status — required for client-side dispatch to the right verb
   * endpoint. The dialog has this in its props; pass it through.
   */
  currentStatus: BookingStatus
  status: BookingStatus
  note?: string | null
  /**
   * When true and `status === "confirmed"`, downstream subscribers
   * (auto-dispatch notifications, document bundle email) skip
   * sending. Lets the operator confirm a booking silently.
   */
  suppressNotifications?: boolean
  /**
   * When true and the status change falls through to override-status, keep
   * the audit event but skip verb-specific lifecycle events.
   */
  suppressLifecycleEvents?: boolean
}

export function useBookingStatusMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateBookingStatusInput) => {
      const target = dispatchBookingStatusChange(
        bookingId,
        input.currentStatus,
        input.status,
        input.note,
        {
          suppressNotifications: input.suppressNotifications,
          suppressLifecycleEvents: input.suppressLifecycleEvents,
        },
      )
      const { data } = await fetchWithValidation(
        target.path,
        bookingSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(target.body) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
      queryClient.setQueryData(bookingsQueryKeys.booking(bookingId), { data })
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    },
  })
}

export interface UpdateBookingStatusByIdInput extends UpdateBookingStatusInput {
  bookingId: string
}

/**
 * Variant of `useBookingStatusMutation` that accepts the booking id at call
 * time instead of at hook-setup time. Used by flows that create a booking
 * and immediately transition its status in the same handler — the id only
 * exists after the create returns, so the per-booking hook shape doesn't
 * fit.
 */
export function useBookingStatusByIdMutation() {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      bookingId,
      currentStatus,
      status,
      note,
      suppressNotifications,
      suppressLifecycleEvents,
    }: UpdateBookingStatusByIdInput) => {
      const target = dispatchBookingStatusChange(bookingId, currentStatus, status, note, {
        suppressNotifications,
        suppressLifecycleEvents,
      })
      const { data } = await fetchWithValidation(
        target.path,
        bookingSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(target.body) },
      )
      return data
    },
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
      queryClient.setQueryData(bookingsQueryKeys.booking(variables.bookingId), { data })
      void queryClient.invalidateQueries({
        queryKey: bookingsQueryKeys.activity(variables.bookingId),
      })
    },
  })
}
