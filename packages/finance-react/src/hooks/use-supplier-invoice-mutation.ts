"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import {
  type ApServiceType,
  supplierInvoiceSingleResponse,
  supplierPaymentRecordSchema,
} from "../schemas.js"

export interface SupplierInvoiceLineInput {
  description: string
  serviceType?: ApServiceType
  supplierServiceId?: string | null
  quantity?: number
  unitAmountCents: number
  taxRateBps?: number | null
  taxAmountCents?: number
  totalAmountCents: number
  sortOrder?: number
}

export interface SupplierCostAllocationInput {
  supplierInvoiceLineId?: string | null
  targetType: "departure" | "product" | "booking" | "traveler" | "unattributed"
  departureId?: string | null
  productId?: string | null
  bookingId?: string | null
  bookingItemId?: string | null
  travelerId?: string | null
  amountCents: number
  baseAmountCents?: number | null
  splitMethod?: "manual" | "per_pax" | "equal" | "weighted"
}

export interface CreateSupplierInvoiceInput {
  supplierId: string
  supplierInvoiceNo: string
  internalRef?: string | null
  status?: "draft" | "received" | "approved" | "partially_paid" | "paid" | "disputed" | "void"
  currency: string
  baseCurrency?: string | null
  fxRateSetId?: string | null
  subtotalCents?: number
  taxCents?: number
  totalCents?: number
  taxRegimeId?: string | null
  issueDate: string
  dueDate?: string | null
  storageKey?: string | null
  notes?: string | null
  lines?: SupplierInvoiceLineInput[]
  allocations?: SupplierCostAllocationInput[]
}

export type UpdateSupplierInvoiceInput = Partial<
  Omit<CreateSupplierInvoiceInput, "lines" | "allocations">
>

export interface RecordSupplierPaymentInput {
  amountCents: number
  currency: string
  paymentMethod: string
  status?: "pending" | "completed" | "failed" | "refunded"
  paymentDate: string
  referenceNumber?: string | null
  notes?: string | null
  baseCurrency?: string | null
  baseAmountCents?: number | null
  fxRateSetId?: string | null
  supplierId?: string | null
  bookingId?: string | null
}

const supplierPaymentSingleResponse = z.object({ data: supplierPaymentRecordSchema.nullable() })

export function useSupplierInvoiceMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const invalidate = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: financeQueryKeys.supplierInvoices() })
    if (id) void queryClient.invalidateQueries({ queryKey: financeQueryKeys.supplierInvoice(id) })
  }

  const create = useMutation({
    mutationFn: async (input: CreateSupplierInvoiceInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/finance/supplier-invoices",
        supplierInvoiceSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => invalidate(data.id),
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSupplierInvoiceInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/supplier-invoices/${id}`,
        supplierInvoiceSingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => invalidate(data.id),
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/finance/supplier-invoices/${id}`,
        z.object({ data: z.object({ id: z.string() }).nullable() }),
        client,
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => invalidate(id),
  })

  const setLines = useMutation({
    mutationFn: async ({ id, lines }: { id: string; lines: SupplierInvoiceLineInput[] }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/supplier-invoices/${id}/lines`,
        supplierInvoiceSingleResponse,
        client,
        { method: "PUT", body: JSON.stringify({ lines }) },
      )
      return data
    },
    onSuccess: (data) => invalidate(data.id),
  })

  const setAllocations = useMutation({
    mutationFn: async ({
      id,
      allocations,
    }: {
      id: string
      allocations: SupplierCostAllocationInput[]
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/supplier-invoices/${id}/allocations`,
        supplierInvoiceSingleResponse,
        client,
        { method: "PUT", body: JSON.stringify({ allocations }) },
      )
      return data
    },
    onSuccess: (data) => invalidate(data.id),
  })

  const recordPayment = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RecordSupplierPaymentInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/supplier-invoices/${id}/payments`,
        supplierPaymentSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, variables) => invalidate(variables.id),
  })

  return { create, update, remove, setLines, setAllocations, recordPayment }
}
