"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertPolicySchema,
  updatePolicySchema,
} from "@voyant-travel/legal/policies/validation"
import type { z } from "zod"
import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalPolicySingleResponse, successEnvelope } from "../schemas.js"

export type CreateLegalPolicyInput = z.input<typeof insertPolicySchema>
export type UpdateLegalPolicyInput = z.input<typeof updatePolicySchema>

export function useLegalPolicyMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateLegalPolicyInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/legal/policies",
        legalPolicySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policies() })
      queryClient.setQueryData(legalQueryKeys.policy(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateLegalPolicyInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/${id}`,
        legalPolicySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policies() })
      queryClient.setQueryData(legalQueryKeys.policy(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/legal/policies/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policies() })
      queryClient.removeQueries({ queryKey: legalQueryKeys.policy(id) })
      queryClient.removeQueries({ queryKey: legalQueryKeys.policyVersions(id) })
      queryClient.removeQueries({ queryKey: legalQueryKeys.policyAssignments({ policyId: id }) })
    },
  })

  return { create, update, remove }
}
