"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { extraPriceRuleSingleResponse, successEnvelope } from "../schemas.js"

const extraPriceRuleInputSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  productExtraId: z.string().nullable().optional(),
  optionExtraConfigId: z.string().nullable().optional(),
  pricingMode: z.enum(["included", "per_person", "per_booking", "on_request", "unavailable"]),
  sellAmountCents: z.number().int().min(0).nullable().optional(),
  costAmountCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type CreateExtraPriceRuleInput = z.input<typeof extraPriceRuleInputSchema>
export type UpdateExtraPriceRuleInput = Partial<CreateExtraPriceRuleInput>

export function useExtraPriceRuleMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateExtraPriceRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/extra-price-rules",
        extraPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.extraPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.extraPriceRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateExtraPriceRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/extra-price-rules/${id}`,
        extraPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.extraPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.extraPriceRule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/extra-price-rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.extraPriceRules() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.extraPriceRule(id) })
    },
  })

  return { create, update, remove }
}
