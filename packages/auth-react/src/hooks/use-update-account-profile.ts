"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type FetchWithValidationOptions, fetchWithValidation } from "../client.js"
import { useVoyantAuthContext } from "../provider.js"
import { authQueryKeys } from "../query-keys.js"
import { type CurrentUser, currentUserSchema } from "../schemas.js"

export interface UpdateAccountProfileInput {
  firstName?: string | null
  lastName?: string | null
  locale?: string | null
  timezone?: string | null
}

export type UpdateAccountProfileResult = CurrentUser

export async function updateAccountProfile(
  input: UpdateAccountProfileInput,
  client: FetchWithValidationOptions,
): Promise<UpdateAccountProfileResult> {
  return fetchWithValidation("/auth/me", currentUserSchema, client, {
    method: "PATCH",
    body: JSON.stringify(profilePatchBody(input)),
  })
}

export function useUpdateAccountProfile() {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateAccountProfileInput) =>
      updateAccountProfile(input, { baseUrl, fetcher }),
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.currentUser(), user)
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.authStatus() })
    },
  })
}

function profilePatchBody(input: UpdateAccountProfileInput) {
  const body: UpdateAccountProfileInput = {}

  if ("firstName" in input) body.firstName = input.firstName
  if ("lastName" in input) body.lastName = input.lastName
  if ("locale" in input) body.locale = input.locale
  if ("timezone" in input) body.timezone = input.timezone

  return body
}
