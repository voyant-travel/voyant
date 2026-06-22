"use client"

import type { QueryKey } from "@tanstack/react-query"
import { dashboardQueryKeys } from "@voyant-travel/admin/dashboard/query-options"
import type { AdminChildProvider } from "@voyant-travel/admin/providers/operator-admin-shell"
import { RealtimeChannel } from "@voyant-travel/cloud-sdk"
import {
  createRealtimeChannelConnector,
  type RealtimeInvalidationHint,
  RealtimeReactProvider,
  useLiveQueries,
} from "@voyant-travel/realtime-react"
import { useMemo } from "react"
import { getApiUrl } from "@/lib/env"
import { operatorFetcher } from "@/lib/voyant-fetcher"

// Channels the admin dashboard listens on. Module-level constant so the
// subscription identity stays stable across renders.
const ADMIN_CHANNELS = ["admin"]

/**
 * Translate a bridge invalidation hint into the dashboard aggregate query keys
 * to refetch. Prefix keys (without the `from` window) match every cached
 * variant via React Query's partial matching, so a single hint refreshes all
 * time windows of an aggregate.
 */
function mapAdminHintToKeys(hint: RealtimeInvalidationHint): ReadonlyArray<QueryKey> {
  switch (hint.entity) {
    case "booking":
    case "payment":
      // `from`-windowed keys — match by prefix (see dashboardQueryKeys).
      return [["dashboard-bookings-aggregates"], ["dashboard-finance-aggregates"]]
    case "availability":
      return [dashboardQueryKeys.productsAggregates()]
    default:
      return []
  }
}

function DashboardLiveRegion() {
  useLiveQueries(ADMIN_CHANNELS, mapAdminHintToKeys)
  return null
}

/**
 * Admin-shell child provider that makes the dashboard live via hint-driven
 * React Query invalidation, keeping the 60s polling as a fallback. Subscribes
 * over the Voyant Cloud `RealtimeChannel`, authenticated with a scoped token
 * minted by `POST /v1/admin/realtime/token`.
 */
export const RealtimeLiveProvider: AdminChildProvider = ({ children }) => {
  const connector = useMemo(
    () => createRealtimeChannelConnector(RealtimeChannel, { baseUrl: getApiUrl() }),
    [],
  )
  return (
    <RealtimeReactProvider
      connector={connector}
      tokenEndpoint={`${getApiUrl()}/v1/admin/realtime/token`}
      fetcher={operatorFetcher}
    >
      <DashboardLiveRegion />
      {children}
    </RealtimeReactProvider>
  )
}
