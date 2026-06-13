"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { dropoffPriceRuleSingleResponse, successEnvelope } from "../schemas.js"

const dropoffPriceRuleInputSchema = z.object({
  optionPriceRuleId: z.string(),
  optionId: z.string(),
  facilityId: z.string().nullable().optional(),
  dropoffCode: z.string().max(100).nullable().optional(),
  dropoffName: z.string().min(1).max(255),
  pricingMode: z.enum(["included", "per_person", "per_booking", "on_request", "unavailable"]),
  sellAmountCents: z.number().int().min(0).nullable().optional(),
  costAmountCents: z.number().int().min(0).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().nullable().optional(),
})

export type CreateDropoffPriceRuleInput = z.input<typeof dropoffPriceRuleInputSchema>
export type UpdateDropoffPriceRuleInput = Partial<CreateDropoffPriceRuleInput>

export function useDropoffPriceRuleMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateDropoffPriceRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/dropoff-price-rules",
        dropoffPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.dropoffPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.dropoffPriceRule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateDropoffPriceRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/dropoff-price-rules/${id}`,
        dropoffPriceRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.dropoffPriceRules() })
      queryClient.setQueryData(pricingQueryKeys.dropoffPriceRule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/dropoff-price-rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.dropoffPriceRules() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.dropoffPriceRule(id) })
    },
  })

  return { create, update, remove }
}
