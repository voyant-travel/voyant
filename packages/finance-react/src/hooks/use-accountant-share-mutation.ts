"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import { accountantShareCreatedResponse, accountantShareRevokedResponse } from "../schemas.js"

export interface CreateAccountantShareInput {
  from?: string
  to?: string
  baseCurrency?: string
  ttlDays?: number
}

export function useAccountantShareMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const client = { baseUrl, fetcher }
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: financeQueryKeys.accountantShares() })

  const create = useMutation({
    mutationFn: async (input: CreateAccountantShareInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/finance/accountant-shares",
        accountantShareCreatedResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: invalidate,
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/accountant-shares/${id}/revoke`,
        accountantShareRevokedResponse,
        client,
        { method: "POST" },
      )
      return data
    },
    onSuccess: invalidate,
  })

  return { create, revoke }
}
