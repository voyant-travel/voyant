import { getRequest, getRequestHeaders } from "@tanstack/react-start/server"

import { ApiError } from "./api-client"
import { getApiUrl } from "./env"

export function getServerCookieHeader(): string | undefined {
  return getRequestHeaders().get("cookie") ?? undefined
}

/**
 * During SSR, fetchers must call the same origin the browser hit (Vite may
 * fall back to a different port when 3300 is taken). Reading the incoming
 * request lets API calls follow the actual dev-server URL instead of the
 * static `APP_URL` env var.
 */
export function getServerRequestOrigin(): string | undefined {
  try {
    return new URL(getRequest().url).origin
  } catch {
    return undefined
  }
}

interface ApiCallOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>
}

function resolveServerApiBase(): string {
  const origin = getServerRequestOrigin()
  return origin ? `${origin}/api` : getApiUrl()
}

function extractErrorMessage(status: number, statusText: string, body: unknown): string {
  let message = `API error: ${status} ${statusText}`
  if (typeof body === "object" && body !== null && "error" in body) {
    const errorField = (body as { error: unknown }).error
    if (typeof errorField === "string") {
      message = errorField
    } else if (typeof errorField === "object" && errorField !== null && "message" in errorField) {
      message = String((errorField as { message: string }).message)
    }
  }
  return message
}

export async function apiCallServer<T = unknown>(
  path: string,
  options: ApiCallOptions = {},
): Promise<T> {
  const { headers: customHeaders, ...fetchOptions } = options
  const apiUrl = resolveServerApiBase()
  const serverCookie = getServerCookieHeader()

  const headers = new Headers({
    "Content-Type": "application/json",
    ...customHeaders,
  })

  if (serverCookie && !headers.has("cookie")) {
    headers.set("cookie", serverCookie)
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...fetchOptions,
    headers,
    credentials: "include",
  })

  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = await response.text().catch(() => undefined)
    }

    throw new ApiError(
      extractErrorMessage(response.status, response.statusText, body),
      response.status,
      body,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export const serverApi = {
  fetch: apiCallServer,
  get: <T = unknown>(path: string, options?: ApiCallOptions) =>
    apiCallServer<T>(path, { ...options, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiCallOptions) =>
    apiCallServer<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiCallOptions) =>
    apiCallServer<T>(path, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiCallOptions) =>
    apiCallServer<T>(path, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T = unknown>(path: string, options?: ApiCallOptions) =>
    apiCallServer<T>(path, { ...options, method: "DELETE" }),
}
