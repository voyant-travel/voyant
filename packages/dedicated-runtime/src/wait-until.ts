import type { ExecutionContextLike } from "./types.js"

export interface WaitUntilRegistry {
  /**
   * Produce a fresh {@link ExecutionContextLike} for a single request. Every
   * promise passed to its `waitUntil` is tracked centrally so the process can
   * drain in-flight background work on shutdown.
   */
  context(): ExecutionContextLike
  /**
   * Wait for all currently-tracked promises to settle, or until `timeoutMs`
   * elapses — whichever comes first. Resolves (never rejects); individual
   * promise rejections are swallowed here since `waitUntil` work is
   * fire-and-forget by the Workers contract.
   */
  drain(timeoutMs?: number): Promise<void>
  /** Number of promises still in flight. Useful for tests and readiness. */
  pending(): number
}

/**
 * Track every `waitUntil` promise across requests so a resident Node process
 * can drain background work (outbox publishes, cache warms, event-bus fan-out)
 * before it exits — the behavior Cloudflare gives for free but Node does not.
 */
export function createWaitUntilRegistry(): WaitUntilRegistry {
  const inflight = new Set<Promise<unknown>>()

  function track(promise: Promise<unknown>): void {
    const tracked = Promise.resolve(promise).catch(() => {
      // waitUntil work is fire-and-forget; never let a rejection escape.
    })
    inflight.add(tracked)
    void tracked.finally(() => {
      inflight.delete(tracked)
    })
  }

  return {
    context(): ExecutionContextLike {
      return {
        waitUntil(promise: Promise<unknown>): void {
          track(promise)
        },
        passThroughOnException(): void {
          // no-op on Node
        },
      }
    },
    async drain(timeoutMs = 10_000): Promise<void> {
      if (inflight.size === 0) return
      const settled = Promise.allSettled([...inflight]).then(() => undefined)
      if (timeoutMs <= 0) {
        await settled
        return
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs)
        // Do not keep the event loop alive purely for the drain timeout.
        timer.unref?.()
      })
      await Promise.race([settled, timeout])
      if (timer) clearTimeout(timer)
    },
    pending(): number {
      return inflight.size
    },
  }
}
