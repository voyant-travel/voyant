"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { getBookingPaymentSchedulesQueryOptions } from "../query-options.js"
import { bookingPaymentScheduleRecordSchema, singleEnvelope, successEnvelope } from "../schemas.js"

export interface UseBookingPaymentSchedulesOptions {
  enabled?: boolean
}

export function useBookingPaymentSchedules(
  bookingId: string | null | undefined,
  options: UseBookingPaymentSchedulesOptions = {},
) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const { enabled = true } = options

  return useQuery({
    ...getBookingPaymentSchedulesQueryOptions({ baseUrl, fetcher }, bookingId),
    enabled: enabled && Boolean(bookingId),
  })
}

export interface CreateBookingPaymentScheduleInput {
  scheduleType?: string
  status?: string
  dueDate: string
  currency: string
  amountCents: number
  bookingItemId?: string | null
  notes?: string | null
}

export type UpdateBookingPaymentScheduleInput = Partial<CreateBookingPaymentScheduleInput>

// The server already returns `{ data: row }`, so wrap the record in
// singleEnvelope. The previous `.transform()` re-wrapped the OUTER
// envelope, leaving every record field undefined to the parser.
const scheduleSingleResponse = singleEnvelope(bookingPaymentScheduleRecordSchema)

export function useBookingPaymentScheduleMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: financeQueryKeys.bookingPaymentSchedules(bookingId),
    })
  }

  const create = useMutation({
    mutationFn: async (input: CreateBookingPaymentScheduleInput) => {
      const res = await fetchWithValidation(
        `/v1/finance/bookings/${bookingId}/payment-schedules`,
        scheduleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return res.data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateBookingPaymentScheduleInput }) => {
      const res = await fetchWithValidation(
        `/v1/finance/bookings/${bookingId}/payment-schedules/${id}`,
        scheduleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return res.data
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (scheduleId: string) =>
      fetchWithValidation(
        `/v1/finance/bookings/${bookingId}/payment-schedules/${scheduleId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
