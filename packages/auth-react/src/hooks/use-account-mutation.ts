"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import { useVoyantAuthContext } from "../provider.js"
import { authQueryKeys } from "../query-keys.js"
import { useUpdateAccountProfile } from "./use-update-account-profile.js"

export type {
  UpdateAccountProfileInput,
  UpdateAccountProfileResult,
} from "./use-update-account-profile.js"
export {
  updateAccountProfile,
  useUpdateAccountProfile,
} from "./use-update-account-profile.js"

const accountMutationResultSchema = z.unknown()

export interface ChangeAccountPasswordInput {
  currentPassword: string
  newPassword: string
  revokeOtherSessions?: boolean
}

export interface RequestAccountEmailChangeInput {
  newEmail: string
  otp?: string
}

export interface ConfirmAccountEmailChangeInput {
  newEmail: string
  otp: string
}

export async function changeAccountPassword(
  input: ChangeAccountPasswordInput,
  client: FetchWithValidationOptions,
) {
  return fetchWithValidation("/auth/change-password", accountMutationResultSchema, client, {
    method: "POST",
    body: JSON.stringify({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      revokeOtherSessions: input.revokeOtherSessions,
    }),
  })
}

export async function requestAccountEmailChange(
  input: RequestAccountEmailChangeInput,
  client: FetchWithValidationOptions,
) {
  return fetchWithValidation(
    "/auth/email-otp/request-email-change",
    accountMutationResultSchema,
    client,
    {
      method: "POST",
      body: JSON.stringify({
        newEmail: input.newEmail,
        otp: input.otp,
      }),
    },
  )
}

export async function confirmAccountEmailChange(
  input: ConfirmAccountEmailChangeInput,
  client: FetchWithValidationOptions,
) {
  return fetchWithValidation("/auth/email-otp/change-email", accountMutationResultSchema, client, {
    method: "POST",
    body: JSON.stringify({
      newEmail: input.newEmail,
      otp: input.otp,
    }),
  })
}

export function useChangeAccountPassword() {
  const { baseUrl, fetcher } = useVoyantAuthContext()

  return useMutation({
    mutationFn: (input: ChangeAccountPasswordInput) =>
      changeAccountPassword(input, { baseUrl, fetcher }),
  })
}

export function useRequestAccountEmailChange() {
  const { baseUrl, fetcher } = useVoyantAuthContext()

  return useMutation({
    mutationFn: (input: RequestAccountEmailChangeInput) =>
      requestAccountEmailChange(input, { baseUrl, fetcher }),
  })
}

export function useConfirmAccountEmailChange() {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ConfirmAccountEmailChangeInput) =>
      confirmAccountEmailChange(input, { baseUrl, fetcher }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.authStatus() })
    },
  })
}

export function useAccountMutation() {
  return {
    updateProfile: useUpdateAccountProfile(),
    changePassword: useChangeAccountPassword(),
    requestEmailChange: useRequestAccountEmailChange(),
    confirmEmailChange: useConfirmAccountEmailChange(),
  }
}
