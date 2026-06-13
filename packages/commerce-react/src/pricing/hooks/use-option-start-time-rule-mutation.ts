"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { optionStartTimeRuleSingleResponse, successEnvelope } from "../schemas.js"

const optionStartTimeRuleInputSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  startTimeId: z.string(),
  ruleMode: z.enum(["included", "excluded", "override", "adjustment"]),
  adjustmentType: z.enum(["fixed", "percentage"]).nullable().optional(),
  sellAdjustmentCents: z.number().int().min(0).nullable().optional(),
  costAdjustmentCents: z.number().int().min(0).nullable().optional(),
  adjustmentBasisPoints: z.number().int().min(0).max(10000).nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

export type CreateOptionStartTimeRuleInput = z.input<typeof optionStartTimeRuleInputSchema>
export type UpdateOptionStartTimeRuleInput = Partial<CreateOptionStartTimeRuleInput>

export function useOptionStartTimeRuleMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateOptionStartTimeRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/option-start-time-rules",
        optionStartTimeRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionStartTimeRules() })
      queryClient.setQueryData(pricingQueryKeys.optionStartTimeRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOptionStartTimeRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/option-start-time-rules/${id}`,
        optionStartTimeRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionStartTimeRules() })
      queryClient.setQueryData(pricingQueryKeys.optionStartTimeRule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/option-start-time-rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionStartTimeRules() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.optionStartTimeRule(id) })
    },
  })

  return { create, update, remove }
}
