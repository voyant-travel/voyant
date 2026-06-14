// @voyant-travel/workflows/rate-limit
//
// Reference rate limiter used by `ctx.step({ rateLimit: ... })`.
//
// A RateLimiter is a small interface: `acquire()` blocks (or throws,
// depending on `onLimit`) until `units` are available under `key` for
// a sliding window of `windowMs`. One shared limiter instance lives
// per tenant Worker process — callers wire it into `createStepHandler`
// via `{ rateLimiter: createInMemoryRateLimiter() }`.
//
// The in-memory impl is a token bucket: `capacity = limit`, refill
// rate = `limit / windowMs`. It's suitable for local dev and
// single-process deployments. Multi-region / sharded deployments
// should swap in a Durable-Object or Redis-backed implementation that
// shares state across isolates.

import type { Duration } from "../types.js"

export interface AcquireArgs {
  /** Bucket key — usually a tenant id, a url host, a user id, etc. */
  key: string
  /** Maximum units the bucket can hold. */
  limit: number
  /** Units the current call consumes. */
  units: number
  /** Refill window in ms. `limit` tokens per `windowMs`. */
  windowMs: number
  /** `queue` → wait until capacity; `fail` → throw immediately. */
  onLimit: "queue" | "fail"
  /** Forwarded from the run; limiter observes aborts during queue waits. */
  signal?: AbortSignal
}

export interface RateLimiter {
  acquire(args: AcquireArgs): Promise<void>
}

/** Error thrown when `onLimit === "fail"` and the bucket is empty. */
export class RateLimitExceededError extends Error {
  readonly code = "RATE_LIMITED"
  readonly retryAfterMs: number
  constructor(key: string, retryAfterMs: number) {
    super(`rate limit exceeded for key "${key}" (retry after ${retryAfterMs}ms)`)
    this.name = "RateLimitExceededError"
    this.retryAfterMs = retryAfterMs
  }
}

interface Bucket {
  tokens: number
  capacity: number
  refillPerMs: number
  lastRefillAt: number
}

export interface InMemoryLimiterOptions {
  /** Injectable clock, ms since epoch. Defaults to Date.now. */
  now?: () => number
  /** Injectable delay; defaults to setTimeout. Tests override this. */
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>
}

/**
 * Token-bucket rate limiter held in-process. Independent buckets per
 * `key`; bucket parameters (`capacity`, `refillPerMs`) come from the
 * `limit` / `windowMs` of the first `acquire` call and are updated on
 * subsequent calls that change them.
 */
export function createInMemoryRateLimiter(opts: InMemoryLimiterOptions = {}): RateLimiter {
  const now = opts.now ?? (() => Date.now())
  const delay = opts.delay ?? defaultDelay
  const buckets = new Map<string, Bucket>()

  return {
    async acquire(args) {
      if (args.units <= 0) return
      if (args.limit <= 0) {
        throw new Error(`rate-limit: "limit" must be > 0 (got ${args.limit}) for key "${args.key}"`)
      }
      if (args.windowMs <= 0) {
        throw new Error(
          `rate-limit: "windowMs" must be > 0 (got ${args.windowMs}) for key "${args.key}"`,
        )
      }
      if (args.units > args.limit) {
        // The step will never be admissible — short-circuit regardless
        // of onLimit to avoid hanging indefinitely under queue mode.
        throw new Error(
          `rate-limit: units (${args.units}) > limit (${args.limit}) for key "${args.key}" — step can never be admitted`,
        )
      }

      while (true) {
        const bucket = refill(buckets, args, now())
        if (bucket.tokens >= args.units) {
          bucket.tokens -= args.units
          return
        }
        const missing = args.units - bucket.tokens
        const waitMs = Math.ceil(missing / bucket.refillPerMs)
        if (args.onLimit === "fail") {
          throw new RateLimitExceededError(args.key, waitMs)
        }
        await delay(waitMs, args.signal)
        if (args.signal?.aborted) {
          throw args.signal.reason ?? new Error("rate-limit: aborted while queued")
        }
      }
    },
  }
}

function refill(buckets: Map<string, Bucket>, args: AcquireArgs, nowMs: number): Bucket {
  const refillPerMs = args.limit / args.windowMs
  let b = buckets.get(args.key)
  if (!b) {
    b = {
      tokens: args.limit,
      capacity: args.limit,
      refillPerMs,
      lastRefillAt: nowMs,
    }
    buckets.set(args.key, b)
    return b
  }
  // Re-parameterize if the caller changed limit / windowMs. Clamp
  // tokens to the new capacity so a shrink doesn't leave stale excess.
  if (b.capacity !== args.limit || b.refillPerMs !== refillPerMs) {
    b.capacity = args.limit
    b.refillPerMs = refillPerMs
    if (b.tokens > b.capacity) b.tokens = b.capacity
  }
  const elapsed = Math.max(0, nowMs - b.lastRefillAt)
  if (elapsed > 0) {
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillPerMs)
    b.lastRefillAt = nowMs
  }
  return b
}

function defaultDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new Error("aborted"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/** Normalize a Duration to milliseconds. Same units as `toMs` in ctx.ts. */
export function durationToMs(d: Duration): number {
  if (typeof d === "number") return d
  const m = /^(\d+)(ms|s|m|h|d|w)$/.exec(d)
  if (!m) throw new Error(`rate-limit: invalid duration "${d}"`)
  const n = Number(m[1])
  switch (m[2]) {
    case "ms":
      return n
    case "s":
      return n * 1_000
    case "m":
      return n * 60_000
    case "h":
      return n * 3_600_000
    case "d":
      return n * 86_400_000
    case "w":
      return n * 604_800_000
    default:
      throw new Error(`rate-limit: invalid duration "${d}"`)
  }
}
