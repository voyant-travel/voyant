import type { EventEnvelope } from "@voyant-travel/core"

export type OutboundWebhookEnqueueProvider = "postgres" | "host" | "none"

export interface OutboundWebhookDeliveryEnqueuer {
  enqueue(event: EventEnvelope, bindings: unknown): Promise<unknown>
}

export interface ResolveOutboundWebhookDeliveryEnqueuerOptions {
  provider: unknown
  createPostgres?: () => OutboundWebhookDeliveryEnqueuer
  host?: OutboundWebhookDeliveryEnqueuer
}

/** Resolve the graph-selected deployment enqueue implementation. */
export function resolveOutboundWebhookDeliveryEnqueuer(
  options: ResolveOutboundWebhookDeliveryEnqueuerOptions,
): OutboundWebhookDeliveryEnqueuer | undefined {
  const { provider } = options

  if (typeof provider !== "string" || provider.length === 0) {
    throw new Error("deployment provider outboundWebhooks must be explicitly selected")
  }

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
