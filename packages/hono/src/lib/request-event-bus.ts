import type { EmitOptions, EventBus, EventMetadata, OutboxEventStore } from "@voyant-travel/core"

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
 * unreachable), the emit falls back to direct (non-durable) delivery.
 * Once capture has succeeded, the wrapper must not redeliver directly:
 * the stored row owns completion/retry, and direct fallback would make
 * subscriber side effects ambiguous.
 *
 * Buses that predate the {@link EmitOptions} parameter simply ignore it
 * and keep awaiting all handlers — a safe degradation.
 */
export function requestScopedEventBus(
  bus: EventBus,
  schedule: ((pending: Promise<unknown>) => void) | undefined,
  store?: OutboxEventStore,
): EventBus {
  // Without a scheduler (Node/headless — no executionCtx), emits await
  // all handlers inline, exactly like the raw bus; the wrapper then only
  // exists to thread the outbox store through.
  const base: EmitOptions = schedule ? { schedule } : {}
  return {
    async emit<TData, TMetadata extends EventMetadata | undefined = EventMetadata | undefined>(
      event: string,
      data: TData,
      metadata?: TMetadata,
      options?: EmitOptions,
    ): Promise<void> {
      if (!store) {
        return bus.emit(event, data, metadata, { ...base, ...options })
      }
      let captureFailed = false
      const guardedStore: OutboxEventStore = {
        async insert(envelope) {
          try {
            return await store.insert(envelope)
          } catch (err) {
            captureFailed = true
            throw err
          }
        },
        complete: (id) => store.complete(id),
        fail: (id, error) => store.fail(id, error),
      }
      try {
        return await bus.emit(event, data, metadata, { ...base, store: guardedStore, ...options })
      } catch (err) {
        if (!captureFailed) {
          console.error(
            `[events] durable delivery failed for "${event}" after outbox capture:`,
            err,
          )
          return
        }
        console.error(
          `[events] outbox capture failed for "${event}" — falling back to direct delivery:`,
          err,
        )
        return bus.emit(event, data, metadata, { ...base, ...options })
      }
    },
    subscribe(event, handler, options) {
      return bus.subscribe(event, handler, options)
    },
  }
}
