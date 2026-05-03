"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  type BookingDraftV1,
  type QuoteResponseV1,
  quoteResponseV1,
} from "@voyantjs/catalog/booking-engine"
import { useEffect, useMemo, useRef, useState } from "react"

import { type BookingJourneyApiOptions, useBookingJourneyApi } from "./use-booking-journey-api.js"

export interface UseBookingQuoteOptions extends BookingJourneyApiOptions {
  draft: BookingDraftV1 | null
  /** Locale / audience / market scope — defaults sensible per surface. */
  scope?: {
    locale?: string
    audience?: "staff" | "customer" | "partner" | "supplier"
    market?: string
    currency?: string
  }
  /** Debounce window in ms — default 250 (per booking-journey-architecture §5). */
  debounceMs?: number
  /** Disable auto-refetch — caller drives via `mutate()`. */
  enabled?: boolean
}

/**
 * Live-quote a draft. Re-fetches on every meaningful draft change,
 * with a 250ms debounce. Per booking-journey-architecture §5.
 *
 * Returns:
 *   - `data`         — the latest QuoteResponseV1 (or `null` while loading)
 *   - `isQuoting`    — true while a fetch is in flight
 *   - `requote`      — manual trigger (e.g. for "refresh price" buttons)
 */
export function useBookingQuote(options: UseBookingQuoteOptions) {
  const api = useBookingJourneyApi(options)
  const debounceMs = options.debounceMs ?? 250
  const enabled = options.enabled !== false && !!options.draft

  // Stabilize the draft snapshot via a serialized signature so
  // TanStack Query's queryKey only changes when meaningful fields
  // change.
  const signature = options.draft ? signDraft(options.draft) : null
  const [debouncedSignature, setDebouncedSignature] = useState(signature)
  const draftRef = useRef(options.draft)
  draftRef.current = options.draft

  useEffect(() => {
    if (!signature) {
      setDebouncedSignature(null)
      return
    }
    const t = setTimeout(() => setDebouncedSignature(signature), debounceMs)
    return () => clearTimeout(t)
  }, [signature, debounceMs])

  const query = useQuery<QuoteResponseV1 | null>({
    queryKey: ["booking-quote", options.surface ?? "admin", debouncedSignature],
    queryFn: async () => {
      const draft = draftRef.current
      if (!draft) return null
      return runQuote(api, draft, options.scope)
    },
    enabled,
  })

  const requote = useMutation<QuoteResponseV1, Error, void>({
    mutationFn: async () => {
      const draft = draftRef.current
      if (!draft) throw new Error("no draft to requote")
      return runQuote(api, draft, options.scope)
    },
  })

  return useMemo(
    () => ({
      data: query.data ?? null,
      isQuoting: query.isFetching || requote.isPending,
      error: query.error ?? requote.error ?? null,
      requote: () => requote.mutateAsync(),
      refetch: query.refetch,
    }),
    [query.data, query.isFetching, query.error, query.refetch, requote],
  )
}

async function runQuote(
  api: ReturnType<typeof useBookingJourneyApi>,
  draft: BookingDraftV1,
  scope: UseBookingQuoteOptions["scope"],
): Promise<QuoteResponseV1> {
  return api.request<QuoteResponseV1>("POST", "/quote", quoteResponseV1, {
    entityModule: draft.entity.module,
    entityId: draft.entity.id,
    sourceKind: draft.entity.sourceKind,
    sourceConnectionId: draft.entity.sourceConnectionId,
    sourceRef: draft.entity.sourceRef,
    scope: {
      locale: scope?.locale ?? "en-GB",
      audience: scope?.audience ?? defaultAudience(api.apiBase),
      market: scope?.market ?? "default",
      currency: scope?.currency,
    },
    draft,
  })
}

function defaultAudience(apiBase: string): "staff" | "customer" | "partner" | "supplier" {
  return apiBase.includes("/v1/public/") ? "customer" : "staff"
}

/**
 * Pricing-significant signature — only fields that affect price /
 * shape go in. Avoids re-quoting on cosmetic edits like phone
 * formatting or notes.
 */
function signDraft(draft: BookingDraftV1): string {
  return JSON.stringify({
    entity: draft.entity,
    pax: draft.configure?.pax,
    departureSlotId: draft.configure?.departureSlotId,
    departureDate: draft.configure?.departureDate,
    departureTime: draft.configure?.departureTime,
    variantId: draft.configure?.variantId,
    cabinCategoryId: draft.configure?.cabinCategoryId,
    cabinNumberId: draft.configure?.cabinNumberId,
    dateRange: draft.configure?.dateRange,
    travelerCount: draft.travelers?.length,
    travelerBands: draft.travelers?.map((t) => t.band),
    accommodation: draft.accommodation,
    addons: draft.addons,
    voucher: draft.voucher,
    buyerType: draft.billing?.buyerType,
    billingCountry: draft.billing?.address?.country,
  })
}
