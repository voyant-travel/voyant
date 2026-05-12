"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { type FetchWithValidationOptions, VoyantApiError } from "../client.js"
import { useVoyantAuthContext } from "../provider.js"
import { authQueryKeys } from "../query-keys.js"

export interface SignInEmailInput {
  email: string
  password: string
  callbackURL?: string
  rememberMe?: boolean
}

export interface SignInEmailResult {
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
  return typeof body === "object" && body !== null && "error" in body
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

export async function signInWithEmail(
  input: SignInEmailInput,
  client: FetchWithValidationOptions,
): Promise<SignInEmailResult> {
  const response = await client.fetcher(joinUrl(client.baseUrl, "/auth/sign-in/email"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      callbackURL: input.callbackURL,
      rememberMe: input.rememberMe,
    }),
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

  const statusResponse = await client.fetcher(joinUrl(client.baseUrl, "/auth/status"), {
    method: "GET",
  })
  if (!statusResponse.ok) {
    const statusBody = await readJson(statusResponse)
    throw new VoyantApiError(
      extractBetterAuthErrorMessage(
        statusBody,
        `Voyant API error: ${statusResponse.status} ${statusResponse.statusText}`,
      ),
      statusResponse.status,
      statusBody,
    )
  }

  return { data: body }
}

export function useSignIn() {
  const { baseUrl, fetcher } = useVoyantAuthContext()
  const queryClient = useQueryClient()

  const email = useMutation({
    mutationFn: (input: SignInEmailInput) => signInWithEmail(input, { baseUrl, fetcher }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.authStatus() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentUser() })
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.currentWorkspace() })
    },
  })

  return { email }
}
