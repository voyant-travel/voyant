/**
 * High-level classification for public event consumers.
 *
 * - `domain` events represent business milestones that other modules or
 *   external integrations may reasonably care about.
 * - `internal` events are service/process signals that remain useful for
 *   subscribers, diagnostics, and automation, but are not part of the core
 *   business language.
 */
export type EventCategory = "domain" | "internal"

/**
 * Where an event was emitted from. This helps consumers understand whether
 * an event originated from a workflow boundary, a lower-level service, or a
 * transport/runtime edge.
 */
export type EventSource = "workflow" | "service" | "route" | "subscriber" | "system"

/**
 * Optional metadata attached to an emitted event.
 *
 * Templates and adapters may extend this with runtime-specific fields such as
 * correlation identifiers or delivery handles.
 */
export interface EventMetadata {
  category?: EventCategory
  source?: EventSource
  correlationId?: string
  causationId?: string
  [key: string]: unknown
}

/**
 * Standard event envelope delivered to subscribers.
 */
export interface EventEnvelope<
  TData = unknown,
  TMetadata extends EventMetadata | undefined = EventMetadata | undefined,
> {
  /** Event name, following the `<resource>.<pastTenseAction>` convention. */
  name: string
  /** Business payload emitted by the caller. */
  data: TData
  /** Optional metadata for source/taxonomy/tracing. */
  metadata?: TMetadata
  /** ISO timestamp indicating when the event was emitted. */
  emittedAt: string
}

/**
 * Event handler callback invoked when a subscribed event is emitted.
 */
export type EventHandler<
  TData = unknown,
  TMetadata extends EventMetadata | undefined = EventMetadata | undefined,
> = (event: EventEnvelope<TData, TMetadata>) => Promise<void> | void

/**
 * Subscription handle returned from {@link EventBus.subscribe}.
 *
 * Call `unsubscribe()` to remove the handler.
 */
export interface Subscription {
  unsubscribe(): void
}

/**
 * Abstract event bus interface. Implementations live in templates or plugins.
 *
 * Adapter examples:
 * - In-process (default, ships with core)
 * - Cloudflare Queues — edge-native
 * - Postgres-backed durable queue — for refund-saga-grade durability
 *
 * Event naming convention: `<resource>.<pastTenseAction>` in dot-case.
 * Examples: `booking.created`, `quote.accepted`, `payment.received`.
 */
/**
 * Per-subscription options.
 */
export interface SubscribeOptions {
  /**
   * Inline handlers complete before `emit()` resolves even when the
   * emitter supplies a deferral scheduler (see {@link EmitOptions}).
   * Use for the rare subscriber whose side effects must be visible to
   * the code that follows the emit (e.g. read-after-write within the
   * same request). Default `false` — handlers are deferrable.
   */
  inline?: boolean
}

/**
 * Per-emit options. Call sites normally omit this; runtime adapters
 * (e.g. `@voyantjs/hono`'s request-scoped bus) supply `schedule` so
 * deferrable handlers run after the HTTP response instead of blocking
 * it.
 */
export interface EmitOptions {
  /**
   * Receives a single promise covering all deferrable (non-`inline`)
   * handlers for this emit. When provided, `emit()` resolves after the
   * `inline` handlers only; the scheduler owns keeping the runtime
   * alive for the rest (Workers: `executionCtx.waitUntil`). When
   * omitted, all handlers complete before `emit()` resolves.
   */
  schedule?: (pending: Promise<unknown>) => void
}

export interface EventBusOptions {
  /**
   * Per-handler timeout in milliseconds. A handler that exceeds it is
   * logged and no longer awaited — it is NOT cancelled (JS can't), so
   * it may still finish in the background. Defaults to 15s, which
   * bounds how long one slow third-party subscriber (CMS sync,
   * e-invoicing API) can hold an emit. Set `false` to disable.
   */
  handlerTimeoutMs?: number | false
}

