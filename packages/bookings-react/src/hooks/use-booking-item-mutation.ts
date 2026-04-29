"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertBookingItemSchema,
  updateBookingItemSchema,
} from "@voyantjs/bookings/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingItemsResponse, bookingSingleResponse, successEnvelope } from "../schemas.js"

// Derived from the server schema so this can't drift out of sync. `z.input`
// (not `z.infer`/`z.output`) gives the pre-parse type, where fields with
// `.default(...)` are optional — the right shape for a client-side create
// payload.
export type CreateBookingItemInput = z.input<typeof insertBookingItemSchema>
export type UpdateBookingItemInput = z.input<typeof updateBookingItemSchema>

export function useBookingItemMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateBookingItemInput) => {
      const { data } = await fetchWithValidation(
        `/v1/bookings/${bookingId}/items`,
        bookingSingleResponse.extend({
          data: bookingItemsResponse.shape.data.element,
        }),
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.items(bookingId) })
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBookingItemInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/bookings/${bookingId}/items/${id}`,
        bookingSingleResponse.extend({
          data: bookingItemsResponse.shape.data.element,
        }),
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.items(bookingId) })
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    },
  })

  const remove = useMutation({
    mutationFn: async (itemId: string) =>
      fetchWithValidation(
        `/v1/bookings/${bookingId}/items/${itemId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.items(bookingId) })
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    },
  })

  return { create, update, remove }
}
