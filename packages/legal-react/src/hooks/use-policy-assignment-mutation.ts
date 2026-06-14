"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertPolicyAssignmentSchema,
  updatePolicyAssignmentSchema,
} from "@voyant-travel/legal/policies/validation"
import type { z } from "zod"
import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalPolicyAssignmentSingleResponse, successEnvelope } from "../schemas.js"

export type CreateLegalPolicyAssignmentInput = z.input<typeof insertPolicyAssignmentSchema>
export type UpdateLegalPolicyAssignmentInput = z.input<typeof updatePolicyAssignmentSchema>

export function useLegalPolicyAssignmentMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateLegalPolicyAssignmentInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/legal/policies/assignments",
        legalPolicyAssignmentSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.policyAssignments({ policyId: data.policyId }),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateLegalPolicyAssignmentInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/assignments/${id}`,
        legalPolicyAssignmentSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.policyAssignments({ policyId: data.policyId }),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async ({ policyId, id }: { policyId: string; id: string }) =>
      fetchWithValidation(
        `/v1/admin/legal/policies/assignments/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ).then((data) => ({ policyId, data })),
    onSuccess: ({ policyId }) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.policyAssignments({ policyId }),
      })
    },
  })

  return { create, update, remove }
}
