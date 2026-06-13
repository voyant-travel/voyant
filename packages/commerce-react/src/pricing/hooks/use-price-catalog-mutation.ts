"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { priceCatalogSingleResponse, successEnvelope } from "../schemas.js"

const priceCatalogInputSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  currencyCode: z.string().length(3).nullable().optional(),
  catalogType: z.enum(["public", "contract", "net", "gross", "promo", "internal", "other"]),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type CreatePriceCatalogInput = z.input<typeof priceCatalogInputSchema>
export type UpdatePriceCatalogInput = Partial<CreatePriceCatalogInput>

export function usePriceCatalogMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePriceCatalogInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/price-catalogs",
        priceCatalogSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.priceCatalogs() })
      queryClient.setQueryData(pricingQueryKeys.priceCatalog(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePriceCatalogInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/price-catalogs/${id}`,
        priceCatalogSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.priceCatalogs() })
      queryClient.setQueryData(pricingQueryKeys.priceCatalog(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/price-catalogs/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.priceCatalogs() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.priceCatalog(id) })
    },
  })

  return { create, update, remove }
}
