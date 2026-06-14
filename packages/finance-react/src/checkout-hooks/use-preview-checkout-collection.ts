"use client"

import { useMutation } from "@tanstack/react-query"
import type {
  CheckoutCollectionPlanRecord,
  PreviewCheckoutCollectionInput,
} from "@voyant-travel/finance/checkout"

import { useVoyantFinanceContext } from "../provider.js"

interface PreviewCheckoutCollectionResponse {
  data: CheckoutCollectionPlanRecord
}

/**
 * Admin-side: preview the collection plan for a booking before initiating.
 * Returns what the operator will collect (deposit / balance / custom amount),
 * which schedule or invoice the session will target, and which method is
 * about to be used. Useful for an "About to charge X" confirmation step.
 */
export function usePreviewCheckoutCollection(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()

  return useMutation({
    mutationFn: async (
      input?: PreviewCheckoutCollectionInput,
    ): Promise<CheckoutCollectionPlanRecord> => {
      const response = await fetcher(
        `${baseUrl}/v1/admin/finance/bookings/${bookingId}/collection-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: input ? JSON.stringify(input) : "{}",
        },
      )
      const body = (await response.json()) as PreviewCheckoutCollectionResponse | { error: string }
      if (!response.ok) {
        const message = "error" in body ? body.error : `Preview failed: ${response.status}`
        throw new Error(message)
      }
      return (body as PreviewCheckoutCollectionResponse).data
    },
  })
}
