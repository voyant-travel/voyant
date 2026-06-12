/**
 * Outbound-HTTP resilience primitives (RFC voyant#1687 Phase 3.3).
 *
 * Every outbound call from a Worker burns request CPU/subrequest budget
 * (now platform-enforced per plan tier), so a slow third-party must
 * fail fast, a flaky one must retry with jitter instead of hammering,
 * and a down one must trip a breaker instead of cascading. These are
 * the defaults the plugin clients (e-invoicing, CMS sync, payments)
 * and channel push wrap their fetches with — consumers stop
 * hand-rolling them.
 */

export interface RetryOptions {
  /** Max attempts INCLUDING the first. Default 3. */
  attempts?: number
  /** Base backoff before the 2nd attempt; doubles per retry. Default 250ms. */
  baseDelayMs?: number
  /** Backoff ceiling. Default 4s. */
  maxDelayMs?: number
  /**
   * Which failures retry. Defaults to network errors, timeouts, 429 and
   * 5xx responses — for requests considered idempotent (see
   * `retryNonIdempotent` on {@link ResilientFetchOptions}).
   */
  retryOn?: (result: { response?: Response; error?: unknown }) => boolean
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. Default 5. */
  failureThreshold?: number
  /** How long an open circuit rejects immediately. Default 30s. */
  openMs?: number
}

/**
 * Minimal consecutive-failure circuit breaker. Half-open after
 * `openMs`: the next call probes; success closes, failure re-opens.
 * State is per-isolate (Workers have many isolates — the breaker bounds
 * each isolate's contribution to a hammering herd rather than providing
 * a global cutoff, which is the right scope for edge runtimes).
 */
export interface CircuitBreaker {
  /** Throws {@link CircuitOpenError} when open. */
  assertClosed(): void
  recordSuccess(): void
  recordFailure(): void
  readonly state: "closed" | "open" | "half-open"
}

export class CircuitOpenError extends Error {
  readonly retryAfterMs: number
  constructor(retryAfterMs: number) {
    super(`circuit open; retry in ~${Math.ceil(retryAfterMs / 1000)}s`)
    this.name = "CircuitOpenError"
    this.retryAfterMs = retryAfterMs
  }
}

export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 5
  const openMs = options.openMs ?? 30_000
  let consecutiveFailures = 0
  let openedAt: number | null = null
  let probing = false

  function currentState(): "closed" | "open" | "half-open" {
    if (openedAt === null) return "closed"
    if (Date.now() - openedAt >= openMs) return "half-open"
    return "open"
  }

  return {
    get state() {
      return currentState()
    },
    assertClosed() {
      const state = currentState()
      if (state === "closed") return
      if (state === "half-open" && !probing) {
        // One probe through; everyone else keeps getting rejected until
        // the probe settles.
        probing = true
        return
      }
      const elapsed = Date.now() - (openedAt ?? 0)
      throw new CircuitOpenError(Math.max(0, openMs - elapsed))
    },
    recordSuccess() {
      consecutiveFailures = 0
      openedAt = null
      probing = false
    },
    recordFailure() {
      consecutiveFailures += 1
      probing = false
      if (consecutiveFailures >= failureThreshold) {
        openedAt = Date.now()
      }
    },
  }
}

export interface ResilientFetchOptions {
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number
  /** Retry policy. `false` disables retries. */
  retry?: RetryOptions | false
  /**
   * Retries default to idempotent methods only (GET/HEAD/PUT/DELETE).
   * POSTs against APIs with their own idempotency keys (most payment /
   * e-invoicing providers) can opt in.
   */
  retryNonIdempotent?: boolean
  /** Optional breaker — share one per upstream service. */
  breaker?: CircuitBreaker
  /** Injection point for tests. Defaults to global fetch. */
  fetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"])

function defaultRetryOn(result: { response?: Response; error?: unknown }): boolean {
  if (result.error) return !(result.error instanceof CircuitOpenError)
  if (!result.response) return false
  return result.response.status === 429 || result.response.status >= 500
}

function backoffDelay(attempt: number, base: number, cap: number): number {
  const exp = Math.min(base * 2 ** (attempt - 1), cap)
  // Full jitter — desynchronizes retry herds across isolates.
  return Math.round(exp * (0.5 + Math.random() * 0.5))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * `fetch` with a per-attempt timeout, capped exponential retries with
 * full jitter, and an optional circuit breaker.
 *
 * Defaults: 10s timeout, 3 attempts on network errors/timeouts/429/5xx —
 * but only for idempotent methods unless `retryNonIdempotent` is set.
 * 4xx responses (other than 429) are returned, never retried. Breaker
 * failures count once per attempt; a `CircuitOpenError` is thrown
 * without touching the network.
 */
export async function resilientFetch(
  input: string | URL | Request,
  init: RequestInit = {},
  options: ResilientFetchOptions = {},
): Promise<Response> {
  // Normalized signature: runtime fetch types differ across Workers/Node
  // type libs (CF's generics over Request/CfProperties); the structural
  // shape is identical.
  const fetchImpl =
    options.fetchImpl ??
    (fetch as unknown as (input: string | URL | Request, init?: RequestInit) => Promise<Response>)
  const timeoutMs = options.timeoutMs ?? 10_000
  const method = (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
  const retriesAllowed =
    options.retry !== false && (IDEMPOTENT_METHODS.has(method) || options.retryNonIdempotent)
  const retry = options.retry === false ? undefined : options.retry
  const attempts = retriesAllowed ? (retry?.attempts ?? 3) : 1
  const retryOn = retry?.retryOn ?? defaultRetryOn
  const baseDelayMs = retry?.baseDelayMs ?? 250
  const maxDelayMs = retry?.maxDelayMs ?? 4_000

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    options.breaker?.assertClosed()

    const controller = new AbortController()
    const timer = setTimeout(
      () => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
    // Compose with a caller-supplied signal when present.
    if (init.signal) {
      const upstream = init.signal
      if (upstream.aborted) controller.abort(upstream.reason)
      else upstream.addEventListener("abort", () => controller.abort(upstream.reason))
    }

    try {
      // Cast: CF's lib types Request with its own generics; the runtime
      // value is the same structural Request either way.
      const requestInput = (input instanceof Request ? input.clone() : input) as Parameters<
        typeof fetchImpl
      >[0]
      const response = await fetchImpl(requestInput, { ...init, signal: controller.signal })
      if (response.ok || !retryOn({ response })) {
        if (response.ok) options.breaker?.recordSuccess()
        else if (response.status >= 500 || response.status === 429) {
          options.breaker?.recordFailure()
        } else {
          // 4xx = upstream is alive and judging our request; not a
          // service-health signal either way.
          options.breaker?.recordSuccess()
        }
        return response
      }
      options.breaker?.recordFailure()
      lastError = new Error(`upstream responded ${response.status}`)
      // Drain/cancel so the runtime doesn't hold the body across retries.
      await response.body?.cancel().catch(() => {})
    } catch (error) {
      if (error instanceof CircuitOpenError) throw error
      options.breaker?.recordFailure()
      lastError = error
      if (!retryOn({ error })) throw error
    } finally {
      clearTimeout(timer)
    }

    if (attempt < attempts) {
      await sleep(backoffDelay(attempt, baseDelayMs, maxDelayMs))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
