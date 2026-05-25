"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import {
  type InvoiceNumberResetStrategy,
  type InvoiceNumberSeriesRecord,
  type InvoiceNumberSeriesScope,
  invoiceNumberSeriesSingleResponse,
  successEnvelope,
} from "../schemas.js"

export interface CreateInvoiceNumberSeriesInput {
  code: string
  name: string
  prefix?: string
  separator?: string
  padLength?: number
  currentSequence?: number
  resetStrategy?: InvoiceNumberResetStrategy
  resetAt?: string | null
  scope?: InvoiceNumberSeriesScope
  isDefault?: boolean
  externalProvider?: string | null
  externalConfigKey?: string | null
  active?: boolean
}

export type UpdateInvoiceNumberSeriesInput = Partial<CreateInvoiceNumberSeriesInput>

export function useInvoiceNumberSeriesMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: financeQueryKeys.invoiceNumberSeries() })

  const create = useMutation({
    mutationFn: async (input: CreateInvoiceNumberSeriesInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/finance/invoice-number-series",
        invoiceNumberSeriesSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data: InvoiceNumberSeriesRecord) => {
      invalidateLists()
      queryClient.setQueryData(financeQueryKeys.invoiceNumberSeriesDetail(data.id), { data })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateInvoiceNumberSeriesInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/invoice-number-series/${id}`,
        invoiceNumberSeriesSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data: InvoiceNumberSeriesRecord) => {
      invalidateLists()
      queryClient.setQueryData(financeQueryKeys.invoiceNumberSeriesDetail(data.id), { data })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/finance/invoice-number-series/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      invalidateLists()
      queryClient.removeQueries({ queryKey: financeQueryKeys.invoiceNumberSeriesDetail(id) })
    },
  })

  return { create, update, remove }
}
