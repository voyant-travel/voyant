"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { getBookingItemTravelersQueryOptions } from "../query-options.js"
import { bookingItemTravelersResponse, bookingSingleResponse, successEnvelope } from "../schemas.js"

export interface UseBookingItemTravelersOptions {
  enabled?: boolean
}

export function useBookingItemTravelers(
  bookingId: string | null | undefined,
  itemId: string | null | undefined,
  options: UseBookingItemTravelersOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const { enabled = true } = options

  return useQuery({
    ...getBookingItemTravelersQueryOptions({ baseUrl, fetcher }, bookingId, itemId),
    enabled: enabled && Boolean(bookingId) && Boolean(itemId),
  })
}

export interface AddItemTravelerInput {
  travelerId: string
  role?: string
  isPrimary?: boolean
}

export function useBookingItemTravelerMutation(bookingId: string, itemId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const add = useMutation({
    mutationFn: async (input: AddItemTravelerInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/items/${itemId}/travelers`,
        bookingSingleResponse.extend({
          data: bookingItemTravelersResponse.shape.data.element,
        }),
        { baseUrl, fetcher },
        {
          method: "POST",
          body: JSON.stringify({
            travelerId: input.travelerId,
            role: input.role,
            isPrimary: input.isPrimary,
          }),
        },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: bookingsQueryKeys.itemTravelers(bookingId, itemId),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async (linkId: string) =>
      fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/items/${itemId}/travelers/${linkId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: bookingsQueryKeys.itemTravelers(bookingId, itemId),
      })
    },
  })

  return { add, remove }
}
