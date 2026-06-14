"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantPricingContext } from "../provider.js"
import { pricingQueryKeys } from "../query-keys.js"
import { cancellationPolicySingleResponse, successEnvelope } from "../schemas.js"

const cancellationPolicyInputSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(100).nullable().optional(),
  policyType: z.enum(["simple", "advanced", "non_refundable", "custom"]),
  simpleCutoffHours: z.number().int().min(0).nullable().optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type CreateCancellationPolicyInput = z.input<typeof cancellationPolicyInputSchema>
export type UpdateCancellationPolicyInput = Partial<CreateCancellationPolicyInput>

export function useCancellationPolicyMutation() {
  const { baseUrl, fetcher } = useVoyantPricingContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateCancellationPolicyInput) => {
      const { data } = await fetchWithValidation(
        "/v1/pricing/cancellation-policies",
        cancellationPolicySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.cancellationPolicies() })
      queryClient.setQueryData(pricingQueryKeys.cancellationPolicy(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCancellationPolicyInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/pricing/cancellation-policies/${id}`,
        cancellationPolicySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.cancellationPolicies() })
      queryClient.setQueryData(pricingQueryKeys.cancellationPolicy(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/pricing/cancellation-policies/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: pricingQueryKeys.cancellationPolicies() })
      queryClient.removeQueries({ queryKey: pricingQueryKeys.cancellationPolicy(id) })
    },
  })

  return { create, update, remove }
}
