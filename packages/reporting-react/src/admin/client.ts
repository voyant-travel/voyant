import type { z } from "zod"

/** Cookie-forwarding fetch signature shared by every Voyant `*-react` data client. */
export type VoyantFetcher = (url: string, init?: RequestInit) => Promise<Response>

export const defaultFetcher: VoyantFetcher = (url, init) =>
  fetch(url, { credentials: "include", ...init })

/** Error carrying the HTTP status so callers can branch on e.g. 409 conflicts. */
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

export interface ReportingClient {
  baseUrl: string
  fetcher: VoyantFetcher
}

function extractErrorMessage(status: number, statusText: string, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const error = (body as { error: unknown }).error
    if (typeof error === "string") return error
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message: unknown }).message)
    }
  }
  return `Reporting API error: ${status} ${statusText}`
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

/** Fetch + validate against a zod schema, raising {@link VoyantApiError} on failure. */
export async function fetchWithValidation<TOut>(
  path: string,
  schema: z.ZodType<TOut>,
  options: ReportingClient,
  init?: RequestInit,
): Promise<TOut> {
  const url = joinUrl(options.baseUrl, path)
  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const response = await options.fetcher(url, { ...init, headers })
  if (!response.ok) {
    const body = await safeJson(response)
    throw new VoyantApiError(
      extractErrorMessage(response.status, response.statusText, body),
      response.status,
      body,
    )
  }
  if (response.status === 204) return schema.parse(undefined)
  const body = await safeJson(response)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new VoyantApiError(
      `Reporting API response failed validation: ${parsed.error.message}`,
      response.status,
      body,
    )
  }
  return parsed.data
}
