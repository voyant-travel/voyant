"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertContractTemplateVersionSchema } from "@voyant-travel/legal/contracts/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalContractTemplateVersionRecordSchema } from "../schemas.js"

export type CreateLegalContractTemplateVersionInput = z.input<
  typeof insertContractTemplateVersionSchema
>

export function useLegalContractTemplateVersionMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      templateId,
      input,
    }: {
      templateId: string
      input: CreateLegalContractTemplateVersionInput
    }) => {
      const data = await fetchWithValidation(
        `/v1/admin/legal/contracts/templates/${templateId}/versions`,
        legalContractTemplateVersionRecordSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return { templateId, data }
    },
    onSuccess: ({ templateId }) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.templates() })
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.template(templateId) })
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.templateVersions(templateId) })
    },
  })

  return { create }
}
