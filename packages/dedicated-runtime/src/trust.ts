import { timingSafeEqual } from "node:crypto"

/**
 * Pinned cross-repo constant: the header the platform dispatcher stamps on
 * every request it forwards to a dedicated (Cloud Run) app. The value is a
 * per-app shared secret. Do NOT rename — the platform side depends on it.
 */
export const ORIGIN_TRUST_HEADER = "x-voyant-origin-trust"

/**
 * Constant-time string comparison. Returns `false` for length mismatches
 * without leaking the comparison via early return timing (the length check is
 * unavoidable and is itself not secret-length-dependent beyond equality).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  if (aBytes.length !== bBytes.length) {
    // Still burn a comparison against a same-length buffer so a size probe
    // does not short-circuit measurably faster than a value mismatch.
    timingSafeEqual(aBytes, aBytes)
    return false
  }
  return timingSafeEqual(aBytes, bBytes)
}

/**
 * Verify that a request carries a valid origin-trust header for `secret`.
 */
export function verifyOriginTrust(request: Request, secret: string): boolean {
  const provided = request.headers.get(ORIGIN_TRUST_HEADER)
  if (provided === null) return false
  return constantTimeEqual(provided, secret)
}

export interface OriginTrustOptions {
  /**
   * Paths that skip the trust check entirely (exact match). Defaults to
   * `["/healthz"]` so container health probes never need the secret.
   */
  exemptPaths?: string[]
}

/**
 * Build a low-level trust gate. Returns a function that, given a request,
 * yields a `403` {@link Response} when the request must be rejected, or
 * `undefined` when it may proceed. Composable — used by {@link createNodeServer}
 * but exported so callers can wire it into their own server loop.
 */
export function originTrustMiddleware(secret: string, options: OriginTrustOptions = {}) {
  const exempt = new Set(options.exemptPaths ?? ["/healthz"])
  return (request: Request): Response | undefined => {
    const { pathname } = new URL(request.url)
    if (exempt.has(pathname)) return undefined
    if (verifyOriginTrust(request, secret)) return undefined
    return new Response("Forbidden: invalid origin trust", { status: 403 })
  }
}
