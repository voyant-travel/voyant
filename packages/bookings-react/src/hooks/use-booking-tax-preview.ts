"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingsContext } from "../provider.js"
import type { TaxPreviewFilters } from "../query-keys.js"
import { getTaxPreviewQueryOptions } from "../query-options.js"

export interface UseBookingTaxPreviewOptions extends TaxPreviewFilters {
  enabled?: boolean
}

/**
 * Real-time tax breakdown for the in-progress booking the operator is
 * configuring. The hook fires whenever `subtotalCents` changes so the
 * preview card reflects the customer-facing total as the operator
 * iterates on travelers / options / rooms.
 *
 * Wired to the template-level `/v1/admin/bookings/tax-preview` route —
 * resolved tax matches what will land on `booking_item_tax_lines` at
 * booking finalize.
 */
export function useBookingTaxPreview({ enabled = true, ...filters }: UseBookingTaxPreviewOptions) {
  const client = useVoyantBookingsContext()
  return useQuery({
    ...getTaxPreviewQueryOptions(client, filters),
    enabled: enabled && Boolean(filters.productId) && filters.subtotalCents > 0,
  })
}
