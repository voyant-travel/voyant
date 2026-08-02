import {
  type CircuitBreaker,
  CircuitOpenError,
  type RetryOptions,
} from "@voyant-travel/utils/resilience"

/**
 * Outbound-HTTP resilience knobs for the SmartBill client. Every call goes
 * through `resilientFetch`, so a slow or down SmartBill fails fast instead
 * of burning the Worker request's CPU/subrequest budget. Retries only apply
 * to idempotent operations (GETs, PDF downloads, cancel/restore/delete);
 * document-creating calls (invoice/proforma create, conversion, reversal)
 * never retry because SmartBill has no idempotency keys.
 */
export interface SmartbillResilienceOptions {
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number
  /**
   * Retry tuning (attempts/backoff) for retry-eligible operations, or
   * `false` to disable retries entirely. Defaults to 3 attempts on network
   * errors/timeouts/429/5xx.
   */
  retry?: Pick<RetryOptions, "attempts" | "baseDelayMs" | "maxDelayMs"> | false
  /**
   * Override/share the circuit breaker. Defaults to one breaker per client
   * instance (clients are per-worker singletons, i.e. one per upstream).
   * Distinct from the SmartBill-specific rate-limit circuit (`rateLimit`),
   * which reacts to SmartBill's 403 quota responses.
   */
  breaker?: CircuitBreaker
}

/**
 * Retry on network errors/timeouts/429/5xx, but surface the FINAL failing
 * response to the caller instead of throwing, so `buildApiError` keeps the
 * upstream status + body (including SmartBill's rate-limit envelope).
 */
export function surfacingRetry(
  maxAttempts: number,
  tuning?: { baseDelayMs?: number; maxDelayMs?: number },
): RetryOptions {
  let failedAttempts = 0
  return {
    baseDelayMs: tuning?.baseDelayMs,
    maxDelayMs: tuning?.maxDelayMs,
    attempts: maxAttempts,
    retryOn: ({ response, error }) => {
      failedAttempts += 1
      if (failedAttempts >= maxAttempts) return false
      if (error) return !(error instanceof CircuitOpenError)
      const status = response?.status ?? 0
      return status === 429 || status >= 500
    },
  }
}
