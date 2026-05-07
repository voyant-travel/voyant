"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { crmQueryKeys } from "../query-keys.js"
import { type KmsEnvelopeRecord, personSingleResponse } from "../schemas.js"

export interface CreatePersonInput {
  firstName: string
  lastName: string
  organizationId?: string | null
  jobTitle?: string | null
  relation?: string | null
  status?: string
  email?: string | null
  phone?: string | null
  website?: string | null
  tags?: string[]
  notes?: string | null
  accessibilityEncrypted?: KmsEnvelopeRecord
  dietaryEncrypted?: KmsEnvelopeRecord
  loyaltyEncrypted?: KmsEnvelopeRecord
  insuranceEncrypted?: KmsEnvelopeRecord
  [key: string]: unknown
}

export type UpdatePersonInput = Partial<CreatePersonInput>

export interface UpdatePersonProfilePiiInput {
  accessibility?: string | null
  dietary?: string | null
  loyalty?: string | null
  insurance?: string | null
}

const deleteResponseSchema = z.object({ success: z.boolean() })
const successResponseSchema = z.object({ success: z.boolean() })

/**
 * Create, update, and delete mutations for people. All three share a single
 * hook so the component can pick the action it needs. TanStack Query cache is
 * invalidated on success.
 */
export function usePersonMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePersonInput) => {
      const { data } = await fetchWithValidation(
        "/v1/crm/people",
        personSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.people() })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePersonInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/crm/people/${id}`,
        personSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.people() })
      queryClient.setQueryData(crmQueryKeys.person(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return fetchWithValidation(
        `/v1/crm/people/${id}`,
        deleteResponseSchema,
        { baseUrl, fetcher },
        { method: "DELETE" },
      )
    },
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.people() })
      queryClient.removeQueries({ queryKey: crmQueryKeys.person(id) })
    },
  })

  /**
   * Plaintext PATCH for the four free-text PII slots. Server-side
   * encryption against the people KMS key. Used by the operator
   * "Save to profile" affordance after a booking-traveler edit.
   */
  const updateProfilePii = useMutation({
    mutationFn: async ({
      personId,
      input,
    }: {
      personId: string
      input: UpdatePersonProfilePiiInput
    }) => {
      return fetchWithValidation(
        `/v1/crm/people/${personId}/profile-pii`,
        successResponseSchema,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: crmQueryKeys.person(variables.personId) })
      void queryClient.invalidateQueries({
        queryKey: crmQueryKeys.personTravelSnapshot(variables.personId),
      })
    },
  })

  return { create, update, remove, updateProfilePii }
}
