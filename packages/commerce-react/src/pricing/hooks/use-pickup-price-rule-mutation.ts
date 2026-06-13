"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { pickupPriceRuleSingleResponse, successEnvelope } from "../schemas.js"

const pickupPriceRuleInputSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  pickupPointId: z.string(),
  pricingMode: z.enum(["included", "per_person", "per_booking", "on_request", "unavailable"]),
  sellAmountCents: z.number().int().min(0).nullable().optional(),
  costAmountCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
})

export type CreatePickupPriceRuleInput = z.input<typeof pickupPriceRuleInputSchema>
export type UpdatePickupPriceRuleInput = Partial<CreatePickupPriceRuleInput>

export function usePickupPriceRuleMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePickupPriceRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/pickup-price-rules",
        pickupPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.pickupPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.pickupPriceRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePickupPriceRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/pickup-price-rules/${id}`,
        pickupPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.pickupPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.pickupPriceRule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/pickup-price-rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.pickupPriceRules() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.pickupPriceRule(id) })
    },
  })

  return { create, update, remove }
}
