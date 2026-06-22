"use client"

import { createContext, useContext } from "react"

export interface TeamSettingsPageApi {
  get: <T = unknown>(path: string) => Promise<T>
  post: <T = unknown>(path: string, body?: unknown) => Promise<T>
  put: <T = unknown>(path: string, body?: unknown) => Promise<T>
  delete: <T = unknown>(path: string) => Promise<T>
}

export const TeamSettingsPageApiContext = createContext<TeamSettingsPageApi | null>(null)

function joinUrl(baseUrl: string, path: string) {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const trimmedPath = path.startsWith("/") ? path : `/${path}`
  return `${trimmedBase}${trimmedPath}`
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = await response.text().catch(() => undefined)
    }
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `API error: ${response.status} ${response.statusText}`
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function createTeamSettingsPageApi(
  baseUrl: string,
  fetcher: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const request = async <T>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
    return readJson<T>(await fetcher(joinUrl(baseUrl, path), { ...init, headers }))
  }

  const api: TeamSettingsPageApi = {
    get: <T = unknown>(path: string) => request<T>(path, { method: "GET" }),
    post: <T = unknown>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    put: <T = unknown>(path: string, body?: unknown) =>
      request<T>(path, {
        method: "PUT",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    delete: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),
  }

  return api
}

export function useTeamSettingsPageApi() {
  const api = useContext(TeamSettingsPageApiContext)
  if (!api) throw new Error("TeamSettingsPage requires a TeamSettingsPageApiContext provider")
  return api
}
