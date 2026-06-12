import type { EmitOptions, EventBus, EventMetadata } from "@voyantjs/core"

/**
 * Wrap an {@link EventBus} so emits from within a request defer their
 * (non-`inline`) subscribers past the HTTP response via the request's
 * `executionCtx.waitUntil`. The response stops paying for subscriber
 * work — third-party syncs (CMS, e-invoicing), notifications, workflow
 * ingest — while `inline`-marked subscribers still complete before
 * `emit()` resolves.
 *
 * Buses that predate the {@link EmitOptions} parameter simply ignore it
 * and keep awaiting all handlers — a safe degradation.
 */
export function requestScopedEventBus(
  bus: EventBus,
  schedule: (pending: Promise<unknown>) => void,
): EventBus {
  return {
    emit<TData, TMetadata extends EventMetadata | undefined = EventMetadata | undefined>(
      event: string,
      data: TData,
      metadata?: TMetadata,
      options?: EmitOptions,
    ): Promise<void> {
      return bus.emit(event, data, metadata, { schedule, ...options })
    },
    subscribe(event, handler, options) {
      return bus.subscribe(event, handler, options)
    },
  }
}
