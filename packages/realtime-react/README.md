# @voyant-travel/realtime-react

React hooks that make existing admin/portal screens live, consuming the channels
published by [`@voyant-travel/realtime`](../realtime). Vendor-agnostic — the
transport is injected as a `RealtimeConnector`.

Implements the React half of [RFC #1695](https://github.com/voyant-travel/voyant/issues/1695).

## Hooks

- **`useLiveQueries(channels, map)`** — the one most screens need. Subscribes to
  channels and translates each invalidation hint into
  `queryClient.invalidateQueries` calls, so screens go live without rewriting
  their data layer.
- **`useChannel(channel, { onMessage, onPresence })`** — subscribe to a single
  channel with auto token-mint, reconnect, and `sinceId` resume (vendor
  permitting).
- **`usePresence(channel, profile)`** — member list ("Ana is viewing this
  booking").

## Setup

```tsx
import { RealtimeChannel } from "@voyant-travel/cloud-sdk"
import {
  createRealtimeChannelConnector,
  RealtimeReactProvider,
} from "@voyant-travel/realtime-react"

// Adapt the Voyant Cloud RealtimeChannel into a connector.
const connector = createRealtimeChannelConnector(RealtimeChannel, { baseUrl: "/api" })

<QueryClientProvider client={queryClient}>
  <RealtimeReactProvider connector={connector} tokenEndpoint="/v1/admin/realtime/token">
    <App />
  </RealtimeReactProvider>
</QueryClientProvider>
```

`connector` is the injection seam: `createRealtimeChannelConnector` wraps the
cloud-sdk client, but any vendor (Ably, Pusher, a raw WebSocket/SSE wrapper)
works by implementing `RealtimeConnector` directly.

## Making the dashboard live

Replace the 60s polling fallback with hint-driven invalidation — keep the
interval as a safety net:

```tsx
import { useLiveQueries } from "@voyant-travel/realtime-react"
import { dashboardQueryKeys } from "@voyant-travel/admin/dashboard/query-options"

function DashboardLive() {
  useLiveQueries(["admin"], (hint) => {
    switch (hint.entity) {
      case "booking":
        return [dashboardQueryKeys.bookingsAggregates()]
      case "invoice":
        return [dashboardQueryKeys.financeAggregates()]
      default:
        return []
    }
  })
  return null
}
```

A missed hint self-heals on the next `staleTime` tick, so at-most-once delivery
is fine — keep `staleTime: 60_000` as the floor.

## The connector interface

```ts
interface RealtimeConnector {
  subscribe(options: {
    channel: string
    token: string
    onMessage?: (message: { event: string; data: unknown }) => void
    onPresence?: (members: ReadonlyArray<{ clientId: string; profile?: unknown }>) => void
    sinceId?: string
    profile?: unknown
  }): { unsubscribe(): void }
}
```
