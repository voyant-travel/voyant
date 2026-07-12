"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"

import { AdminRealtimeProvider } from "./admin.js"
import { createRealtimeChannelConnector, type RealtimeChannelCtor } from "./connector-cloud.js"
import type { RealtimeReactProviderProps } from "./provider.js"

export interface AdminWorkspaceRealtimeProviderProps {
  children: ReactNode
  fetcher: NonNullable<RealtimeReactProviderProps["fetcher"]>
  getApiUrl: () => string
  realtimeChannel: RealtimeChannelCtor
  useSession: () => { data?: unknown }
}

/**
 * Connects an authenticated admin workspace to the selected deployment's
 * realtime channel. Host applications only supply their auth and transport
 * adapters; session gating and live-query behavior remain package-owned.
 */
export function AdminWorkspaceRealtimeProvider({
  children,
  fetcher,
  getApiUrl,
  realtimeChannel,
  useSession,
}: AdminWorkspaceRealtimeProviderProps) {
  const { data: session } = useSession()
  const connector = useMemo(
    () => createRealtimeChannelConnector(realtimeChannel, { baseUrl: getApiUrl() }),
    [getApiUrl, realtimeChannel],
  )

  return (
    <AdminRealtimeProvider
      connector={connector}
      session={session}
      tokenEndpoint={`${getApiUrl()}/v1/admin/realtime/token`}
      fetcher={fetcher}
    >
      {children}
    </AdminRealtimeProvider>
  )
}
