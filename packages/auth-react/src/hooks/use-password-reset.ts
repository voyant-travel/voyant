"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type FetchWithValidationOptions, VoyantApiError } from "../client.js"
import { useVoyantAuthContext } from "../provider.js"
import { authQueryKeys } from "../query-keys.js"

export interface RequestPasswordResetInput {
  email: string
  redirectTo?: string
}

export interface RequestPasswordResetResult {
  data: unknown
}

export interface ConfirmPasswordResetInput {
  token: string
  newPassword: string
}

export interface ConfirmPasswordResetResult {
  data: unknown
}

interface BetterAuthErrorBody {
  error?: string | { message?: unknown; code?: unknown }
  message?: unknown
  code?: unknown
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

function extractBetterAuthErrorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) {
    return fallback
  }

  const candidate = body as BetterAuthErrorBody
  if (typeof candidate.error === "string") {
    return candidate.error
  }

  if (
    typeof candidate.error === "object" &&
    candidate.error !== null &&
    "message" in candidate.error
  ) {
    return String(candidate.error.message)
  }

  if (candidate.message !== undefined) {
    return String(candidate.message)
  }

  return fallback
}

function hasBetterAuthError(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    (body as BetterAuthErrorBody).error !== undefined &&
    (body as BetterAuthErrorBody).error !== null
  )
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function betterAuthPost<TInput extends object, TResult>(
  path: string,
  input: TInput,
  client: FetchWithValidationOptions,
): Promise<TResult> {
  const response = await client.fetcher(joinUrl(client.baseUrl, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })

  const body = await readJson(response)
  if (!response.ok || hasBetterAuthError(body)) {
    throw new VoyantApiError(
      extractBetterAuthErrorMessage(
        body,
        `Voyant API error: ${response.status} ${response.statusText}`,
      ),
      response.status,
      body,
    )
  }

  return { data: body } as TResult
}

export function requestPasswordReset(
  input: RequestPasswordResetInput,
  client: FetchWithValidationOptions,
): Promise<RequestPasswordResetResult> {
  return betterAuthPost<RequestPasswordResetInput, RequestPasswordResetResult>(
    "/auth/request-password-reset",
    input,
    client,
  )
}

export function confirmPasswordReset(
  input: ConfirmPasswordResetInput,
  client: FetchWithValidationOptions,
): Promise<ConfirmPasswordResetResult> {
  return betterAuthPost<ConfirmPasswordResetInput, ConfirmPasswordResetResult>(
    "/auth/reset-password",
    input,
    client,
  )
}

export function useRequestPasswordReset() {
  const { baseUrl, fetcher } = useVoyantAuthContext()

  return useMutation({
    mutationFn: (input: RequestPasswordResetInput) =>
      requestPasswordReset(input, { baseUrl, fetcher }),
  })
}

export function useConfirmPasswordReset() {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ConfirmPasswordResetInput) =>
      confirmPasswordReset(input, { baseUrl, fetcher }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.authStatus() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentWorkspace() })
    },
  })
}
