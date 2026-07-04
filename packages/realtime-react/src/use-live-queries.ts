"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

import type { RealtimeClientMessage, RealtimeConnection } from "./connector.js"
import { useRealtimeContext } from "./provider.js"
import { type HintToQueryKeys, resolveInvalidationKeys } from "./query-keys.js"

export interface UseLiveQueriesOptions {
  /** Pause all subscriptions without unmounting. */
  enabled?: boolean
  /** Observe raw messages in addition to the invalidation behaviour. */
  onMessage?: (channel: string, message: RealtimeClientMessage) => void
  /** Called when token minting or subscription setup fails. */
  onError?: (error: unknown) => void
}

/**
 * The hook most screens need: subscribe to one or more channels and translate
 * each invalidation hint into `queryClient.invalidateQueries` calls, so
 * existing data-fetching screens go live without rewriting their data layer.
 *
 * `map` turns a hint (`{ entity, id }`) into the React Query keys to refetch.
 * Subscriptions are managed by a single effect (no hooks-in-a-loop); pass a
 * stable `channels` array (memoise in the caller) to avoid re-subscribing.
 */
export function useLiveQueries(
  channels: ReadonlyArray<string>,
  map: HintToQueryKeys,
  options: UseLiveQueriesOptions = {},
) {
  const queryClient = useQueryClient()
  const { connector, fetchToken } = useRealtimeContext()
  const { enabled = true, onMessage, onError } = options

  // Latest channels/map/callback read inside the effect without forcing a
  // re-subscribe on every render.
  const latest = useRef({ channels, map, onMessage, onError })
  latest.current = { channels, map, onMessage, onError }

  // Join on a stable signature so identical channel sets don't churn.
  const channelKey = channels.join("\u0000")

  useEffect(() => {
    // `channelKey` is "" iff there are no channels; referencing it here also
    // ties the effect to the channel-set signature for re-subscription.
    if (!enabled || channelKey.length === 0) return
    const channelList = latest.current.channels
    const connections: RealtimeConnection[] = []
    let cancelled = false
    const unsubscribeAll = () => {
      while (connections.length > 0) connections.pop()?.unsubscribe()
    }

    void fetchToken()
      .then(({ token }) => {
        if (cancelled) return
        for (const channel of channelList) {
          connections.push(
            connector.subscribe({
              channel,
              token,
              onMessage: (message) => {
                latest.current.onMessage?.(channel, message)
                for (const queryKey of resolveInvalidationKeys(message, latest.current.map)) {
                  void queryClient.invalidateQueries({ queryKey })
                }
              },
            }),
          )
        }
      })
      .catch((error: unknown) => {
        unsubscribeAll()
        if (!cancelled) latest.current.onError?.(error)
      })

    return () => {
      cancelled = true
      unsubscribeAll()
    }
    // channelKey captures the channel set; queryClient/connector/fetchToken are stable.
  }, [channelKey, enabled, connector, fetchToken, queryClient])
}
