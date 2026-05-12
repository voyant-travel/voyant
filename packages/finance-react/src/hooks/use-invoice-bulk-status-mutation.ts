"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { type InvoiceRecord, invoiceSingleResponse } from "../schemas.js"
import type { UpdateInvoiceInput } from "./use-invoice-mutation.js"

type InvoiceBulkStatusItem = Pick<
  InvoiceRecord,
  "id" | "status" | "totalCents" | "paidCents" | "balanceDueCents"
> & {
  baseTotalCents?: number | null
}

export interface UpdateInvoicesStatusInput {
  invoices: InvoiceBulkStatusItem[]
  status: InvoiceRecord["status"]
}

export interface InvoiceBulkStatusFailure {
  id: string
  error: unknown
}

export interface InvoiceBulkStatusResult {
  status: InvoiceRecord["status"]
  total: number
  updated: InvoiceRecord[]
  failed: InvoiceBulkStatusFailure[]
}

type InvoiceStatusPayload = UpdateInvoiceInput & {
  basePaidCents?: number | null
  baseBalanceDueCents?: number | null
}

const BULK_STATUS_BATCH_SIZE = 5

function buildStatusPayload(
  invoice: InvoiceBulkStatusItem,
  status: InvoiceRecord["status"],
): InvoiceStatusPayload {
  if (status !== "paid") {
    return { status }
  }

  return {
    status,
    paidCents: invoice.totalCents,
    balanceDueCents: 0,
    ...(typeof invoice.baseTotalCents === "number"
      ? {
          basePaidCents: invoice.baseTotalCents,
          baseBalanceDueCents: 0,
        }
      : {}),
  }
}

export function useInvoiceBulkStatusMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ invoices, status }: UpdateInvoicesStatusInput) => {
      const updated: InvoiceRecord[] = []
      const failed: InvoiceBulkStatusFailure[] = []

      for (let index = 0; index < invoices.length; index += BULK_STATUS_BATCH_SIZE) {
        const batch = invoices.slice(index, index + BULK_STATUS_BATCH_SIZE)
        const results = await Promise.allSettled(
          batch.map(async (invoice) => {
            const { data } = await fetchWithValidation(
              `/v1/finance/invoices/${invoice.id}`,
              invoiceSingleResponse,
              { baseUrl, fetcher },
              {
                method: "PATCH",
                body: JSON.stringify(buildStatusPayload(invoice, status)),
              },
            )
            return data
          }),
        )

        for (const [resultIndex, result] of results.entries()) {
          const invoice = batch[resultIndex]
          if (!invoice) continue

          if (result.status === "fulfilled") {
            updated.push(result.value)
          } else {
            failed.push({ id: invoice.id, error: result.reason })
          }
        }
      }

      return {
        status,
        total: invoices.length,
        updated,
        failed,
      } satisfies InvoiceBulkStatusResult
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
      for (const invoice of result.updated) {
        queryClient.setQueryData(financeQueryKeys.invoice(invoice.id), { data: invoice })
      }
    },
  })
}
