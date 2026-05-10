"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { invoiceAttachmentRecordSchema, successEnvelope } from "../schemas.js"

export interface CreateInvoiceAttachmentInput {
  name: string
  kind?: string
  mimeType?: string | null
  fileSize?: number | null
  storageKey?: string | null
  checksum?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdateInvoiceAttachmentInput = Partial<CreateInvoiceAttachmentInput>

const invoiceAttachmentSingleResponse = z.object({
  data: invoiceAttachmentRecordSchema,
})

export function useInvoiceAttachmentMutation(invoiceId: string) {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateInvoiceAttachmentInput) => {
      const { data } = await fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/attachments`,
        invoiceAttachmentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.attachments(invoiceId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateInvoiceAttachmentInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/attachments/${id}`,
        invoiceAttachmentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.attachments(invoiceId) })
    },
  })

  const remove = useMutation({
    mutationFn: async (attachmentId: string) =>
      fetchWithValidation(
        `/v1/finance/invoices/${invoiceId}/attachments/${attachmentId}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.attachments(invoiceId) })
    },
  })

  return { create, update, remove }
}
