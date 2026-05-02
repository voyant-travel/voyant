"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  InitiateCheckoutCollectionInput,
  InitiatedCheckoutCollectionRecord,
} from "@voyantjs/checkout"

import { useVoyantCheckoutContext } from "../provider.js"

interface InitiatedCheckoutCollectionResponse {
  data: InitiatedCheckoutCollectionRecord
}

/**
 * Admin-side: kick off a checkout collection against a booking. Mounts at
 * `/v1/admin/checkout/bookings/:bookingId/initiate-collection` (the public
 * mirror is gated behind `actor=customer` and only reachable from a public
 * storefront / customer portal).
 *
 * Invalidates booking + public-booking-payments queries on success so the
 * caller's payments summary re-fetches automatically.
 */
export function useInitiateCheckoutCollection(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantCheckoutContext()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (
      input: InitiateCheckoutCollectionInput,
    ): Promise<InitiatedCheckoutCollectionRecord> => {
      const response = await fetcher(
        `${baseUrl}/v1/admin/checkout/bookings/${bookingId}/initiate-collection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      )
      const body = (await response.json()) as
        | InitiatedCheckoutCollectionResponse
        | { error: string }
      if (!response.ok) {
        const message = "error" in body ? body.error : `Checkout failed: ${response.status}`
        throw new Error(message)
      }
      return (body as InitiatedCheckoutCollectionResponse).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", bookingId] })
      qc.invalidateQueries({ queryKey: ["public-booking-payments", bookingId] })
    },
  })
}
