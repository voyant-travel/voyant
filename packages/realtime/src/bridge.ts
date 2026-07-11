import type { Subscriber } from "@voyant-travel/core"
import {
  createAdminInvalidationPublicationPort,
  createAdminInvalidationSubscriber,
} from "./admin-invalidation-subscriber.js"
import type { RealtimeProvider, RealtimeRoute, RealtimeRoutes } from "./types.js"

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
  const port = createAdminInvalidationPublicationPort({
    provider: options.provider,
    onError: options.onError,
  })

  return Object.entries(options.routes).map(([event, route]) =>
    createAdminInvalidationSubscriber({
      port,
      eventType: event,
      route: route as RealtimeRoute,
    }),
  )
}
