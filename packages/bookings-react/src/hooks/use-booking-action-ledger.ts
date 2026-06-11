"use client"

import { useInfiniteQuery } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { type BookingActionLedgerCursor, bookingActionLedgerListResponse } from "../schemas.js"

export interface UseBookingActionLedgerOptions {
  /** Page size; the server defaults to 50. */
  limit?: number
  enabled?: boolean
}

/**
 * Cursor-paged central action-ledger feed for a booking
 * (`GET /v1/admin/bookings/:id/action-ledger`). Pages merge
 * booking-targeted, traveler-targeted and item-targeted entries into one
 * chronological stream; the first page also carries the booking's
 * travelers so callers can label traveler-targeted entries.
 */
export function useBookingActionLedger(
  bookingId: string | null | undefined,
  options: UseBookingActionLedgerOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const { enabled = true, limit = 50 } = options

  return useInfiniteQuery({
    queryKey: bookingsQueryKeys.actionLedger(bookingId ?? ""),
    queryFn: ({ pageParam }) => {
      if (!bookingId) {
        throw new Error("useBookingActionLedger requires a bookingId")
      }
      const params = new URLSearchParams({ limit: String(limit) })
      if (pageParam) {
        params.set("cursorOccurredAt", pageParam.occurredAt)
        params.set("cursorId", pageParam.id)
      }
      return fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/action-ledger?${params}`,
        bookingActionLedgerListResponse,
        { baseUrl, fetcher },
      )
    },
    initialPageParam: null as BookingActionLedgerCursor | null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor,
    enabled: enabled && Boolean(bookingId),
  })
}
