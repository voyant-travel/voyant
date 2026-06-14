"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { insertContractSignatureSchema } from "@voyant-travel/legal/contracts/validation"
import type { z } from "zod"

import { fetchWithValidation } from "../client.js"
import { useVoyantLegalContext } from "../provider.js"
import { legalQueryKeys } from "../query-keys.js"
import { legalContractSignatureRecordSchema } from "../schemas.js"

export type CreateLegalContractSignatureInput = z.input<typeof insertContractSignatureSchema>

export function useLegalContractSignatureMutation() {
  const { baseUrl, fetcher } = useVoyantLegalContext()
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: async ({
      contractId,
      input,
    }: {
      contractId: string
      input: CreateLegalContractSignatureInput
    }) => {
      const data = await fetchWithValidation(
        `/v1/admin/legal/contracts/${contractId}/sign`,
        legalContractSignatureRecordSchema,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return { contractId, data }
    },
    onSuccess: ({ contractId }) => {
      void queryClient.invalidateQueries({ queryKey: legalQueryKeys.contract(contractId) })
      void queryClient.invalidateQueries({
        queryKey: legalQueryKeys.contractSignatures(contractId),
      })
    },
  })

  return { create }
}
