import type { z } from "zod"

export type VoyantFetcher = (url: string, init?: RequestInit) => Promise<Response>

export const defaultFetcher: VoyantFetcher = (url, init) =>
  fetch(url, { credentials: "include", ...init })

export class VoyantApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "VoyantApiError"
    this.status = status
    this.body = body
  }
}

export interface FetchWithValidationOptions {
  baseUrl: string
  fetcher: VoyantFetcher
  surface?: "admin" | "public"
}

export async function fetchWithValidation<TOut>(
  path: string,
  schema: z.ZodType<TOut>,
  options: FetchWithValidationOptions,
  init?: RequestInit,
): Promise<TOut> {
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await options.fetcher(joinUrl(options.baseUrl, path), { ...init, headers })
  const body = await safeJson(response)

  if (!response.ok) {
    throw new VoyantApiError(errorMessage(response, body), response.status, body)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new VoyantApiError(
      `Voyant API response failed validation: ${parsed.error.message}`,
      response.status,
      body,
    )
  }

  return parsed.data
}

function errorMessage(response: Response, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error: unknown }).error
    if (typeof error === "string") return error
  }

  return `Voyant API error: ${response.status} ${response.statusText}`
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}
