"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import {
  type KmsEnvelopeRecord,
  type PersonDocumentType,
  personDocumentSingleResponse,
} from "../schemas.js"

export interface CreatePersonDocumentInput {
  type: PersonDocumentType
  numberEncrypted?: KmsEnvelopeRecord
  issuingAuthority?: string | null
  issuingCountry?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  attachmentId?: string | null
  isPrimary?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdatePersonDocumentInput = Partial<CreatePersonDocumentInput>

export interface CreatePersonDocumentFromPlaintextInput {
  type: PersonDocumentType
  /** Plaintext document number; the route encrypts server-side. */
  number?: string | null
  issuingAuthority?: string | null
  issuingCountry?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  attachmentId?: string | null
  isPrimary?: boolean
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

export type UpdatePersonDocumentFromPlaintextInput = Partial<CreatePersonDocumentFromPlaintextInput>

const deleteResponseSchema = z.object({ success: z.boolean() })

/**
 * Create / update / delete / set-primary mutations for person
 * documents. Cache invalidation targets both the per-person list and
 * the per-document detail key.
 */
export function usePersonDocumentMutation(personId: string | undefined) {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const invalidate = () => {
    if (personId) {
      void queryClient.invalidateQueries({
        queryKey: [...crmQueryKeys.person(personId), "documents"],
      })
    }
  }

  const create = useMutation({
    mutationFn: async (input: CreatePersonDocumentInput) => {
      if (!personId) throw new Error("usePersonDocumentMutation requires a personId")
      const { data } = await fetchWithValidation(
        `/v1/crm/people/${personId}/documents`,
        personDocumentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePersonDocumentInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/person-documents/${id}`,
        personDocumentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidate()
      queryClient.setQueryData(crmQueryKeys.personDocument(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/crm/person-documents/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      invalidate()
      queryClient.removeQueries({ queryKey: crmQueryKeys.personDocument(id) })
    },
  })

  const setPrimary = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/person-documents/${id}/set-primary`,
        personDocumentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST" },
      )
      return data
    },
    onSuccess: (data) => {
      invalidate()
      queryClient.setQueryData(crmQueryKeys.personDocument(data.id), data)
    },
  })

  /**
   * Plaintext create — caller passes `number` as cleartext, the route
   * encrypts server-side. Used by the operator booking-traveler
   * "Save to profile" affordance when a passport doc doesn't yet
   * exist for the linked person.
   */
  const createFromPlaintext = useMutation({
    mutationFn: async (input: CreatePersonDocumentFromPlaintextInput) => {
      if (!personId) throw new Error("usePersonDocumentMutation requires a personId")
      const { data } = await fetchWithValidation(
        `/v1/crm/people/${personId}/documents/from-plaintext`,
        personDocumentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const updateFromPlaintext = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: UpdatePersonDocumentFromPlaintextInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/person-documents/${id}/from-plaintext`,
        personDocumentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidate()
      queryClient.setQueryData(crmQueryKeys.personDocument(data.id), data)
    },
  })

  return { create, update, remove, setPrimary, createFromPlaintext, updateFromPlaintext }
}
