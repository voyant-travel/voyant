"use client"

import { useEffect, useRef } from "react"

import type { PresenceMember, RealtimeClientMessage } from "./connector.js"
import { useRealtimeContext } from "./provider.js"

export interface UseChannelOptions {
  /** Called for each message delivered on the channel. */
  onMessage?: (message: RealtimeClientMessage) => void
  /** Called when the channel's presence set changes. */
  onPresence?: (members: ReadonlyArray<PresenceMember>) => void
  /** Resume marker for replay-capable vendors. */
  sinceId?: string
  /** Local presence profile announced to the channel. */
  profile?: unknown
  /** Set `false` to pause the subscription without unmounting. */
  enabled?: boolean
}

/**
 * Subscribe to a single realtime channel. Mints a token via the provider's
 * token route, opens a connection through the injected connector, and tears it
 * down on unmount / channel change. Vendor-agnostic — the transport is whatever
 * connector the `RealtimeReactProvider` was given.
 */
export function useChannel(channel: string | null | undefined, options: UseChannelOptions = {}) {
  const { connector, fetchToken } = useRealtimeContext()
  const { onMessage, onPresence, sinceId, profile, enabled = true } = options

  // Keep the latest callbacks without re-subscribing on every render.
  const handlers = useRef({ onMessage, onPresence })
  handlers.current = { onMessage, onPresence }

  useEffect(() => {
    if (!channel || !enabled) return
    let connection: { unsubscribe(): void } | null = null
    let cancelled = false

    void fetchToken().then(({ token }) => {
      if (cancelled) return
      connection = connector.subscribe({
        channel,
        token,
        sinceId,
        profile,
        onMessage: (message) => handlers.current.onMessage?.(message),
        onPresence: (members) => handlers.current.onPresence?.(members),
      })
    })

    return () => {
      cancelled = true
      connection?.unsubscribe()
    }
  }, [channel, enabled, sinceId, profile, connector, fetchToken])
}
