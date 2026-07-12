"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertSellabilityPolicySchema,
  updateSellabilityPolicySchema,
} from "@voyant-travel/commerce/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantSellabilityContext } from "../provider.js"
import { sellabilityQueryKeys } from "../query-keys.js"
import { sellabilityPolicySingleResponse, successEnvelope } from "../schemas.js"

export type CreateSellabilityPolicyInput = z.input<typeof insertSellabilityPolicySchema>
export type UpdateSellabilityPolicyInput = z.input<typeof updateSellabilityPolicySchema>

export function useSellabilityPolicyMutation() {
  const { baseUrl, fetcher } = useVoyantSellabilityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateSellabilityPolicyInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/sellability/policies",
        sellabilityPolicySingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: sellabilityQueryKeys.policies() })
      queryClient.setQueryData(sellabilityQueryKeys.policy(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSellabilityPolicyInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/sellability/policies/${id}`,
        sellabilityPolicySingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: sellabilityQueryKeys.policies() })
      queryClient.setQueryData(sellabilityQueryKeys.policy(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/sellability/policies/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: sellabilityQueryKeys.policies() })
      queryClient.removeQueries({ queryKey: sellabilityQueryKeys.policy(id) })
    },
  })

  return { create, update, remove }
}
