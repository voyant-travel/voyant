"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { validatePublicTravelCredit } from "../operations.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import type { PublicValidateTravelCreditInput } from "../schemas.js"

export function usePublicTravelCreditValidationMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: PublicValidateTravelCreditInput) =>
      validatePublicTravelCredit({ baseUrl, fetcher }, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: financeQueryKeys.publicTravelCreditValidation(),
      })
    },
  })
}
