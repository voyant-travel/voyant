"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type FetchWithValidationOptions, VoyantApiError, withQueryParams } from "../client.js"
import { useVoyantAuthContext } from "../provider.js"
import { authQueryKeys } from "../query-keys.js"

export interface VerifyEmailTokenInput {
  token: string
  email?: never
  otp?: never
}

export interface VerifyEmailOtpInput {
  email: string
  otp: string
  token?: never
}

export type VerifyEmailInput = VerifyEmailTokenInput | VerifyEmailOtpInput

export interface VerifyEmailResult {
  data: unknown
}

interface BetterAuthErrorBody {
  error?: string | { message?: unknown; code?: unknown } | null
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
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return false
  }

  return (body as BetterAuthErrorBody).error != null
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

function isOtpInput(input: VerifyEmailInput): input is VerifyEmailOtpInput {
  return "otp" in input
}

async function assertOkResponse(response: Response): Promise<unknown> {
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

  return body
}

export async function verifyEmail(
  input: VerifyEmailInput,
  client: FetchWithValidationOptions,
): Promise<VerifyEmailResult> {
  const response = isOtpInput(input)
    ? await client.fetcher(joinUrl(client.baseUrl, "/auth/email-otp/verify-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: input.email,
          otp: input.otp,
        }),
      })
    : await client.fetcher(
        joinUrl(client.baseUrl, withQueryParams("/auth/verify-email", { token: input.token })),
        { method: "GET" },
      )

  const body = await assertOkResponse(response)

  const statusResponse = await client.fetcher(joinUrl(client.baseUrl, "/auth/status"), {
    method: "GET",
  })
  await assertOkResponse(statusResponse)

  return { data: body }
}

export function useVerifyEmail() {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: VerifyEmailInput) => verifyEmail(input, { baseUrl, fetcher }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.authStatus() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentWorkspace() })
    },
  })
}
