import type { EmitOptions, EventBus, EventMetadata, OutboxEventStore } from "@voyantjs/core"

/**
 * Wrap an {@link EventBus} so emits from within a request defer their
 * (non-`inline`) subscribers past the HTTP response via the request's
 * `executionCtx.waitUntil`. The response stops paying for subscriber
 * work — third-party syncs (CMS, e-invoicing), notifications, workflow
 * ingest — while `inline`-marked subscribers still complete before
 * `emit()` resolves.
 *
 * With a `store` (transactional outbox), emits are also DURABLE: the
 * envelope is persisted before any handler runs, and failed deliveries
 * are retried by the drain. If the durable capture itself fails (DB
 * unreachable), the emit falls back to direct (non-durable) delivery —
 * losing durability for that one event is strictly better than losing
 * the event, and an order of magnitude better than failing the request.
 *
 * Buses that predate the {@link EmitOptions} parameter simply ignore it
 * and keep awaiting all handlers — a safe degradation.
 */
export function requestScopedEventBus(
  bus: EventBus,
  schedule: (pending: Promise<unknown>) => void,
  store?: OutboxEventStore,
): EventBus {
  return {
    async emit<TData, TMetadata extends EventMetadata | undefined = EventMetadata | undefined>(
      event: string,
      data: TData,
      metadata?: TMetadata,
      options?: EmitOptions,
    ): Promise<void> {
      if (!store) {
        return bus.emit(event, data, metadata, { schedule, ...options })
      }
      try {
        return await bus.emit(event, data, metadata, { schedule, store, ...options })
      } catch (err) {
        // Only the outbox insert can reject (handler errors are
        // collected, bookkeeping failures are swallowed inside the bus).
        console.error(
          `[events] outbox capture failed for "${event}" — falling back to direct delivery:`,
          err,
        )
        return bus.emit(event, data, metadata, { schedule, ...options })
      }
    },
    subscribe(event, handler, options) {
      return bus.subscribe(event, handler, options)
    },
  }
}
