"use client"

import { createContext, type ReactNode, useContext, useMemo } from "react"

import type { RealtimeConnector } from "./connector.js"

export type RealtimeTokenFetcher = () => Promise<{
  token: string
  expiresAt: string
} | null>

export interface RealtimeReactContextValue {
  connector: RealtimeConnector
  /** Fetches a fresh client token from the deployment's token-mint route. */
  fetchToken: RealtimeTokenFetcher
}

const RealtimeReactContext = createContext<RealtimeReactContextValue | null>(null)

export interface RealtimeReactProviderProps {
  /** Vendor-specific browser transport (Voyant Cloud, Ably, Pusher, …). */
  connector: RealtimeConnector
  /**
   * Token endpoint to call for a scoped client token. Defaults to
   * `/v1/public/realtime/token` (use the admin path for staff surfaces).
   */
  tokenEndpoint?: string
  /** Override the fetch implementation (defaults to credentialed `fetch`). */
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>
  /** Fully override token retrieval (takes precedence over `tokenEndpoint`). */
  fetchToken?: RealtimeTokenFetcher
  children: ReactNode
}

const defaultFetcher = (url: string, init?: RequestInit) =>
  fetch(url, { credentials: "include", ...init })

export function RealtimeReactProvider({
  connector,
  tokenEndpoint = "/v1/public/realtime/token",
  fetcher = defaultFetcher,
  fetchToken,
  children,
}: RealtimeReactProviderProps) {
  const value = useMemo<RealtimeReactContextValue>(() => {
    const resolveToken: RealtimeTokenFetcher =
      fetchToken ??
      (async () => {
        const response = await fetcher(tokenEndpoint, { method: "POST" })
        if (response.status === 204) return null
        if (!response.ok) {
          throw new Error(`Realtime token request failed: ${response.status}`)
        }
        const body = (await response.json()) as { data: { token: string; expiresAt: string } }
        return { token: body.data.token, expiresAt: body.data.expiresAt }
      })
    return { connector, fetchToken: resolveToken }
  }, [connector, tokenEndpoint, fetcher, fetchToken])

  return <RealtimeReactContext.Provider value={value}>{children}</RealtimeReactContext.Provider>
}

export function useRealtimeContext(): RealtimeReactContextValue {
  const context = useContext(RealtimeReactContext)
  if (!context) {
    throw new Error(
      "useRealtimeContext must be used inside <RealtimeReactProvider>. Wrap your app with <RealtimeReactProvider connector={...} />.",
    )
  }
  return context
}
