"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { quotesQueryKeys } from "../query-keys.js"
import {
  acceptQuoteVersionResponse,
  listEnvelope,
  quoteVersionLineSingleResponse,
  quoteVersionRecordSchema,
  quoteVersionSingleResponse,
} from "../schemas.js"

export interface CreateQuoteVersionInput {
  currency: string
  quoteId?: string
  label?: string | null
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
        `/v1/admin/quotes/quotes/${quoteId}/versions`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersionsList({ quoteId: vars.quoteId }),
      })
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quote(vars.quoteId) })
    },
  })

  // Snapshot the quote's current line items into a new version (the "Save"
  // action). The server copies products → version lines, computes the total,
  // and supersedes the prior current version.
  const snapshot = useMutation({
    mutationFn: async ({ quoteId }: { quoteId: string }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quotes/${quoteId}/versions/snapshot`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST" },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersionsList({ quoteId: vars.quoteId }),
      })
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quote(vars.quoteId) })
    },
  })

  // Narrow validity-date update (the generic update schema carries insert
  // defaults that would clobber status/totals — see the service note).
  const setValidUntil = useMutation({
    mutationFn: async ({ id, validUntil }: { id: string; validUntil: string | null }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}/validity`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify({ validUntil }) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quote(data.quoteId) })
    },
  })

  // Send a version to the client for review (proposal admin route). Marks it
  // "sent" and returns the shareable proposal URL.
  const sendProposal = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quote-versions/${id}/send`,
        z.object({
          data: z.object({ quoteVersion: quoteVersionRecordSchema, proposalUrl: z.string() }),
        }),
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quote(data.quoteVersion.quoteId),
      })
    },
  })

  // Resolve the deployment's shareable proposal URL for an already-sent
  // version without side effects (no re-send, no view tracking) — used when
  // re-copying the review link. Returns the same deployment-resolved URL the
  // initial send produced.
  const fetchProposalLink = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quote-versions/${id}/proposal-link`,
        z.object({ data: z.object({ proposalUrl: z.string() }) }),
        { baseUrl, fetcher },
        { method: "GET" },
      )
      return data
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateQuoteVersionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      queryClient.setQueryData(quotesQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quote(data.quoteId) })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      queryClient.removeQueries({ queryKey: quotesQueryKeys.quoteVersion(id) })
    },
  })

  const send = useMutation({
    mutationFn: async ({ id, input }: { id: string; input?: SendQuoteVersionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}/send`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      queryClient.setQueryData(quotesQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quote(data.quoteId) })
    },
  })

  const view = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}/view`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({}) },
      )
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(quotesQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
    },
  })

  const decline = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}/decline`,
        quoteVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      queryClient.setQueryData(quotesQueryKeys.quoteVersion(data.id), data)
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quote(data.quoteId) })
    },
  })

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/quotes/quote-versions/${id}/accept`,
        acceptQuoteVersionResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify({}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      queryClient.setQueryData(quotesQueryKeys.quote(data.quote.id), data.quote)
      queryClient.setQueryData(
        quotesQueryKeys.quoteVersion(data.quoteVersion.id),
        data.quoteVersion,
      )
      for (const quoteVersion of data.closedQuoteVersions) {
        queryClient.setQueryData(quotesQueryKeys.quoteVersion(quoteVersion.id), quoteVersion)
      }
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersionsList({ quoteId: data.quote.id }),
      })
    },
  })

  const expire = useMutation({
    mutationFn: async (input?: ExpireQuoteVersionsInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/quotes/quote-versions/expire",
        quoteVersionArrayResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input ?? {}) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: quotesQueryKeys.quoteVersions() })
      for (const quoteVersion of data) {
        queryClient.setQueryData(quotesQueryKeys.quoteVersion(quoteVersion.id), quoteVersion)
        void queryClient.invalidateQueries({
          queryKey: quotesQueryKeys.quote(quoteVersion.quoteId),
        })
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
        `/v1/admin/quotes/quote-versions/${quoteVersionId}/lines`,
        quoteVersionLineSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersionLines(vars.quoteVersionId),
      })
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersion(vars.quoteVersionId),
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
        `/v1/admin/quotes/quote-version-lines/${lineId}`,
        quoteVersionLineSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersionLines(vars.quoteVersionId),
      })
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersion(vars.quoteVersionId),
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
        `/v1/admin/quotes/quote-version-lines/${lineId}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersionLines(vars.quoteVersionId),
      })
      void queryClient.invalidateQueries({
        queryKey: quotesQueryKeys.quoteVersion(vars.quoteVersionId),
      })
    },
  })

  return {
    create,
    snapshot,
    sendProposal,
    fetchProposalLink,
    setValidUntil,
    update,
    remove,
    send,
    view,
    decline,
    accept,
    expire,
    createLine,
    updateLine,
    removeLine,
  }
}
