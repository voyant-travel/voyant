"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingNoteRecordSchema } from "../schemas.js"

export interface CreateBookingNoteInput {
  content: string
}

export interface UpdateBookingNoteInput {
  id: string
  content: string
}

const bookingNoteSingleResponse = z.object({
  data: bookingNoteRecordSchema,
})

const successResponse = z.object({ success: z.boolean() })

export function useBookingNoteMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.booking(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.notes(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.actionLedger(bookingId) })
  }

  const create = useMutation({
    mutationFn: async (input: CreateBookingNoteInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/notes`,
        bookingNoteSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (input: UpdateBookingNoteInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/notes/${input.id}`,
        bookingNoteSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify({ content: input.content }) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (noteId: string) => {
      return fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/notes/${noteId}`,
        successResponse,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: invalidate,
  })

  // Back-compat: older callers invoke `mutation.mutateAsync({ content })` directly
  // on the returned object (treating the hook as a single create mutation).
  // Expose the create mutation's surface at the top level, plus named `create`,
  // `update`, and `remove` for new callers.
  return Object.assign(create, { create, update, remove })
}
