"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingSingleResponse, successEnvelope } from "../schemas.js"

export interface CreateBookingInput {
  bookingNumber: string
  status?:
    | "draft"
    | "on_hold"
    | "awaiting_payment"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "expired"
    | "cancelled"
  personId?: string | null
  organizationId?: string | null
  sellCurrency: string
  sellAmountCents?: number | null
  costAmountCents?: number | null
  startDate?: string | null
  endDate?: string | null
  pax?: number | null
  internalNotes?: string | null
}

export type UpdateBookingInput = Partial<CreateBookingInput>

export function useBookingMutation() {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const { data } = await fetchWithValidation(
        "/v1/bookings",
        bookingSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBookingInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/bookings/${id}`,
        bookingSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
      queryClient.setQueryData(bookingsQueryKeys.booking(data.id), { data })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/bookings/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
      queryClient.removeQueries({ queryKey: bookingsQueryKeys.booking(id) })
    },
  })

  return { create, update, remove }
}
