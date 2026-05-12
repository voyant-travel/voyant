"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingRecordSchema } from "../schemas.js"

export interface QuickCreateTravelerInput {
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  personId?: string | null
  participantType?: "traveler" | "occupant" | "other"
  travelerCategory?: "adult" | "child" | "infant" | "senior" | "other" | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  /**
   * option_unit_id of the room the passenger is assigned to. Round-trips
   * from the UI PassengersSection even though the server currently doesn't
   * persist it — the follow-up that adds a traveler→room link will pick it
   * up without the client changing.
   */
  roomUnitId?: string | null
  isPrimary?: boolean | null
  notes?: string | null
}

export interface QuickCreatePaymentScheduleInput {
  scheduleType?: "deposit" | "installment" | "balance" | "hold" | "other"
  status?: "pending" | "due" | "paid" | "waived" | "cancelled" | "expired"
  dueDate: string
  currency: string
  amountCents: number
  notes?: string | null
}

export interface QuickCreateVoucherRedemptionInput {
  voucherId: string
  amountCents: number
}

export type QuickCreateGroupMembershipInput =
  | {
      action: "join"
      groupId: string
      role?: "primary" | "shared"
    }
  | {
      action: "create"
      kind?: "shared_room" | "other"
      label?: string | null
      optionUnitId?: string | null
      makeBookingPrimary?: boolean
    }

export interface QuickCreateBookingInput {
  productId: string
  optionId?: string | null
  slotId?: string | null
  bookingNumber: string
  personId?: string | null
  organizationId?: string | null
  internalNotes?: string | null
  catalogSellAmountCents?: number | null
  confirmedSellAmountCents?: number | null
  priceOverrideReason?: string | null

  travelers?: QuickCreateTravelerInput[]
  paymentSchedules?: QuickCreatePaymentScheduleInput[]
  voucherRedemption?: QuickCreateVoucherRedemptionInput
  groupMembership?: QuickCreateGroupMembershipInput
}

// Response envelope: route returns `{ data: { booking, travelers, paymentSchedules, voucherRedemption, groupMembership } }`.
// We validate only the booking shape (which drives cache invalidation) and
// pass the rest through as-is so the surface can evolve without breaking
// clients. Callers who want typed assertions on the extras can narrow on the
// result.
const quickCreateResultSchema = z.object({
  booking: bookingRecordSchema,
  travelers: z.array(z.unknown()).optional(),
  paymentSchedules: z.array(z.unknown()).optional(),
  voucherRedemption: z.unknown().nullable().optional(),
  groupMembership: z.unknown().nullable().optional(),
})

const quickCreateResponseSchema = z.object({ data: quickCreateResultSchema })

export type QuickCreateBookingResult = z.infer<typeof quickCreateResultSchema>

/**
 * Atomic booking-create: calls `POST /v1/bookings/quick-create` which wraps
 * convert-from-product + travelers + payment schedules + voucher redemption
 * + group membership in one transaction. Prefer this over chaining the
 * separate create mutations (convert, group, traveler) from a single submit
 * handler — a mid-chain failure there leaves orphan state.
 */
export function useBookingQuickCreateMutation() {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: QuickCreateBookingInput) => {
      const { data } = await fetchWithValidation(
        "/v1/bookings/quick-create",
        quickCreateResponseSchema,
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
