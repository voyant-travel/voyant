"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { departurePriceOverrideSingleResponse, successEnvelope } from "../schemas.js"

const departurePriceOverrideInputSchema = z.object({
  departureId: z.string(),
  optionId: z.string(),
  optionUnitId: z.string(),
  priceCatalogId: z.string(),
  sellAmountCents: z.number().int().min(0),
  costAmountCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type CreateDeparturePriceOverrideInput = z.input<typeof departurePriceOverrideInputSchema>
export type UpdateDeparturePriceOverrideInput = Partial<CreateDeparturePriceOverrideInput>

export function useDeparturePriceOverrideMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateDeparturePriceOverrideInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/departure-price-overrides",
        departurePriceOverrideSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.departurePriceOverrides(),
      })
      queryClient.setQueryData(pricingQueryKeys.departurePriceOverride(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateDeparturePriceOverrideInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/departure-price-overrides/${id}`,
        departurePriceOverrideSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.departurePriceOverrides(),
      })
      queryClient.setQueryData(pricingQueryKeys.departurePriceOverride(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/departure-price-overrides/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({
        queryKey: pricingQueryKeys.departurePriceOverrides(),
      })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.departurePriceOverride(id) })
    },
  })

  return { create, update, remove }
}
