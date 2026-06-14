"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertPolicyRuleSchema,
  updatePolicyRuleSchema,
} from "@voyant-travel/legal/policies/validation"
import type { z } from "zod"
import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalPolicyRuleSingleResponse, successEnvelope } from "../schemas.js"

export type CreateLegalPolicyRuleInput = z.input<typeof insertPolicyRuleSchema>
export type UpdateLegalPolicyRuleInput = z.input<typeof updatePolicyRuleSchema>

export function useLegalPolicyRuleMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      versionId,
      input,
    }: {
      versionId: string
      input: CreateLegalPolicyRuleInput
    }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/versions/${versionId}/rules`,
        legalPolicyRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.policyRules(data.policyVersionId),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateLegalPolicyRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/policies/rules/${id}`,
        legalPolicyRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.policyRules(data.policyVersionId),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async ({ versionId, id }: { versionId: string; id: string }) =>
      fetchWithValidation(
        `/v1/admin/legal/policies/rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ).then((data) => ({ versionId, data })),
    onSuccess: ({ versionId }) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.policyRules(versionId) })
    },
  })

  return { create, update, remove }
}
