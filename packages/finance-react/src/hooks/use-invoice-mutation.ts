"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { type InvoiceRecord, invoiceSingleResponse, successEnvelope } from "../schemas.js"

export interface CreateInvoiceInput {
  invoiceNumber: string
  bookingId: string
  personId?: string | null
  organizationId?: string | null
  status?: InvoiceRecord["status"]
  currency: string
  subtotalCents?: number
  taxCents?: number
  totalCents?: number
  paidCents?: number
  balanceDueCents?: number
  issueDate: string
  dueDate: string
  notes?: string | null
}

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>

export function useInvoiceMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      const { data } = await fetchWithValidation(
        "/v1/finance/invoices",
        invoiceSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
      queryClient.setQueryData(financeQueryKeys.invoice(data.id), { data })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateInvoiceInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/finance/invoices/${id}`,
        invoiceSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
      queryClient.setQueryData(financeQueryKeys.invoice(data.id), { data })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/finance/invoices/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
      queryClient.removeQueries({ queryKey: financeQueryKeys.invoice(id) })
      queryClient.removeQueries({ queryKey: financeQueryKeys.lineItems(id) })
      queryClient.removeQueries({ queryKey: financeQueryKeys.payments(id) })
      queryClient.removeQueries({ queryKey: financeQueryKeys.creditNotes(id) })
      queryClient.removeQueries({ queryKey: financeQueryKeys.notes(id) })
    },
  })

  /**
   * Create + issue an invoice (or proforma) from an existing booking. The
   * server builds line items from either the booking items or a targeted
   * payment schedule row, then emits an `invoice.issued` event post-commit.
   */
  const createFromBooking = useMutation({
    mutationFn: async (input: CreateInvoiceFromBookingInput) => {
      const { data } = await fetchWithValidation(
        "/v1/finance/invoices/from-booking",
        invoiceSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
      queryClient.setQueryData(financeQueryKeys.invoice(data.id), { data })
    },
  })

  /**
   * Convert an issued proforma into a final invoice. Server-side this
   * copies the proforma's line items + totals, marks the proforma as
   * `void`, and emits `invoice.issued` with `convertedFromInvoiceId` so
   * the SmartBill subscriber (and audit chain) sees the linkage.
   */
  const convertToInvoice = useMutation({
    mutationFn: async ({ id, input }: { id: string; input?: ConvertProformaInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/finance/invoices/${id}/convert-to-invoice`,
        invoiceSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
      queryClient.setQueryData(financeQueryKeys.invoice(data.id), { data })
    },
  })

  /**
   * Render (or re-render) a PDF for an existing invoice. Server-side this
   * inserts an `invoice_rendition` row + emits `invoice.rendered`, which a
   * downstream subscriber turns into a stored PDF attachment. Use this for
   * the operator's "Generate" / "Regenerate" buttons.
   */
  const render = useMutation({
    mutationFn: async ({ id, input }: { id: string; input?: RenderInvoiceInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/finance/invoices/${id}/render`,
        invoiceRenditionResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? { format: "pdf" }) },
      )
      return data
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: financeQueryKeys.invoice(variables.id),
      })
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoices() })
    },
  })

  return { create, createFromBooking, convertToInvoice, render, update, remove }
}

export interface ConvertProformaInput {
  /** Optional override; server derives from the proforma number when omitted. */
  invoiceNumber?: string
  issueDate?: string
  dueDate?: string
}

export interface CreateInvoiceFromBookingInput {
  bookingId: string
  bookingPaymentScheduleId?: string
  invoiceNumber?: string
  issueDate: string
  dueDate: string
  notes?: string | null
  currency?: string
  baseCurrency?: string
  fxRateSetId?: string
  subtotalCents?: number
  taxCents?: number
  totalCents?: number
  lineItems?: CreateInvoiceFromBookingLineItemInput[]
  externalRefs?: CreateInvoiceFromBookingExternalRefInput[]
  /** Defaults to `invoice` on the server. Pass `proforma` for placeholders. */
  invoiceType?: "invoice" | "proforma"
}

export interface CreateInvoiceFromBookingExternalRefInput {
  provider: string
  externalId?: string | null
  externalNumber?: string | null
  externalUrl?: string | null
  status?: string | null
  metadata?: Record<string, unknown> | null
  syncedAt?: string | null
  syncError?: string | null
}

export interface CreateInvoiceFromBookingLineItemInput {
  description: string
  quantity: number
  unitAmountCents: number
  taxRateBps?: number | null
  taxAmountCents?: number | null
}

export interface RenderInvoiceInput {
  format?: "pdf" | "html"
  /** Optional invoice-template id; server falls back to the default. */
  templateId?: string | null
}

// Light envelope schema for the render endpoint — the server returns
// `{ data: rendition }` where rendition is { id, invoiceId, format, ... }.
// We only assert the wrapper so the hook stays portable across renditions
// shape changes; consumers that care can narrow on the data field.
const invoiceRenditionResponse = z.object({
  data: z.object({ id: z.string() }).passthrough(),
})
