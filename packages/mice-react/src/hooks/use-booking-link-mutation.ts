"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation, VoyantApiError } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { miceQueryKeys } from "../query-keys.js"
import { bookingMiceDetailResponse, delegateSingleResponse } from "../schemas.js"

const miceBasePath = "/v1/admin/mice"
const successResponse = z.object({ success: z.literal(true) })

export interface LinkDelegateBookingInput {
  programId: string
  delegateId: string
  bookingId: string
  previousBookingId?: string | null | undefined
}

/**
 * Links a MICE delegate to a booking in both places the backend exposes:
 * the delegate row (`bookingId`) and the booking sidecar (`mice-details`).
 */
export function useBookingLinkMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const invalidate = (input: LinkDelegateBookingInput) => {
    void queryClient.invalidateQueries({ queryKey: miceQueryKeys.delegates() })
    void queryClient.invalidateQueries({
      queryKey: miceQueryKeys.bookingMiceDetails(input.bookingId),
    })
    if (input.previousBookingId && input.previousBookingId !== input.bookingId) {
      void queryClient.invalidateQueries({
        queryKey: miceQueryKeys.bookingMiceDetails(input.previousBookingId),
      })
    }
  }

  const linkDelegateBooking = useMutation({
    mutationFn: async (input: LinkDelegateBookingInput) => {
      const bookingPath = `/v1/admin/bookings/${encodeURIComponent(input.bookingId)}/mice-details`
      const { data: bookingDetails } = await fetchWithValidation(
        bookingPath,
        bookingMiceDetailResponse,
        client,
        {
          method: "PUT",
          body: JSON.stringify({ programId: input.programId, delegateId: input.delegateId }),
        },
      )
      const { data: delegate } = await fetchWithValidation(
        `${miceBasePath}/delegates/${input.delegateId}`,
        delegateSingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify({ bookingId: input.bookingId }) },
      )

      if (input.previousBookingId && input.previousBookingId !== input.bookingId) {
        try {
          await fetchWithValidation(
            `/v1/admin/bookings/${encodeURIComponent(input.previousBookingId)}/mice-details`,
            successResponse,
            client,
            { method: "DELETE" },
          )
        } catch (error) {
          if (!(error instanceof VoyantApiError) || error.status !== 404) throw error
        }
      }

      return { bookingDetails, delegate }
    },
    onSuccess: (_result, input) => invalidate(input),
  })

  return { linkDelegateBooking }
}
