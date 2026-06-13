"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { priceScheduleSingleResponse, successEnvelope } from "../schemas.js"

const weekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
])

const priceScheduleInputSchema = z.object({
  priceCatalogId: z.string(),
  code: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255),
  recurrenceRule: z.string().min(1),
  timezone: z.string().max(100).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  weekdays: z.array(weekdaySchema).nullable().optional(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type CreatePriceScheduleInput = z.input<typeof priceScheduleInputSchema>
export type UpdatePriceScheduleInput = Partial<CreatePriceScheduleInput>

export function usePriceScheduleMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreatePriceScheduleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/price-schedules",
        priceScheduleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.priceSchedules() })
      queryClient.setQueryData(pricingQueryKeys.priceSchedule(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdatePriceScheduleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/price-schedules/${id}`,
        priceScheduleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.priceSchedules() })
      queryClient.setQueryData(pricingQueryKeys.priceSchedule(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/price-schedules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.priceSchedules() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.priceSchedule(id) })
    },
  })

  return { create, update, remove }
}
