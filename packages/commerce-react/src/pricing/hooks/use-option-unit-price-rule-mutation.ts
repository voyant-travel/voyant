"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { optionUnitPriceRuleSingleResponse, successEnvelope } from "../schemas.js"

const optionUnitPriceRuleInputSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  unitId: z.string(),
  pricingCategoryId: z.string().nullable().optional(),
  pricingMode: z.enum(["per_unit", "per_person", "per_booking", "included", "free", "on_request"]),
  sellAmountCents: z.number().int().min(0).nullable().optional(),
  costAmountCents: z.number().int().min(0).nullable().optional(),
  minQuantity: z.number().int().min(0).nullable().optional(),
  maxQuantity: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type CreateOptionUnitPriceRuleInput = z.input<typeof optionUnitPriceRuleInputSchema>
export type UpdateOptionUnitPriceRuleInput = Partial<CreateOptionUnitPriceRuleInput>

export function useOptionUnitPriceRuleMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateOptionUnitPriceRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/option-unit-price-rules",
        optionUnitPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionUnitPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.optionUnitPriceRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOptionUnitPriceRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/option-unit-price-rules/${id}`,
        optionUnitPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionUnitPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.optionUnitPriceRule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/option-unit-price-rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionUnitPriceRules() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.optionUnitPriceRule(id) })
    },
  })

  return { create, update, remove }
}
