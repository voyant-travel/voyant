"use client"

import { useMutation } from "@tanstack/react-query"
import {
  type BookingDraftV1,
  type BookingPaymentIntent,
  type BookResponseV1,
  bookResponseV1,
} from "@voyantjs/catalog/booking-engine"

import { type BookingJourneyApiOptions, useBookingJourneyApi } from "./use-booking-journey-api.js"

export interface UseBookingCommitOptions extends BookingJourneyApiOptions {
  /** Draft id — when set, the engine resolves the quote off the draft
   *  and the draft is marked consumed on success. */
  draftId?: string
  /** Optional callback fired on successful commit. Templates use this
   *  for post-commit navigation (operator → /orders, storefront →
   *  /confirmation). */
  onCommitted?: (result: BookResponseV1) => void
}

export interface CommitInput {
  /** Either-or: pass the draft for context-aware commit, or just a
   *  quoteId when the journey hasn't materialized a draft yet. */
  draft?: BookingDraftV1
  quoteId?: string
  party?: Record<string, unknown>
  paymentIntent?: BookingPaymentIntent
  /** Idempotency key — same key in 24h returns the existing booking. */
  idempotencyKey?: string
}

/**
 * Final book mutation — calls `POST /catalog/book` with the chosen
 * quoteId or draftId. The wizard's Review step calls this when the
 * user clicks Confirm. Per booking-journey-architecture §8 + §10
 * Phase B.
 */
export function useBookingCommit(options: UseBookingCommitOptions = {}) {
  const api = useBookingJourneyApi(options)

  return useMutation<BookResponseV1, Error, CommitInput>({
    mutationFn: async (input) => {
      const body: Record<string, unknown> = {
        quoteId: input.quoteId ?? input.draft?.quoteId,
        draftId: options.draftId,
        party: input.party,
        paymentIntent: input.paymentIntent,
        idempotencyKey: input.idempotencyKey,
      }
      if (input.draft) {
        body.parameters = { draft: input.draft }
      }
      return api.request<BookResponseV1>("POST", "/book", bookResponseV1, body)
    },
    onSuccess(result) {
      options.onCommitted?.(result)
    },
  })
}
