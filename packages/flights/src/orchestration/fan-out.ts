/**
 * Multi-connection fan-out search.
 *
 * Parallel `searchFlights` across all of an operator's flight connections
 * with per-connection timeouts, partial-success handling, and merge by
 * itinerary fingerprint. Returns a merged result set with the cheapest
 * offer per itinerary as the primary rank, alternates from other
 * connections beneath it, and a per-connection status map.
 *
 * Implements voyant-cloud's `MergedFlightOffer` shape so consumers see the
 * same result format regardless of where the orchestration runs.
 *
 * See `docs/architecture/catalog-flights-architecture.md` §4.
 */

import type { FlightAdapterContext, FlightConnectorAdapter } from "../contract/adapter.js"
import type { FlightOffer, FlightSearchRequest } from "../contract/types.js"
import { itineraryFingerprint } from "./fingerprint.js"

/**
 * One source's result — the primary offer plus alternates from other
 * connections selling the same flight.
 */
export interface MergedFlightOffer {
  itineraryFingerprint: string
  /** Cheapest offer for this itinerary across all responding connections. */
  cheapest: FlightOffer
  /** Other offers for the same itinerary, sorted by total price ascending. */
  alternates: FlightOffer[]
  /** Connection ids that returned an offer for this itinerary. */
  sourceConnectionIds: string[]
}

/**
 * Per-connection status, returned alongside the merged offers so callers
 * can surface "X provider timed out" without losing the rest of the results.
 */
export type ConnectionSearchStatus = "ok" | "timeout" | "error" | "not_found" | "capability_missing"

export interface ConnectionResult {
  connectionId: string
  status: ConnectionSearchStatus
  count: number
  latencyMs: number
  errorMessage?: string
}

export interface FanOutFlightSearchOptions {
  /** Adapters to fan out across. Each carries its own connectionId in capabilities. */
  adapters: ReadonlyArray<{
    connectionId: string
    adapter: FlightConnectorAdapter
    /** Optional override for the adapter context per connection. */
    context?: Partial<FlightAdapterContext>
  }>
  request: FlightSearchRequest
  /**
   * Per-connection timeout. Default 5000ms. One slow provider doesn't
   * tank the whole search — its slot is reported as `timeout` and other
   * results return on time.
   */
  perConnectionTimeoutMs?: number
  /**
   * Optional caller-supplied limit on the merged offer count. The fan-out
   * still queries every connection in full; this caps the merged result.
   */
  limit?: number
}

export interface FanOutFlightSearchResult {
  offers: MergedFlightOffer[]
  perConnection: ConnectionResult[]
}

/**
 * Fan out a flight search across an operator's connections, parallelized
 * with per-connection timeout, then merge by itinerary fingerprint.
 *
 * Partial-success semantics: connections that time out / error / report
 * capability-missing are flagged in `perConnection`; the orchestration
 * still returns whatever responding connections produced.
 */
export async function fanOutFlightSearch(
  options: FanOutFlightSearchOptions,
): Promise<FanOutFlightSearchResult> {
  const timeoutMs = options.perConnectionTimeoutMs ?? 5000

  const settled = await Promise.all(
    options.adapters.map(async ({ connectionId, adapter, context }) => {
      const start = Date.now()
      try {
        // Capability check up front. If the adapter declares a max-slices
        // limit and the request exceeds it, fail fast as `capability_missing`.
        const max = adapter.capabilities.maxSlicesPerSearch
        if (max != null && options.request.slices.length > max) {
          return {
            connectionId,
            status: "capability_missing" as const,
            offers: [] as FlightOffer[],
            latencyMs: Date.now() - start,
            errorMessage: `Connection supports max ${max} slices; request had ${options.request.slices.length}`,
          }
        }

        const ctx: FlightAdapterContext = { connectionId, ...context }
        const response = await withTimeout(
          adapter.searchFlights(ctx, options.request),
          timeoutMs,
          `connection ${connectionId} timed out after ${timeoutMs}ms`,
        )
        return {
          connectionId,
          status: "ok" as const,
          offers: response.offers,
          latencyMs: Date.now() - start,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isTimeout = message.includes("timed out")
        return {
          connectionId,
          status: isTimeout ? ("timeout" as const) : ("error" as const),
          offers: [] as FlightOffer[],
          latencyMs: Date.now() - start,
          errorMessage: message,
        }
      }
    }),
  )

  // Build per-connection status report.
  const perConnection: ConnectionResult[] = settled.map((r) => ({
    connectionId: r.connectionId,
    status: r.status,
    count: r.offers.length,
    latencyMs: r.latencyMs,
    errorMessage: r.errorMessage,
  }))

  // Group offers by itinerary fingerprint, building MergedFlightOffer per group.
  const merged = mergeByFingerprint(settled)

  // Sort merged offers by cheapest price ascending.
  merged.sort((a, b) => compareMoney(a.cheapest.totalPrice, b.cheapest.totalPrice))

  const limited = options.limit != null ? merged.slice(0, options.limit) : merged

  return { offers: limited, perConnection }
}

interface ConnectionFanOutOk {
  connectionId: string
  offers: FlightOffer[]
}

function mergeByFingerprint(
  results: ReadonlyArray<{ connectionId: string; offers: FlightOffer[] }>,
): MergedFlightOffer[] {
  const buckets = new Map<
    string,
    {
      offers: Array<{ connectionId: string; offer: FlightOffer }>
      sourceConnectionIds: Set<string>
    }
  >()

  for (const { connectionId, offers } of results) {
    for (const offer of offers) {
      const key = itineraryFingerprint(offer)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.offers.push({ connectionId, offer })
        bucket.sourceConnectionIds.add(connectionId)
      } else {
        buckets.set(key, {
          offers: [{ connectionId, offer }],
          sourceConnectionIds: new Set([connectionId]),
        })
      }
    }
  }

  const merged: MergedFlightOffer[] = []
  for (const [fingerprint, bucket] of buckets) {
    // Sort offers within the bucket by total price ascending.
    bucket.offers.sort((a, b) => compareMoney(a.offer.totalPrice, b.offer.totalPrice))
    const cheapestEntry = bucket.offers[0]
    if (!cheapestEntry) continue
    merged.push({
      itineraryFingerprint: fingerprint,
      cheapest: cheapestEntry.offer,
      alternates: bucket.offers.slice(1).map((entry) => entry.offer),
      sourceConnectionIds: Array.from(bucket.sourceConnectionIds),
    })
  }
  return merged
}

/**
 * Compare two `Money` values. Currencies must match — cross-currency
 * comparison would require live FX which the orchestration doesn't have.
 * Returns negative if `a < b`, positive if `a > b`, 0 if equal.
 */
function compareMoney(
  a: { amount: string; currency: string },
  b: { amount: string; currency: string },
): number {
  if (a.currency !== b.currency) {
    // Fall back to string compare on amount when currencies differ —
    // produces a stable but not-meaningful order. Real deployments
    // normalize currency upstream of the orchestration.
    return a.amount.localeCompare(b.amount)
  }
  const aNum = Number.parseFloat(a.amount)
  const bNum = Number.parseFloat(b.amount)
  return aNum - bNum
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ])
}

// Re-export the fan-out result variant types used by orchestration consumers.
export type { ConnectionFanOutOk }
