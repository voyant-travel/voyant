"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingRecordSchema } from "../schemas.js"
import type { BookingCreateInput } from "./use-booking-create-mutation.js"

/**
 * Sub-booking payload for dual-create. Same shape as createBooking input
 * minus `groupMembership` — the dual endpoint manages the group itself.
 */
export type DualCreateSubBookingInput = Omit<BookingCreateInput, "groupMembership">

export interface DualCreateGroupInput {
  kind?: "shared_room" | "other"
  label?: string | null
  /**
   * option_unit the shared group occupies. The dual flow lives-or-dies on
   * matching this across both bookings — when set, both sub-bookings should
   * target the same optionUnitId in their travelers/allocations.
   */
  optionUnitId?: string | null
}

export interface DualCreateBookingInput {
  primary: DualCreateSubBookingInput
  secondary: DualCreateSubBookingInput
  group?: DualCreateGroupInput
}

const dualCreateResultSchema = z.object({
  primary: z.object({
    booking: bookingRecordSchema,
    travelers: z.array(z.unknown()).optional(),
    paymentSchedules: z.array(z.unknown()).optional(),
    travelCreditRedemption: z.unknown().nullable().optional(),
  }),
  secondary: z.object({
    booking: bookingRecordSchema,
    travelers: z.array(z.unknown()).optional(),
    paymentSchedules: z.array(z.unknown()).optional(),
    travelCreditRedemption: z.unknown().nullable().optional(),
  }),
  group: z.unknown(),
  primaryMember: z.unknown(),
  secondaryMember: z.unknown(),
})

const dualCreateResponseSchema = z.object({ data: dualCreateResultSchema })

export type DualCreateBookingResult = z.infer<typeof dualCreateResultSchema>

/**
 * Atomic dual-booking (partaj) create: calls `POST /v1/admin/bookings/dual-create`
 * which wraps two createBooking calls + one booking_group in a single
 * transaction. Use this over calling useBookingCreateMutation twice
 * from a submit handler — a failure on the second call there would leave
 * the first booking orphaned.
 */
export function useBookingDualCreateMutation() {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DualCreateBookingInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/bookings/dual-create",
        dualCreateResponseSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
    },
  })
}
