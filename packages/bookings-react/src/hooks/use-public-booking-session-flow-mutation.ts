"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  PublicBookingSessionRepriceInput,
  PublicUpsertBookingSessionStateInput,
} from "@voyant-travel/bookings/validation"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import {
  publicBookingSessionRepriceResponse,
  publicBookingSessionStateResponse,
} from "../schemas.js"

export function usePublicBookingSessionFlowMutation(sessionId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const updateState = useMutation({
    mutationFn: async (input: PublicUpsertBookingSessionStateInput) => {
      const { data } = await fetchWithValidation(
        `/v1/public/bookings/sessions/${sessionId}/state`,
        publicBookingSessionStateResponse,
        { baseUrl, fetcher },
        { method: "PUT", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(bookingsQueryKeys.publicSessionState(sessionId), { data })
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.publicSession(sessionId) })
    },
  })

  const reprice = useMutation({
    mutationFn: async (input: PublicBookingSessionRepriceInput) => {
      const { data } = await fetchWithValidation(
        `/v1/public/bookings/sessions/${sessionId}/reprice`,
        publicBookingSessionRepriceResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      if (data.session) {
        queryClient.setQueryData(bookingsQueryKeys.publicSession(sessionId), { data: data.session })
        void queryClient.invalidateQueries({
          queryKey: bookingsQueryKeys.publicSessionState(sessionId),
        })
      }
    },
  })

  return { updateState, reprice }
}
