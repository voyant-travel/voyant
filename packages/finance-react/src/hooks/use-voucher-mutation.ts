"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { fetchWithValidation } from "../client.js"
import { useVoyantFinanceContext } from "../provider.js"
import { financeQueryKeys } from "../query-keys.js"
import {
  type VoucherRecord,
  type VoucherRedemptionResult,
  voucherRedemptionResponse,
  voucherSingleResponse,
} from "../schemas.js"

export interface IssueVoucherInput {
  code?: string | null
  currency: string
  amountCents: number
  issuedToPersonId?: string | null
  issuedToOrganizationId?: string | null
  sourceType: "refund" | "cancellation_credit" | "gift" | "manual" | "promo"
  sourceBookingId?: string | null
  sourcePaymentId?: string | null
  expiresAt?: string | null
  notes?: string | null
}

export interface UpdateVoucherInput {
  status?: VoucherRecord["status"]
  expiresAt?: string | null
  notes?: string | null
  issuedToPersonId?: string | null
  issuedToOrganizationId?: string | null
}

export interface RedeemVoucherInput {
  bookingId: string
  amountCents: number
  paymentId?: string | null
}

/**
 * Voucher mutations: issue a new voucher, update metadata (status / expiry /
 * notes / assignment — NOT balance), or redeem against a booking. The redeem
 * mutation is the only path that decrements `remainingAmountCents`; the
 * server runs it transactionally with a redemption row.
 */
export function useVoucherMutation() {
  const { baseUrl, fetcher } = useVoyantFinanceContext()
  const queryClient = useQueryClient()

  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: financeQueryKeys.vouchers() })

  const issue = useMutation({
    mutationFn: async (input: IssueVoucherInput) => {
      const { data } = await fetchWithValidation(
        "/v1/admin/finance/vouchers",
        voucherSingleResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidateLists()
      queryClient.setQueryData(financeQueryKeys.voucher(data.id), { data })
    },
  })

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateVoucherInput }) => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/vouchers/${id}`,
        voucherSingleResponse,
        { baseUrl, fetcher },
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (data) => {
      invalidateLists()
      queryClient.setQueryData(financeQueryKeys.voucher(data.id), { data })
    },
  })

  const redeem = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string
      input: RedeemVoucherInput
    }): Promise<VoucherRedemptionResult> => {
      const { data } = await fetchWithValidation(
        `/v1/admin/finance/vouchers/${id}/redeem`,
        voucherRedemptionResponse,
        { baseUrl, fetcher },
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (result) => {
      invalidateLists()
      // Invalidate the detail entry — the redemption row should show up in
      // the next `useVoucher` read.
      void queryClient.invalidateQueries({ queryKey: financeQueryKeys.voucher(result.voucher.id) })
    },
  })

  return { issue, update, redeem }
}
