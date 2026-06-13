"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { optionUnitTierSingleResponse, successEnvelope } from "../schemas.js"

const optionUnitTierInputSchema = z.object({
  optionUnitPriceRuleId: z.string(),
  minQuantity: z.number().int().min(1),
  maxQuantity: z.number().int().min(1).nullable().optional(),
  sellAmountCents: z.number().int().min(0).nullable().optional(),
  costAmountCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export type CreateOptionUnitTierInput = z.input<typeof optionUnitTierInputSchema>
export type UpdateOptionUnitTierInput = Partial<CreateOptionUnitTierInput>

export function useOptionUnitTierMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateOptionUnitTierInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/option-unit-tiers",
        optionUnitTierSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionUnitTiers() })
      queryClient.setQueryData(pricingQueryKeys.optionUnitTier(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateOptionUnitTierInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/option-unit-tiers/${id}`,
        optionUnitTierSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionUnitTiers() })
      queryClient.setQueryData(pricingQueryKeys.optionUnitTier(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/option-unit-tiers/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.optionUnitTiers() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.optionUnitTier(id) })
    },
  })

  return { create, update, remove }
}
