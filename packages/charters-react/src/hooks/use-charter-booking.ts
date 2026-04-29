import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantChartersContext } from "../provider.js"
import { chartersQueryKeys } from "../query-keys.js"
import { createBookingResponse } from "../schemas.js"

// ---------- shared input shapes (mirror server chartersBookingService) ----------

export interface CharterGuestInput {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  isPrimary?: boolean
  notes?: string | null
}

export interface CharterContactInput {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  language?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  address?: string | null
  postalCode?: string | null
}

export interface CreatePerSuiteBookingInput {
  voyageId: string
  suiteId: string
  /** ISO-4217 currency code. The server resolves it against the voyage/suite price map. */
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContactInput
  guests: CharterGuestInput[]
  notes?: string | null
}

export interface CreateWholeYachtBookingInput {
  voyageId: string
  /** ISO-4217 currency code. The server resolves it against the voyage/suite price map. */
  currency: string
  personId?: string | null
  organizationId?: string | null
  contact: CharterContactInput
  guests?: CharterGuestInput[]
  notes?: string | null
}

export type CreateCharterBookingResult = z.infer<typeof createBookingResponse>["data"]

/**
 * Booking mutation set. The route layer detects local vs external voyages
 * from the unified key and dispatches accordingly — this hook doesn't
 * branch on provenance.
 */
export function useCharterBookingMutation() {
  const { baseUrl, fetcher } = useVoyantChartersContext()
  const client = { baseUrl, fetcher }
  const queryClient = useQueryClient()

  const createPerSuite = useMutation({
    mutationFn: async ({
      voyageKey,
      input,
    }: {
      voyageKey: string
      input: CreatePerSuiteBookingInput
    }): Promise<CreateCharterBookingResult> => {
      const result = await fetchWithValidation(
        `/v1/admin/charters/voyages/${encodeURIComponent(voyageKey)}/bookings/per-suite`,
        createBookingResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return result.data
    },
    onSuccess: () => {
      // Suite availability may have changed; invalidate voyage detail to
      // pull fresh suites.
      void queryClient.invalidateQueries({ queryKey: chartersQueryKeys.voyages() })
      void queryClient.invalidateQueries({ queryKey: chartersQueryKeys.products() })
    },
  })

  const createWholeYacht = useMutation({
    mutationFn: async ({
      voyageKey,
      input,
    }: {
      voyageKey: string
      input: CreateWholeYachtBookingInput
    }): Promise<CreateCharterBookingResult> => {
      const result = await fetchWithValidation(
        `/v1/admin/charters/voyages/${encodeURIComponent(voyageKey)}/bookings/whole-yacht`,
        createBookingResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return result.data
    },
    onSuccess: () => {
      // Whole-yacht booking takes the entire voyage out of inventory.
      void queryClient.invalidateQueries({ queryKey: chartersQueryKeys.voyages() })
      void queryClient.invalidateQueries({ queryKey: chartersQueryKeys.products() })
    },
  })

  return { createPerSuite, createWholeYacht }
}
