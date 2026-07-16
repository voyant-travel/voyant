"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  customFieldDefinitionInputSchema,
  updateCustomFieldDefinitionSchema,
} from "@voyant-travel/custom-fields/contracts"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { customFieldsQueryKeys } from "../query-keys.js"
import { customFieldDefinitionSingleResponse, successEnvelope } from "../schemas.js"

export type CreateCustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionInputSchema>
export type UpdateCustomFieldDefinitionInput = z.infer<typeof updateCustomFieldDefinitionSchema>

export function useCustomFieldDefinitionMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateCustomFieldDefinitionInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/custom-fields",
        customFieldDefinitionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: customFieldsQueryKeys.definitions() })
      queryClient.setQueryData(customFieldsQueryKeys.definition(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCustomFieldDefinitionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/custom-fields/${id}`,
        customFieldDefinitionSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: customFieldsQueryKeys.definitions() })
      queryClient.setQueryData(customFieldsQueryKeys.definition(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetchWithValidation(
        `/v1/admin/custom-fields/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: customFieldsQueryKeys.definitions() })
      queryClient.removeQueries({ queryKey: customFieldsQueryKeys.definition(id) })
    },
  })

  return { create, update, remove }
}
