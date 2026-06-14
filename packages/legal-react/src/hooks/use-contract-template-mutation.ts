"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  insertContractTemplateSchema,
  updateContractTemplateSchema,
} from "@voyant-travel/legal/contracts/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalContractTemplateSingleResponse, successEnvelope } from "../schemas.js"

export type CreateLegalContractTemplateInput = z.input<typeof insertContractTemplateSchema>
export type UpdateLegalContractTemplateInput = z.input<typeof updateContractTemplateSchema>

export function useLegalContractTemplateMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async (input: CreateLegalContractTemplateInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/legal/contracts/templates",
        legalContractTemplateSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.templates() })
      queryClient.setQueryData(legalQueryKeys.template(data.id), data)
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateLegalContractTemplateInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/legal/contracts/templates/${id}`,
        legalContractTemplateSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.templates() })
      queryClient.setQueryData(legalQueryKeys.template(data.id), data)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) =>
      fetchWithValidation(
        `/v1/admin/legal/contracts/templates/${id}`,
        successEnvelope,
        { baseUrl, fetcher },
        { method: "DELETE" },
      ),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.templates() })
      queryClient.removeQueries({ queryKey: legalQueryKeys.template(id) })
      queryClient.removeQueries({ queryKey: legalQueryKeys.templateVersions(id) })
    },
  })

  return { create, update, remove }
}
