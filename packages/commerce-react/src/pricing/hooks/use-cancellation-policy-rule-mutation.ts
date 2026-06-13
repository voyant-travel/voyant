"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { cancellationPolicyRuleSingleResponse, successEnvelope } from "../schemas.js"

const cancellationPolicyRuleInputSchema = z.object({
  cancellationPolicyId: z.string(),
  sortOrder: z.number().int(),
  cutoffMinutesBefore: z.number().int().min(0).nullable().optional(),
  chargeType: z.enum(["none", "amount", "percentage"]),
  chargeAmountCents: z.number().int().min(0).nullable().optional(),
  chargePercentBasisPoints: z.number().int().min(0).max(10000).nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

export type CreateCancellationPolicyRuleInput = z.input<typeof cancellationPolicyRuleInputSchema>
export type UpdateCancellationPolicyRuleInput = Partial<CreateCancellationPolicyRuleInput>

export function useCancellationPolicyRuleMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateCancellationPolicyRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/cancellation-policy-rules",
        cancellationPolicyRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.cancellationPolicyRules() })
      queryClient.setQueryData(pricingQueryKeys.cancellationPolicyRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCancellationPolicyRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/cancellation-policy-rules/${id}`,
        cancellationPolicyRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.cancellationPolicyRules() })
      queryClient.setQueryData(pricingQueryKeys.cancellationPolicyRule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/cancellation-policy-rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.cancellationPolicyRules() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.cancellationPolicyRule(id) })
    },
  })

  return { create, update, remove }
}
