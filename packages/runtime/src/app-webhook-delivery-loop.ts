import type { WebhookDeliveryWorker } from "@voyant-travel/webhook-delivery"

const DEFAULT_POLL_INTERVAL_MS = 1_000
const DEFAULT_DRAIN_LIMIT = 100

export interface WebhookDeliveryLoopOptions {
  intervalMs?: number
  drainLimit?: number
  onError?: (error: unknown) => void | Promise<void>
  setInterval?: typeof setInterval
  clearInterval?: typeof clearInterval
}

export interface WebhookDeliveryLoop {
  start(): void
  stop(): Promise<void>
  poll(): Promise<void>
}

/**
 * Run one app-owned delivery drain at a time in a resident Node process.
 * Durable database claims coordinate multiple hosts; this loop only prevents
 * overlapping drains inside one process and owns its timer lifecycle.
 */
export function createWebhookDeliveryLoop(
  worker: WebhookDeliveryWorker,
  options: WebhookDeliveryLoopOptions = {},
): WebhookDeliveryLoop {
  const intervalMs = positiveInteger(options.intervalMs, DEFAULT_POLL_INTERVAL_MS)
  const drainLimit = positiveInteger(options.drainLimit, DEFAULT_DRAIN_LIMIT)
  const setIntervalImpl = options.setInterval ?? setInterval
  const clearIntervalImpl = options.clearInterval ?? clearInterval
  let timer: ReturnType<typeof setInterval> | undefined
  let inFlight: Promise<void> | undefined

  const poll = (): Promise<void> => {
    if (inFlight) return inFlight
    const pending = worker
      .drain({ limit: drainLimit })
      .then(() => undefined)
      .catch(async (error: unknown) => {
        try {
          await options.onError?.(error)
        } catch {
          // Observability must not stop future delivery attempts.
        }
      })
      .finally(() => {
        if (inFlight === pending) inFlight = undefined
      })
    inFlight = pending
    return pending
  }

  return {
    start() {
      if (timer !== undefined) return
      timer = setIntervalImpl(() => {
        void poll()
      }, intervalMs)
      unrefTimer(timer)
      void poll()
    },
    async stop() {
      if (timer !== undefined) {
        clearIntervalImpl(timer)
        timer = undefined
      }
      await inFlight
    },
    poll,
  }
}

/** Backwards-compatible app-worker name; both workers share the same loop lifecycle. */
export const createAppWebhookDeliveryLoop = createWebhookDeliveryLoop
export type AppWebhookDeliveryLoop = WebhookDeliveryLoop
export type AppWebhookDeliveryLoopOptions = WebhookDeliveryLoopOptions

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback
}

function unrefTimer(timer: unknown): void {
  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref()
  }
}
