"use client"

import type { AdminChildProvider } from "@voyant-travel/admin/providers/operator-admin-shell"
import { RealtimeChannel } from "@voyant-travel/cloud-sdk"
import {
  AdminRealtimeProvider,
  createRealtimeChannelConnector,
  hasAdminRealtimeSession,
} from "@voyant-travel/realtime-react"
import { useMemo } from "react"
import { authClient } from "@/lib/auth"
import { getApiUrl } from "@/lib/env"
import { projectFetcher } from "@/lib/voyant-fetcher"

export { hasAdminRealtimeSession }

/**
 * Admin-shell child provider that makes every admin screen live via hint-driven
 * React Query invalidation (dashboard, product/contact/booking/invoice/… lists
 * and detail pages), keeping each screen's polling/staleTime as a fallback.
 * Subscribes over the Voyant Cloud `RealtimeChannel`, authenticated with a
 * scoped token minted by `POST /v1/admin/realtime/token`.
 */
export const RealtimeLiveProvider: AdminChildProvider = ({ children }) => {
  const { data: session } = authClient.useSession()
  const connector = useMemo(
    () => createRealtimeChannelConnector(RealtimeChannel, { baseUrl: getApiUrl() }),
    [],
  )
  return (
    <AdminRealtimeProvider
      connector={connector}
      session={session}
      tokenEndpoint={`${getApiUrl()}/v1/admin/realtime/token`}
      fetcher={projectFetcher}
    >
      {children}
    </AdminRealtimeProvider>
  )
}
