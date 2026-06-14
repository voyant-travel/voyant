import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { InviteToken } from "@/lib/types"

export function useInviteTokens(operatorId: string) {
  return useQuery({
    queryKey: queryKeys.inviteTokens.list(operatorId),
    queryFn: () =>
      api
        .get<{ data: InviteToken[] }>(`/v1/operators/${operatorId}/invite-tokens`)
        .then((r) => r.data),
    enabled: !!operatorId,
  })
}

export function useCreateInviteToken(operatorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      label?: string
      scopes: string[]
      grantId?: string
      expiresAt?: string
    }) =>
      api
        .post<{ data: InviteToken }>(`/v1/operators/${operatorId}/invite-tokens`, data)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inviteTokens.list(operatorId) })
      void qc.invalidateQueries({ queryKey: queryKeys.grants.list(operatorId) })
    },
  })
}

export function useRevokeInviteToken(operatorId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api
        .delete<{ data: InviteToken }>(`/v1/operators/${operatorId}/invite-tokens/${id}`)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inviteTokens.list(operatorId) })
    },
  })
}

export function useRedeemInvite(token: string) {
  return useMutation({
    mutationFn: () =>
      api.post<{ data: unknown }>(`/v1/invites/${token}/redeem`).then((r) => r.data),
  })
}

export function useInviteInfo(token: string) {
  return useQuery({
    queryKey: ["invite", token],
    queryFn: () =>
      api
        .get<{
          data: {
            operatorName: string
            scopes: string[]
            label: string | null
            expiresAt: string | null
          }
        }>(`/v1/invites/${token}`)
        .then((r) => r.data),
    enabled: !!token,
  })
}
