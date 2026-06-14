"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertPolicyVersionSchema,
  updatePolicyVersionSchema,
} from "@voyant-travel/legal/policies/validation"
import type { z } from "zod"
import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalPolicyVersionSingleResponse } from "../schemas.js"

export type CreateLegalPolicyVersionInput = z.input<typeof insertPolicyVersionSchema>
export type UpdateLegalPolicyVersionInput = z.input<typeof updatePolicyVersionSchema>

export function useLegalPolicyVersionMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      policyId,
      input,
    }: {
      policyId: string
      input: CreateLegalPolicyVersionInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/${policyId}/versions`,
        legalPolicyVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policyVersions(data.policyId) })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateLegalPolicyVersionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/versions/${id}`,
        legalPolicyVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policyVersions(data.policyId) })
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policy(data.policyId) })
    },
  })

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/versions/${id}/publish`,
        legalPolicyVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST" },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policyVersions(data.policyId) })
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policy(data.policyId) })
    },
  })

  const retire = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/versions/${id}/retire`,
        legalPolicyVersionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST" },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policyVersions(data.policyId) })
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policy(data.policyId) })
    },
  })

  return { create, update, publish, retire }
}
