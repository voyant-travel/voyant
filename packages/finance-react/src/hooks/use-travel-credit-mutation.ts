"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import {
  type TravelCreditRecord,
  type TravelCreditRedemptionResult,
  travelCreditRedemptionResponse,
  travelCreditSingleResponse,
} from "../schemas.js"

export interface IssueTravelCreditInput {
  code?: string | null
  seriesCode?: string | null
  currency: string
  amountCents: number
  issuedToPersonId?: string | null
  issuedToOrganizationId?: string | null
  sourceType: "refund" | "cancellation_credit" | "gift" | "manual" | "goodwill" | "promotion"
  sourceBookingId?: string | null
  sourcePaymentId?: string | null
  validFrom?: string | null
  expiresAt?: string | null
  notes?: string | null
}

export interface UpdateTravelCreditInput {
  status?: TravelCreditRecord["status"]
  seriesCode?: string | null
  validFrom?: string | null
  expiresAt?: string | null
  notes?: string | null
  issuedToPersonId?: string | null
  issuedToOrganizationId?: string | null
}

export interface RedeemTravelCreditInput {
  idempotencyKey: string
  bookingId: string
  amountCents: number
  paymentId?: string | null
}

/**
 * Travel Credit mutations: issue new stored value, update metadata (status / expiry /
 * notes / assignment — NOT balance), or redeem against a booking. The redeem
 * mutation is the only path that decrements `remainingAmountCents`; the
 * server runs it transactionally with a redemption row.
 */
export function useTravelCreditMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: financeQueryKeys.travelCredits() })

  const issue = useMutation({
    mutationFn: async (input: IssueTravelCreditInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/finance/travel-credits",
        travelCreditSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidateLists()
      queryClient.setQueryData(financeQueryKeys.travelCredit(data.id), { data })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateTravelCreditInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/travel-credits/${id}`,
        travelCreditSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidateLists()
      queryClient.setQueryData(financeQueryKeys.travelCredit(data.id), { data })
    },
  })

  const redeem = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: RedeemTravelCreditInput
    }): Promise<TravelCreditRedemptionResult> => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/travel-credits/${id}/redeem`,
        travelCreditRedemptionResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (result) => {
      invalidateLists()
      // Invalidate the detail entry — the redemption row should show up in
      // the next `useTravelCredit` read.
      void queryClient.invalidateQueries({
        queryKey: financeQueryKeys.travelCredit(result.travelCredit.id),
      })
    },
  })

  return { issue, update, redeem }
}
