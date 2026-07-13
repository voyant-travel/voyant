import type { EventEnvelope } from "@voyant-travel/core"

export type OutboundWebhookEnqueueProvider = "postgres" | "host" | "none"

export interface OutboundWebhookDeliveryEnqueuer {
  enqueue(event: EventEnvelope, bindings: unknown): Promise<unknown>
}

export interface ResolveOutboundWebhookDeliveryEnqueuerOptions {
  provider?: string
  createPostgres?: () => OutboundWebhookDeliveryEnqueuer
  host?: OutboundWebhookDeliveryEnqueuer
}

/**
 * Resolve the deployment-owned enqueue implementation. An absent provider is
 * temporary compatibility for graphs generated before this provider role was
 * introduced: an injected host callback wins, then Postgres is the fallback.
 */
export function resolveOutboundWebhookDeliveryEnqueuer(
  options: ResolveOutboundWebhookDeliveryEnqueuerOptions,
): OutboundWebhookDeliveryEnqueuer | undefined {
  const provider = options.provider ?? (options.host ? "host" : "postgres")

  if (provider === "none") return undefined
  if (provider === "host") {
    if (!options.host) {
      throw new Error('deployment provider outboundWebhooks="host" requires host.deliverEvent')
    }
    return options.host
  }
  if (provider === "postgres") {
    if (!options.createPostgres) {
      throw new Error(
        'deployment provider outboundWebhooks="postgres" requires a Postgres enqueue adapter',
      )
    }
    return options.createPostgres()
  }

  throw new Error(
    `deployment provider outboundWebhooks="${provider}" is not supported; expected postgres, host, or none`,
  )
}
