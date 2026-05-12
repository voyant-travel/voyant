"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import { useVoyantAuthContext } from "../provider.js"
import { authQueryKeys } from "../query-keys.js"

export interface AcceptInvitationInput {
  invitationId?: string | undefined
  token?: string | undefined
}

export interface AcceptInvitationResult {
  data: unknown
}

const acceptInvitationResponseSchema = z.unknown()

function invitationIdFromInput(input: AcceptInvitationInput): string {
  const invitationId = input.invitationId ?? input.token
  if (!invitationId?.trim()) {
    throw new Error("Invitation token is required.")
  }

  return invitationId.trim()
}

export async function acceptInvitation(
  input: AcceptInvitationInput,
  client: FetchWithValidationOptions,
): Promise<AcceptInvitationResult> {
  const invitationId = invitationIdFromInput(input)
  const data = await fetchWithValidation(
    "/auth/organization/accept-invitation",
    acceptInvitationResponseSchema,
    client,
    {
      method: "POST",
      body: JSON.stringify({ invitationId }),
    },
  )

  return { data }
}

export function useAcceptInvitation() {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AcceptInvitationInput) => acceptInvitation(input, { baseUrl, fetcher }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentWorkspace() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.organizationMembers() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.organizationInvitations() })
    },
  })
}
