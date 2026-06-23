"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertCustomFieldDefinitionSchema,
  updateCustomFieldDefinitionSchema,
} from "@voyant-travel/relationships/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { relationshipsQueryKeys } from "../query-keys.js"
import { customFieldDefinitionSingleResponse, successEnvelope } from "../schemas.js"

export type CreateCustomFieldDefinitionInput = z.infer<typeof insertCustomFieldDefinitionSchema>
export type UpdateCustomFieldDefinitionInput = z.infer<typeof updateCustomFieldDefinitionSchema>

export function useCustomFieldDefinitionMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateCustomFieldDefinitionInput) => {
      const { data } = await fetchWithValidation(
        "/v1/relationships/custom-fields",
        customFieldDefinitionSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.customFields() })
      queryClient.setQueryData(relationshipsQueryKeys.customFieldDefinition(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCustomFieldDefinitionInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/relationships/custom-fields/${id}`,
        customFieldDefinitionSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.customFields() })
      queryClient.setQueryData(relationshipsQueryKeys.customFieldDefinition(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetchWithValidation(
        `/v1/relationships/custom-fields/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: relationshipsQueryKeys.customFields() })
      queryClient.removeQueries({ queryKey: relationshipsQueryKeys.customFieldDefinition(id) })
    },
  })

  return { create, update, remove }
}
