"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingTravelerRecordSchema, bookingTravelerTravelDetailsSchema } from "../schemas.js"

const travelerWithTravelDetailsResponseSchema = z.object({
  data: z.object({
    traveler: bookingTravelerRecordSchema,
    travelDetails: bookingTravelerTravelDetailsSchema.nullable(),
  }),
})

export interface CreateTravelerWithTravelDetailsInput {
  personId?: string | null
  participantType?: string
  travelerCategory?: string | null
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  preferredLanguage?: string | null
  specialRequests?: string | null
  isPrimary?: boolean
  notes?: string | null
  // Encrypted travel-details (plaintext on the wire; the route encrypts).
  nationality?: string | null
  documentType?: "passport" | "id_card" | "driver_license" | "visa" | "other" | null
  documentNumber?: string | null
  documentExpiry?: string | null
  documentIssuingCountry?: string | null
  documentIssuingAuthority?: string | null
  documentPersonDocumentId?: string | null
  dateOfBirth?: string | null
  dietaryRequirements?: string | null
  accessibilityNeeds?: string | null
  isLeadTraveler?: boolean | null
  sharingGroupId?: string | null
  roomTypeId?: string | null
  bedPreference?: "single" | "twin" | "double" | "no-preference" | null
  allocations?: Record<string, string>
}

export type UpdateTravelerWithTravelDetailsInput = Partial<CreateTravelerWithTravelDetailsInput>

/**
 * Combined create/update for a booking traveler + their encrypted
 * travel-details snapshot. When `personId` is provided on create
 * AND the operator starter has wired `resolveTravelSnapshot`, the
 * route auto-snapshots dietary / accessibility / primary passport
 * from `crm.people`. Explicit input always wins.
 */
export function useTravelerWithTravelDetailsMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.booking(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.travelers(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.actionLedger(bookingId) })
  }

  const create = useMutation({
    mutationFn: async (input: CreateTravelerWithTravelDetailsInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/travelers/with-travel-details`,
        travelerWithTravelDetailsResponseSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({
      travelerId,
      input,
    }: {
      travelerId: string
      input: UpdateTravelerWithTravelDetailsInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/travelers/${travelerId}/with-travel-details`,
        travelerWithTravelDetailsResponseSchema,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { create, update }
}
