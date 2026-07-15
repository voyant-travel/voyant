"use client"

import { createContext, useContext } from "react"

export interface TeamManagementPageApi {
  get: <T>(path: string) => Promise<T>
  post: <T>(path: string, body: unknown) => Promise<T>
  put: <T>(path: string, body: unknown) => Promise<T>
  delete: <T = unknown>(path: string) => Promise<T>
}

export const TeamManagementPageApiContext = createContext<TeamManagementPageApi | null>(null)

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `API error: ${response.status} ${response.statusText}`,
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function createTeamManagementPageApi(
  baseUrl: string,
  fetcher: (url: string, init?: RequestInit) => Promise<Response>,
): TeamManagementPageApi {
  const request = async <T>(path: string, init: RequestInit): Promise<T> => {
    const headers = new Headers(init.headers)
    if (init.body !== undefined) headers.set("Content-Type", "application/json")
    return readJson(await fetcher(joinUrl(baseUrl, path), { ...init, headers }))
  }
  return {
    get: (path) => request(path, { method: "GET" }),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
    delete: (path) => request(path, { method: "DELETE" }),
  }
}

export function useTeamManagementPageApi() {
  const api = useContext(TeamManagementPageApiContext)
  if (!api) throw new Error("TeamManagementPage requires its API provider.")
  return api
}
