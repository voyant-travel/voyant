"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantBookingsContext } from "../provider.js"
import { bookingsQueryKeys } from "../query-keys.js"
import { bookingSupplierStatusRecordSchema } from "../schemas.js"

export interface CreateSupplierStatusInput {
  supplierServiceId?: string | null
  serviceName: string
  status?: "pending" | "confirmed" | "rejected" | "cancelled"
  supplierReference?: string | null
  costCurrency: string
  costAmountCents: number
  notes?: string | null
}

export type UpdateSupplierStatusInput = Partial<CreateSupplierStatusInput> & {
  confirmedAt?: string | null
}

const bookingSupplierStatusSingleResponse = z.object({
  data: bookingSupplierStatusRecordSchema,
})

export function useSupplierStatusMutation(bookingId: string) {
  const { baseUrl, fetcher } = useVoyantBookingsContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.booking(bookingId) })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.bookings() })
    void queryClient.invalidateQueries({
      queryKey: bookingsQueryKeys.supplierStatuses(bookingId),
    })
    void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.activity(bookingId) })
  }

  const create = useMutation({
    mutationFn: async (input: CreateSupplierStatusInput) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/supplier-statuses`,
        bookingSupplierStatusSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSupplierStatusInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/bookings/${bookingId}/supplier-statuses/${id}`,
        bookingSupplierStatusSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { create, update }
}
