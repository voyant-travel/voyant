import { z } from "zod"

/**
 * Profitability read-model contracts (RFC §8). The read model is computed, not
 * stored: actual cost from `supplier_cost_allocations`, revenue from issued
 * customer invoices (AR), planned cost from `booking_items`. Rows are emitted
 * **per currency** — amounts are never summed across currencies (no FX in v1).
 */

export const departureProfitabilityQuerySchema = z.object({
  /** Filter by departure date (derived from booking items), inclusive. */
  from: z.string().optional(),
  to: z.string().optional(),
  productId: z.string().optional(),
  departureId: z.string().optional(),
  currency: z.string().optional(),
})

export const productProfitabilityQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  currency: z.string().optional(),
})

export type DepartureProfitabilityQuery = z.infer<typeof departureProfitabilityQuerySchema>
export type ProductProfitabilityQuery = z.infer<typeof productProfitabilityQuerySchema>
