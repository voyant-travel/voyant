"use client"

import { useMutation } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingContractPreviewResponse, bookingGenerateContractResponse } from "../schemas.js"

export interface GenerateBookingContractInput {
  /** Regenerate even when the contract already has a persisted PDF. */
  force?: boolean
}

/**
 * Contract generation for a booking
 * (`POST /v1/admin/bookings/:id/generate-contract`):
 *
 *   - `preview` runs the server-side preview branch (`{ preview: true }`),
 *     which renders the same template + variable build the customer would
 *     see at checkout and returns the HTML without persisting anything.
 *   - `generate` creates the legal contract row + persists the PDF
 *     attachment; pass `{ force: true }` to regenerate an existing PDF.
 *
 * The created contract lives in the legal module — callers that display
 * contract lists should invalidate `legalQueryKeys.contracts()` (from
 * `@voyant-travel/legal-react`) on `generate` success; this package cannot do
 * that without taking a dependency on the legal client.
 */
export function useBookingContractGenerationMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()

  const preview = useMutation({
    mutationFn: async () => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/generate-contract`,
        bookingContractPreviewResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({ preview: true }) },
      )
      return data
    },
  })

  const generate = useMutation({
    mutationFn: async (input: GenerateBookingContractInput = {}) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/generate-contract`,
        bookingGenerateContractResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input.force ? { force: true } : {}) },
      )
      return data
    },
  })

  return { preview, generate }
}
