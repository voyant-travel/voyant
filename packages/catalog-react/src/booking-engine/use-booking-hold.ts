"use client"

import { useMutation } from "@tanstack/react-query"
import { z } from "zod"

import { type BookingJourneyApiOptions, useBookingJourneyApi } from "./use-booking-journey-api.js"

const placeHoldResponseSchema = z.object({
  holdToken: z.string(),
  expiresAt: z.string().datetime(),
})

export interface PlaceHoldInput {
  entityModule: string
  entityId: string
  draftId: string
  ttlMs?: number
  parameters?: Record<string, unknown>
}

export interface ReleaseHoldInput {
  entityModule: string
  holdToken: string
}

/**
 * Place an inventory soft-hold against the engine. Per
 * booking-journey-architecture §5.7 — the journey calls this once
 * the user has picked a slot + pax in the Configure step so
 * concurrent shoppers can't oversell capacity.
 *
 * The bound mutation also exposes a `release` helper for the cancel
 * path; the reaper covers expiry without explicit calls.
 */
export function useBookingHold(options: BookingJourneyApiOptions = {}): {
  place: (input: PlaceHoldInput) => Promise<{ holdToken: string; expiresAt: string }>
  release: (input: ReleaseHoldInput) => Promise<void>
  isPending: boolean
} {
  const api = useBookingJourneyApi(options)

  const place = useMutation({
    mutationFn: async (input: PlaceHoldInput) => {
      return api.request("POST", "/holds/place", placeHoldResponseSchema, {
        entityModule: input.entityModule,
        entityId: input.entityId,
        draftId: input.draftId,
        ttlMs: input.ttlMs,
        parameters: input.parameters,
      })
    },
  })

  const release = useMutation({
    mutationFn: async (input: ReleaseHoldInput) => {
      await api.request("POST", "/holds/release", z.undefined(), {
        entityModule: input.entityModule,
        holdToken: input.holdToken,
      })
    },
  })

  return {
    place: (input) => place.mutateAsync(input),
    release: (input) => release.mutateAsync(input),
    isPending: place.isPending || release.isPending,
  }
}
