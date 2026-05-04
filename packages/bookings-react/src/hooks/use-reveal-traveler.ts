"use client"

import { useQuery } from "@tanstack/react-query"

import { useVoyantBookingsContext } from "../provider.js"
import { getTravelerRevealQueryOptions } from "../query-options.js"

export interface UseRevealTravelerOptions {
  /**
   * When false, the reveal request is skipped — keeps the eye-button
   * default-off behaviour. Toggle to true when the user clicks reveal.
   */
  enabled: boolean
}

/**
 * Lazily fetch an unmasked traveler row. Authorization is server-side;
 * the response is the full traveler with email/phone/firstName/lastName
 * in the clear. Every reveal hits the audit log on the backend, so the
 * `staleTime: 0` in the query options is intentional — re-mounting the
 * row should re-log.
 */
export function useRevealTraveler(
  bookingId: string | null | undefined,
  travelerId: string | null | undefined,
  options: UseRevealTravelerOptions,
) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  return useQuery({
    ...getTravelerRevealQueryOptions({ baseUrl, fetcher }, bookingId, travelerId),
    enabled: options.enabled && Boolean(bookingId) && Boolean(travelerId),
  })
}
