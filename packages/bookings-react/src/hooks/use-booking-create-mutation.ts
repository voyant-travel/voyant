"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { type BookingStatus, bookingRecordSchema } from "../schemas.js"

export interface BookingCreateTravelerInput {
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
   * option_unit_id of the room the traveler is assigned to. Round-trips
   * from the UI TravelersSection even though the server currently doesn't
   * persist it — the follow-up that adds a traveler→room link will pick it
   * up without the client changing.
   */
  roomUnitId?: string | null
  isPrimary?: boolean | null
  notes?: string | null
}

export interface BookingCreatePaymentScheduleInput {
  scheduleType?: "deposit" | "installment" | "balance" | "hold" | "other"
  status?: "pending" | "due" | "paid" | "waived" | "cancelled" | "expired"
  dueDate: string
  currency: string
  amountCents: number
  notes?: string | null
}

export interface BookingCreateDocumentGenerationInput {
  contractDocument?: boolean
  invoiceDocument?: boolean
}

export interface BookingCreateItemLineInput {
  optionId?: string | null
  optionUnitId: string
  quantity: number
  title?: string | null
  description?: string | null
  unitSellAmountCents?: number | null
  totalSellAmountCents?: number | null
}

export interface BookingCreateExtraLineInput {
  productExtraId: string
  optionExtraConfigId?: string | null
  name: string
  description?: string | null
  pricingMode?: string | null
  pricedPerPerson?: boolean | null
  quantity: number
  sellCurrency: string
  unitSellAmountCents?: number | null
  totalSellAmountCents?: number | null
}

export interface BookingCreateVoucherRedemptionInput {
  voucherId: string
  amountCents: number
}

export type BookingCreateGroupMembershipInput =
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

export interface BookingCreateInput {
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

  itemLines?: BookingCreateItemLineInput[]
  extraLines?: BookingCreateExtraLineInput[]
  travelers?: BookingCreateTravelerInput[]
  paymentSchedules?: BookingCreatePaymentScheduleInput[]
  voucherRedemption?: BookingCreateVoucherRedemptionInput
  groupMembership?: BookingCreateGroupMembershipInput
  documentGeneration?: BookingCreateDocumentGenerationInput
  /**
   * Initial booking status — defaults to `draft` on the server. Set
   * this to skip the legacy create-then-flip dance: the server commits
   * the booking already in `confirmed` / `awaiting_payment` in the
   * same transaction and fires `booking.confirmed` post-commit when
   * applicable.
   */
  initialStatus?: BookingStatus
  /**
   * Only honored when `initialStatus === "confirmed"`. When true, the
   * post-commit `booking.confirmed` event carries
   * `suppressNotifications: true` so downstream subscribers skip
   * customer-facing emails / document bundles.
   */
  suppressNotifications?: boolean
  /**
   * Billing-contact snapshot. Caller (typically the create dialog)
   * reads the linked CRM person/org and supplies what it knows so the
   * booking detail page renders the right payer even if those CRM
   * records change later.
   */
  contactFirstName?: string | null
  contactLastName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactPreferredLanguage?: string | null
  contactCountry?: string | null
  contactRegion?: string | null
  contactCity?: string | null
  contactAddressLine1?: string | null
  contactPostalCode?: string | null
}

// Response envelope: route returns `{ data: { booking, travelers, paymentSchedules, voucherRedemption, groupMembership } }`.
// We validate only the booking shape (which drives cache invalidation) and
// pass the rest through as-is so the surface can evolve without breaking
// clients. Callers who want typed assertions on the extras can narrow on the
// result.
const bookingCreateResultSchema = z.object({
  booking: bookingRecordSchema,
  travelers: z.array(z.unknown()).optional(),
  paymentSchedules: z.array(z.unknown()).optional(),
  voucherRedemption: z.unknown().nullable().optional(),
  groupMembership: z.unknown().nullable().optional(),
  invoice: z.unknown().nullable().optional(),
  invoiceDocument: z.unknown().optional(),
  payments: z.array(z.unknown()).optional(),
})

const bookingCreateResponseSchema = z.object({ data: bookingCreateResultSchema })

export type BookingCreateResult = z.infer<typeof bookingCreateResultSchema>

/**
 * Atomic booking-create: calls `POST /v1/bookings/create` which wraps
 * convert-from-product + travelers + payment schedules + voucher redemption
 * + group membership in one transaction. Prefer this over chaining the
 * separate create mutations (convert, group, traveler) from a single submit
 * handler — a mid-chain failure there leaves orphan state.
 */
export function useBookingCreateMutation() {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: BookingCreateInput) => {
      const { data } = await fetchWithValidation(
        "/v1/bookings/create",
        bookingCreateResponseSchema,
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
