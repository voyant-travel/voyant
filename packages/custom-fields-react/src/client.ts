import type { z } from "zod"
export type VoyantFetcher = (url: string, init?: RequestInit) => Promise<Response>
export const defaultFetcher: VoyantFetcher = (url, init) =>
  fetch(url, { credentials: "include", ...init })
export interface FetchWithValidationOptions {
  baseUrl: string
  fetcher: VoyantFetcher
}
export async function fetchWithValidation<T>(
  path: string,
  schema: z.ZodType<T>,
  { baseUrl, fetcher }: FetchWithValidationOptions,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  })
  const body = await response.text().then((text) => (text ? JSON.parse(text) : undefined))
  if (!response.ok)
    throw new Error(
      typeof body?.error === "string" ? body.error : `Voyant API error: ${response.status}`,
    )
  return schema.parse(body)
}
