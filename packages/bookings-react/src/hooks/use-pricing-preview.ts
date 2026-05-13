"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingsContext } from "../provider.js"
import type { PricingPreviewFilters } from "../query-keys.js"
import { getPricingPreviewQueryOptions } from "../query-options.js"

export interface UsePricingPreviewOptions extends PricingPreviewFilters {
  enabled?: boolean
}

/**
 * Catalog-resolved pricing snapshot for a product + option (+ optional
 * catalog). Consumers match the returned `unitPrices` / `tiers` against their
 * traveler/unit selection to render a breakdown. The snapshot is the same
 * data the storefront session uses, so operator-side numbers stay in sync
 * with customer-facing ones.
 */
export function usePricingPreview({ enabled = true, ...filters }: UsePricingPreviewOptions) {
  const client = useVoyantBookingsContext()
  return useQuery({
    ...getPricingPreviewQueryOptions(client, filters),
    enabled: enabled && Boolean(filters.productId),
  })
}
