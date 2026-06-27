"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantAvailabilityContext } from "../provider.js"
import { availabilityQueryKeys } from "../query-keys.js"
import {
  availabilityRuleSingleResponse,
  type CreateAvailabilityRuleInput,
  successEnvelope,
  type UpdateAvailabilityRuleInput,
} from "../schemas.js"

export function useAvailabilityRuleMutation() {
  const { baseUrl, fetcher } = useVoyantAvailabilityContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateAvailabilityRuleInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/operations/availability/rules",
        availabilityRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.rules() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.rulesList({ productId: data.productId }),
      })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateAvailabilityRuleInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/operations/availability/rules/${id}`,
        availabilityRuleSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.rules() })
      await queryClient.invalidateQueries({
        queryKey: availabilityQueryKeys.ruleDetail(data.id),
      })
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/operations/availability/rules/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKeys.rules() })
    },
  })

  return { create, update, remove }
}
