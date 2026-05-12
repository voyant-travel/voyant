"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { supplierPaymentRecordSchema } from "../schemas.js"

export interface CreateSupplierPaymentInput {
  bookingId: string
  supplierId?: string | null
  amountCents: number
  currency: string
  baseCurrency?: string | null
  baseAmountCents?: number | null
  fxRateSetId?: string | null
  paymentMethod: "bank_transfer" | "credit_card" | "cash" | "cheque" | "other"
  status: "pending" | "completed" | "failed" | "refunded"
  referenceNumber?: string | null
  paymentDate: string
  notes?: string | null
}

export type UpdateSupplierPaymentInput = Partial<CreateSupplierPaymentInput>

const supplierPaymentSingleResponse = z.object({
  data: supplierPaymentRecordSchema,
})

export function useSupplierPaymentMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateSupplierPaymentInput) => {
      const { data } = await fetchWithValidation(
        "/v1/finance/supplier-payments",
        supplierPaymentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.supplierPayments() })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.allPayments() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSupplierPaymentInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/finance/supplier-payments/${id}`,
        supplierPaymentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.supplierPayments() })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.allPayments() })
    },
  })

  return { create, update }
}
