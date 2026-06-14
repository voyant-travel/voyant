import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantChartersContext } from "../provider.js"
import { chartersQueryKeys } from "../query-keys.js"
import { type BookingCharterDetailRecord, generateMybaContractResponse } from "../schemas.js"

export interface GenerateMybaContractInput {
  /** Override the template id snapshotted at booking time. */
  templateIdOverride?: string | null
  /** Locale for the contract; defaults server-side to "en". */
  language?: string
  /** Extra Liquid variables passed to the renderer. Merged on top of defaults. */
  extraVariables?: Record<string, unknown>
  /** Custom title; default is `MYBA charter agreement — <voyage name>`. */
  title?: string
}

export interface GenerateMybaContractResult {
  contractId: string
  charterDetails: BookingCharterDetailRecord
}

/**
 * Generate (or fetch existing) MYBA contract for a whole-yacht charter
 * booking. Idempotent — if `mybaContractId` is already set on the booking,
 * the server returns the existing contract id without re-generating.
 *
 * Requires the template to wire `chartersContractsService` into Hono
 * context at app boot, otherwise the route returns 501.
 */
export function useGenerateMybaContract() {
  const { baseUrl, fetcher } = useVoyantChartersContext()
  const client = { baseUrl, fetcher }
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      bookingId,
      input,
    }: {
      bookingId: string
      input?: GenerateMybaContractInput
    }): Promise<GenerateMybaContractResult> => {
      const result = await fetchWithValidation(
        `/v1/admin/charters/bookings/${encodeURIComponent(bookingId)}/myba`,
        generateMybaContractResponse,
        client,
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return result.data
    },
    onSuccess: () => {
      // Bookings own the canonical detail; templates that mount @voyant-travel/bookings-react
      // will see the contract id propagate via their own invalidation. Charters'
      // own caches don't include per-booking detail so nothing to invalidate here
      // beyond a generic charters wipe (kept minimal to avoid waste).
      void queryClient.invalidateQueries({ queryKey: chartersQueryKeys.all })
    },
  })
}
