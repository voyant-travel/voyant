"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import {
  listEnvelope,
  quoteVersionLineSingleResponse,
  quoteVersionRecordSchema,
  quoteVersionSingleResponse,
} from "../schemas.js"

export interface CreateQuoteVersionInput {
  currency: string
  quoteId?: string
  label?: string | null
  status?: string
  supersedesId?: string | null
  tripSnapshotId?: string | null
  validUntil?: string | null
  subtotalAmountCents?: number
  taxAmountCents?: number
  totalAmountCents?: number
  notes?: string | null
  sentAt?: string | null
  viewedAt?: string | null
  decidedAt?: string | null
  [key: string]: unknown
}

export type UpdateQuoteVersionInput = Partial<CreateQuoteVersionInput>

export interface SendQuoteVersionInput {
  validUntil?: string | null
}

export interface ExpireQuoteVersionsInput {
  now?: string
}

export interface CreateQuoteVersionLineInput {
  description: string
  currency: string
  quantity?: number
  unitPriceAmountCents?: number
  totalAmountCents?: number
  productId?: string | null
  supplierServiceId?: string | null
  [key: string]: unknown
}

export type UpdateQuoteVersionLineInput = Partial<CreateQuoteVersionLineInput>

const deleteResponseSchema = z.object({ success: z.boolean() })
const quoteVersionArrayResponse = listEnvelope(quoteVersionRecordSchema)

export function useQuoteVersionMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({ quoteId, input }: { quoteId: string; input: CreateQuoteVersionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/quotes/${quoteId}/versions`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quoteVersions() })
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.quoteVersionsList({ quoteId: vars.quoteId }),
      })
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quote(vars.quoteId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateQuoteVersionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/quote-versions/${id}`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quoteVersions() })
      queryClient.setQueryData(crmQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quote(data.quoteId) })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/crm/quote-versions/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quoteVersions() })
      queryClient.removeQueries({ queryKey: crmQueryKeys.quoteVersion(id) })
    },
  })

  const send = useMutation({
    mutationFn: async ({ id, input }: { id: string; input?: SendQuoteVersionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/quote-versions/${id}/send`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quoteVersions() })
      queryClient.setQueryData(crmQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quote(data.quoteId) })
    },
  })

  const view = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/quote-versions/${id}/view`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({}) },
      )
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(crmQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quoteVersions() })
    },
  })

  const decline = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/quote-versions/${id}/decline`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quoteVersions() })
      queryClient.setQueryData(crmQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quote(data.quoteId) })
    },
  })

  const expire = useMutation({
    mutationFn: async (input?: ExpireQuoteVersionsInput) => {
      const { data } = await fetchWithValidation(
        "/v1/crm/quote-versions/expire",
        quoteVersionArrayResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quoteVersions() })
      for (const quoteVersion of data) {
        queryClient.setQueryData(crmQueryKeys.quoteVersion(quoteVersion.id), quoteVersion)
        void queryClient.invalidateQueries({ queryKey: crmQueryKeys.quote(quoteVersion.quoteId) })
      }
    },
  })

  const createLine = useMutation({
    mutationFn: async ({
      quoteVersionId,
      input,
    }: {
      quoteVersionId: string
      input: CreateQuoteVersionLineInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/quote-versions/${quoteVersionId}/lines`,
        quoteVersionLineSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.quoteVersionLines(vars.quoteVersionId),
      })
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.quoteVersion(vars.quoteVersionId),
      })
    },
  })

  const updateLine = useMutation({
    mutationFn: async ({
      quoteVersionId: _quoteVersionId,
      lineId,
      input,
    }: {
      quoteVersionId: string
      lineId: string
      input: UpdateQuoteVersionLineInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/quote-version-lines/${lineId}`,
        quoteVersionLineSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.quoteVersionLines(vars.quoteVersionId),
      })
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.quoteVersion(vars.quoteVersionId),
      })
    },
  })

  const removeLine = useMutation({
    mutationFn: async ({
      quoteVersionId: _quoteVersionId,
      lineId,
    }: {
      quoteVersionId: string
      lineId: string
    }) => {
      return fetchWithValidation(
        `/v1/crm/quote-version-lines/${lineId}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.quoteVersionLines(vars.quoteVersionId),
      })
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.quoteVersion(vars.quoteVersionId),
      })
    },
  })

  return { create, update, remove, send, view, decline, expire, createLine, updateLine, removeLine }
}
