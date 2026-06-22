import type { Subscriber } from "@voyant-travel/core"

import type {
  RealtimeInvalidationHint,
  RealtimeProvider,
  RealtimeRoute,
  RealtimeRouteResult,
  RealtimeRoutes,
} from "./types.js"

export interface CreateRealtimeBridgeOptions {
  /** Transport to publish through. */
  provider: RealtimeProvider
  /** Declarative event → channel routing table. */
  routes: RealtimeRoutes
  /**
   * Optional sink for publish failures. Defaults to `console.warn`. The bridge
   * never throws: a dropped hint self-heals on the next refetch, so a transport
   * blip must not break the emitting transaction.
   */
  onError?: (error: unknown, context: { event: string; channel: string }) => void
}

function isRouteResult(
  value: ReadonlyArray<string> | RealtimeRouteResult,
): value is RealtimeRouteResult {
  return !Array.isArray(value)
}

/** Derive the entity family from an event name (`booking.confirmed` → `booking`). */
function resourceOf(event: string): string {
  const dot = event.indexOf(".")
  return dot === -1 ? event : event.slice(0, dot)
}

/**
 * Build the deferred {@link Subscriber}s that fan domain events out to realtime
 * channels. The returned array plugs straight into `Plugin.subscribers` or a
 * module's `bootstrap` via `eventBus.subscribe`.
 *
 * Subscribers are **deferred** (`inline: false`) — they run after the HTTP
 * response via the runtime's scheduler (`executionCtx.waitUntil` on Workers),
 * so they never block the emitting transaction. Delivery is best-effort and
 * at-most-once by design; the published payload is an
 * {@link RealtimeInvalidationHint}, so a missed message self-heals on the next
 * client refetch.
 */
export function createRealtimeBridge(options: CreateRealtimeBridgeOptions): Subscriber[] {
  const { provider, routes } = options
  const onError =
    options.onError ??
    ((error, context) => {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[realtime] publish failed for ${context.event} → ${context.channel}: ${message}`,
      )
    })

  return Object.entries(routes).map(([event, route]) => ({
    event,
    inline: false,
    handler: async (envelope) => {
      const result = (route as RealtimeRoute)(envelope.data, envelope)
      const channels = isRouteResult(result) ? result.channels : result
      if (channels.length === 0) return

      const hint: RealtimeInvalidationHint = {
        event,
        entity: resourceOf(event),
        ...(isRouteResult(result) ? result.hint : undefined),
      }

      await Promise.all(
        channels.map((channel) =>
          provider
            .publish(channel, { event, data: hint })
            .catch((error: unknown) => onError(error, { event, channel })),
        ),
      )
    },
  }))
}
