import type {
  EventEnvelope,
  ModuleContainer,
  Subscriber,
  SubscriberRuntimeDescriptor,
} from "@voyant-travel/core"

import type {
  RealtimeInvalidationHint,
  RealtimeMessage,
  RealtimeProvider,
  RealtimeRouteResult,
} from "./types.js"

export const ADMIN_INVALIDATION_PUBLICATION_RUNTIME_KEY =
  "realtime.admin-invalidation-publication" as const

export interface AdminInvalidationPublishErrorContext {
  readonly event: string
  readonly channel: string
}

/** Narrow runtime capability consumed by package-owned invalidation subscribers. */
export interface AdminInvalidationPublicationPort {
  publish(channel: string, message: RealtimeMessage): Promise<void>
  reportError(error: unknown, context: AdminInvalidationPublishErrorContext): void
}

export type AdminInvalidationRoute<TData = unknown> = (
  data: TData,
  envelope: EventEnvelope<TData>,
) => ReadonlyArray<string> | RealtimeRouteResult | undefined

export interface CreateAdminInvalidationSubscriberRuntimeOptions<TData = unknown> {
  /** Stable id matching the owning selected-graph subscriber declaration. */
  readonly id: string
  readonly eventType: string
  /** Returning `undefined` filters the event without publishing. */
  readonly route: AdminInvalidationRoute<TData>
}

export interface CreateAdminInvalidationSubscriberOptions<TData = unknown>
  extends Omit<CreateAdminInvalidationSubscriberRuntimeOptions<TData>, "id"> {
  readonly port: AdminInvalidationPublicationPort
}

export interface CreateAdminInvalidationPublicationPortOptions {
  provider: Pick<RealtimeProvider, "publish">
  onError?: (error: unknown, context: AdminInvalidationPublishErrorContext) => void
}

function isRouteResult(
  value: ReadonlyArray<string> | RealtimeRouteResult,
): value is RealtimeRouteResult {
  return !Array.isArray(value)
}

function resourceOf(event: string): string {
  const dot = event.indexOf(".")
  return dot === -1 ? event : event.slice(0, dot)
}

export function createAdminInvalidationPublicationPort(
  options: CreateAdminInvalidationPublicationPortOptions,
): AdminInvalidationPublicationPort {
  const reportError =
    options.onError ??
    ((error, context) => {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[realtime] publish failed for ${context.event} -> ${context.channel}: ${message}`,
      )
    })

  return {
    publish: (channel, message) => options.provider.publish(channel, message),
    reportError,
  }
}

export function registerAdminInvalidationPublicationPort(
  container: ModuleContainer,
  port: AdminInvalidationPublicationPort,
): void {
  container.register(ADMIN_INVALIDATION_PUBLICATION_RUNTIME_KEY, port)
}

async function publishAdminInvalidation<TData>(
  port: AdminInvalidationPublicationPort,
  eventType: string,
  route: AdminInvalidationRoute<TData>,
  envelope: EventEnvelope<TData>,
): Promise<void> {
  const result = route(envelope.data, envelope)
  if (result === undefined) return

  const channels = isRouteResult(result) ? result.channels : result
  const uniqueChannels = [...new Set(channels)]
  if (uniqueChannels.length === 0) return

  const hint: RealtimeInvalidationHint = {
    event: eventType,
    entity: resourceOf(eventType),
    ...(isRouteResult(result) ? result.hint : undefined),
  }

  await Promise.all(
    uniqueChannels.map(async (channel) => {
      try {
        await port.publish(channel, { event: eventType, data: hint })
      } catch (error) {
        try {
          port.reportError(error, { event: eventType, channel })
        } catch {
          // Error reporting is best-effort and must not reject event delivery.
        }
      }
    }),
  )
}

export function createAdminInvalidationSubscriber<TData>(
  options: CreateAdminInvalidationSubscriberOptions<TData>,
): Subscriber<TData> {
  return {
    event: options.eventType,
    inline: false,
    handler: async (envelope) => {
      if (envelope.name !== options.eventType) return
      await publishAdminInvalidation(options.port, options.eventType, options.route, envelope)
    },
  }
}

/**
 * Build one executable selected-graph subscriber descriptor. The descriptor is
 * inert until its owning graph declaration receives a runtime reference and a
 * realtime module bootstrap registers the publication port.
 */
export function createAdminInvalidationSubscriberRuntime<TData = unknown>(
  options: CreateAdminInvalidationSubscriberRuntimeOptions<TData>,
): SubscriberRuntimeDescriptor {
  const registeredEventBuses = new WeakSet<object>()

  return {
    id: options.id,
    eventType: options.eventType,
    register: ({ container, eventBus }) => {
      if (registeredEventBuses.has(eventBus)) return

      eventBus.subscribe<TData>(
        options.eventType,
        async (envelope) => {
          if (envelope.name !== options.eventType) return
          if (!container.has(ADMIN_INVALIDATION_PUBLICATION_RUNTIME_KEY)) return
          const port = container.resolve<AdminInvalidationPublicationPort>(
            ADMIN_INVALIDATION_PUBLICATION_RUNTIME_KEY,
          )
          await publishAdminInvalidation(port, options.eventType, options.route, envelope)
        },
        { inline: false },
      )
      registeredEventBuses.add(eventBus)
    },
  }
}
