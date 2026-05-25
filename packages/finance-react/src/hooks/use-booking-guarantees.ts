"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { getBookingGuaranteesQueryOptions } from "../query-options.js"
import { bookingGuaranteeRecordSchema, successEnvelope } from "../schemas.js"

export interface UseBookingGuaranteesOptions {
  enabled?: boolean
}

export function useBookingGuarantees(
  bookingId: string | null | undefined,
  options: UseBookingGuaranteesOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getBookingGuaranteesQueryOptions({ baseUrl, fetcher }, bookingId),
    enabled: enabled && Boolean(bookingId),
  })
}

export interface CreateBookingGuaranteeInput {
  guaranteeType: string
  status?: string
  currency?: string | null
  amountCents?: number | null
  provider?: string | null
  referenceNumber?: string | null
  guaranteedAt?: string | null
  expiresAt?: string | null
  notes?: string | null
  bookingPaymentScheduleId?: string | null
  bookingItemId?: string | null
}

export type UpdateBookingGuaranteeInput = Partial<CreateBookingGuaranteeInput>

const guaranteeSingleResponse = bookingGuaranteeRecordSchema.transform((data) => ({
  data,
}))

export function useBookingGuaranteeMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: financeQueryKeys.bookingGuarantees(bookingId),
    })
  }

  const create = useMutation({
    mutationFn: async (input: CreateBookingGuaranteeInput) => {
      const res = await fetchWithValidation(
        `/v1/admin/finance/bookings/${bookingId}/guarantees`,
        guaranteeSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return res.data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBookingGuaranteeInput }) => {
      const res = await fetchWithValidation(
        `/v1/admin/finance/bookings/${bookingId}/guarantees/${id}`,
        guaranteeSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return res.data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (guaranteeId: string) =>
      fetchWithValidation(
        `/v1/admin/finance/bookings/${bookingId}/guarantees/${guaranteeId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