export interface EventBus {
  /** Emit an event. Fire-and-forget; subscribers cannot affect the emitter. */
  emit<TData, TMetadata extends EventMetadata | undefined = EventMetadata | undefined>(
    event: string,
    data: TData,
    metadata?: TMetadata,
    options?: EmitOptions,
  ): Promise<void>

  /** Subscribe to an event by name. Returns an unsubscribe handle. */
  subscribe<TData, TMetadata extends EventMetadata | undefined = EventMetadata | undefined>(
    event: string,
    handler: EventHandler<TData, TMetadata>,
    options?: SubscribeOptions,
  ): Subscription
}

const DEFAULT_HANDLER_TIMEOUT_MS = 15_000

interface RegisteredHandler {
  inline: boolean
}

/**
 * Create an in-process event bus.
 *
 * Handlers run **in parallel** — they are independent observers by
 * contract, so one slow subscriber doesn't serialize behind another.
 * Errors thrown by a handler are caught and logged and never affect the
 * emitter or sibling handlers ("subscribers are fire-and-forget").
 * Each handler is bounded by {@link EventBusOptions.handlerTimeoutMs}.
 *
 * When the emitter passes {@link EmitOptions.schedule}, handlers not
 * marked `inline` are handed to the scheduler as one promise and
 * `emit()` resolves without waiting for them — this is how the HTTP
 * runtime moves subscriber work (third-party syncs, notifications)
 * after the response.
 */
export function createEventBus(options: EventBusOptions = {}): EventBus {
  const handlers = new Map<string, Map<EventHandler, RegisteredHandler>>()
  const timeoutMs = options.handlerTimeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS

  /** Runs one handler; never rejects. */
  async function runHandler(event: string, handler: EventHandler, envelope: EventEnvelope) {
    try {
      if (timeoutMs === false) {
        await handler(envelope)
        return
      }
      let timer: ReturnType<typeof setTimeout> | null = null
      const timedOut = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs)
      })
      try {
        const result = await Promise.race([
          Promise.resolve(handler(envelope)).then(() => "done" as const),
          timedOut,
        ])
        if (result === "timeout") {
          // The handler keeps running detached — we just stop waiting.
          console.error(`[events] subscriber for "${event}" exceeded ${timeoutMs}ms; not awaited`)
        }
      } finally {
        if (timer !== null) clearTimeout(timer)
      }
    } catch (err) {
      // Subscribers are fire-and-forget — log and continue.
      console.error(`[events] subscriber error for "${event}":`, err)
    }
  }

  return {
    async emit<TData, TMetadata extends EventMetadata | undefined = EventMetadata | undefined>(
      event: string,
      data: TData,
      metadata?: TMetadata,
      emitOptions?: EmitOptions,
    ) {
      const registered = handlers.get(event)
      if (!registered || registered.size === 0) return
      const envelope: EventEnvelope<TData, TMetadata> = {
        name: event,
        data,
        emittedAt: new Date().toISOString(),
        ...(metadata === undefined ? {} : { metadata }),
      }

      const inline: EventHandler[] = []
      const deferrable: EventHandler[] = []
      for (const [handler, meta] of registered) {
        ;(meta.inline ? inline : deferrable).push(handler)
      }

      const run = (batch: EventHandler[]) =>
        Promise.all(batch.map((h) => runHandler(event, h, envelope as EventEnvelope))).then(
          () => undefined,
        )

      if (emitOptions?.schedule && deferrable.length > 0) {
        emitOptions.schedule(run(deferrable))
        if (inline.length > 0) await run(inline)
        return
      }

      await run([...inline, ...deferrable])
    },
    subscribe<TData, TMetadata extends EventMetadata | undefined = EventMetadata | undefined>(
      event: string,
      handler: EventHandler<TData, TMetadata>,
      subscribeOptions?: SubscribeOptions,
    ) {
      let registered = handlers.get(event)
      if (!registered) {
        registered = new Map()
        handlers.set(event, registered)
      }
      registered.set(handler as EventHandler, { inline: subscribeOptions?.inline ?? false })
      return {
        unsubscribe() {
          registered?.delete(handler as EventHandler)
        },
      }
    },
  }
}
