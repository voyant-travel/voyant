"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  CreateBidBody,
  CreateRfpBody,
  InviteSupplierBody,
  UpdateRfpBody,
} from "@voyant-travel/mice"

import { fetchWithValidation } from "../client.js"
import { useVoyantContext } from "../provider.js"
import { miceQueryKeys } from "../query-keys.js"
import {
  awardResponse,
  bidSingleResponse,
  invitationSingleResponse,
  rfpSingleResponse,
} from "../schemas.js"

const basePath = "/v1/admin/mice"

/**
 * Mutations for the sourcing funnel: create/update an RFP, invite a supplier,
 * submit a bid, and award the RFP to a winning bid. The funnel mutations
 * invalidate both the RFP list root and the specific RFP detail (which embeds
 * its invitations + bids), so the manage view refreshes in place. `awarded` /
 * `accepted` / `rejected` are reached only through `award`, never create/update
 * — that's enforced by the backend.
 */
export function useRfpMutation() {
  const { baseUrl, fetcher } = useVoyantContext()
  const queryClient = useQueryClient()
  const client = { baseUrl, fetcher }

  const invalidateRfp = (rfpId: string) => {
    void queryClient.invalidateQueries({ queryKey: miceQueryKeys.rfps() })
    void queryClient.invalidateQueries({ queryKey: miceQueryKeys.rfp(rfpId) })
  }

  const create = useMutation({
    mutationFn: async (input: CreateRfpBody) => {
      const { data } = await fetchWithValidation(`${basePath}/rfps`, rfpSingleResponse, client, {
        method: "POST",
        body: JSON.stringify(input),
      })
      return data
    },
    onSuccess: (rfp) => invalidateRfp(rfp.id),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...input }: UpdateRfpBody & { id: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/rfps/${id}`,
        rfpSingleResponse,
        client,
        { method: "PATCH", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (rfp) => invalidateRfp(rfp.id),
  })

  const invite = useMutation({
    mutationFn: async ({ rfpId, ...input }: InviteSupplierBody & { rfpId: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/rfps/${rfpId}/invitations`,
        invitationSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (invitation) => invalidateRfp(invitation.rfpId),
  })

  const createBid = useMutation({
    mutationFn: async ({ rfpId, ...input }: CreateBidBody & { rfpId: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/rfps/${rfpId}/bids`,
        bidSingleResponse,
        client,
        { method: "POST", body: JSON.stringify(input) },
      )
      return data
    },
    onSuccess: (bid) => invalidateRfp(bid.rfpId),
  })

  const award = useMutation({
    mutationFn: async ({ rfpId, bidId }: { rfpId: string; bidId: string }) => {
      const { data } = await fetchWithValidation(
        `${basePath}/rfps/${rfpId}/award`,
        awardResponse,
        client,
        { method: "POST", body: JSON.stringify({ bidId }) },
      )
      return data
    },
    onSuccess: (result) => invalidateRfp(result.rfp.id),
  })

  return { create, update, invite, createBid, award }
}
