"use client"

import type { AnalyticsPort } from "@voyant-travel/core/analytics"
import { createContext, type ReactNode, useContext, useMemo } from "react"

import { VoyantAnalyticsProvider } from "./analytics.js"

export type VoyantFetcher = (url: string, init?: RequestInit) => Promise<Response>

export const defaultFetcher: VoyantFetcher = (url, init) =>
  fetch(url, {
    credentials: "include",
    ...init,
  })

export interface VoyantReactContextValue {
  baseUrl: string
  fetcher: VoyantFetcher
}

const VoyantReactContext = createContext<VoyantReactContextValue | null>(null)

export interface VoyantReactProviderProps {
  baseUrl: string
  fetcher?: VoyantFetcher
  /**
   * Host-bound product analytics. Omit it and every surface under this
   * provider emits into a no-op — no vendor, no network call, no overhead.
   * See `./analytics.tsx`.
   */
  analytics?: AnalyticsPort
  children: ReactNode
}

export function VoyantReactProvider({
  baseUrl,
  fetcher,
  analytics,
  children,
}: VoyantReactProviderProps) {
  const value = useMemo<VoyantReactContextValue>(
    () => ({ baseUrl, fetcher: fetcher ?? defaultFetcher }),
    [baseUrl, fetcher],
  )

  return (
    <VoyantReactContext.Provider value={value}>
      <VoyantAnalyticsProvider analytics={analytics}>{children}</VoyantAnalyticsProvider>
    </VoyantReactContext.Provider>
  )
}

export function useVoyantReactContext(): VoyantReactContextValue {
  const context = useContext(VoyantReactContext)
  if (!context) {
    throw new Error(
      'useVoyantReactContext must be used inside <VoyantReactProvider>. Wrap your app with <VoyantReactProvider baseUrl="/api" />.',
    )
  }

  return context
}
