import {
  type CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
  type RetryOptions,
  resilientFetch,
} from "@voyantjs/utils/resilience"

import type { PayloadDocBody, PayloadFetch } from "./types.js"

/**
 * Outbound-HTTP resilience knobs for the Payload client. Every call goes
 * through `resilientFetch`, so a slow or down CMS fails fast instead of
 * burning the Worker request's CPU/subrequest budget.
 */
export interface PayloadResilienceOptions {
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number
  /**
   * Retry tuning (attempts/backoff), or `false` to disable retries.
   * Defaults to 3 attempts on network errors/timeouts/429/5xx. All Payload
   * calls are idempotent by construction — find is a GET, update PATCHes by
   * doc id, create is keyed by the unique `voyantId` field — so retries
   * apply to every call.
   */
  retry?: Pick<RetryOptions, "attempts" | "baseDelayMs" | "maxDelayMs"> | false
  /**
   * Override/share the circuit breaker. Defaults to one breaker per client
   * instance (clients are per-worker singletons, i.e. one per upstream).
   */
  breaker?: CircuitBreaker
}

/**
 * Retry on network errors/timeouts/429/5xx, but surface the FINAL failing
 * response to the caller instead of throwing, so the client's error mapping
 * keeps the upstream status + body.
 */
function surfacingRetry(
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

function createGlobalPayloadFetch(): PayloadFetch | undefined {
  if (typeof globalThis.fetch !== "function") return undefined
  return (input, init) => globalThis.fetch(input, init)
}

function headersForPluginFetch(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers || Array.isArray(headers)) {
    return Object.fromEntries(new Headers(headers).entries())
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) out[key] = String(value)
  return out
}

function asResilientFetch(fetchImpl: PayloadFetch): typeof fetch {
  return async (input, init = {}) => {
    const response = await fetchImpl(input instanceof Request ? input.url : String(input), {
      method: init.method ?? "GET",
      headers: headersForPluginFetch(init.headers),
      ...(typeof init.body === "string" ? { body: init.body } : {}),
    })
    if (response instanceof Response) return response
    return new Response(await response.text(), { status: response.status })
  }
}

/**
 * Options for {@link createPayloadClient}.
 */
export interface PayloadClientOptions {
  /**
   * Base URL of the Payload REST API including `/api` suffix.
   * Example: `"https://cms.example.com/api"`.
   */
  apiUrl: string
  /** Payload API key. Sent as `Authorization: ${apiKeyHeader} API-Key ${apiKey}`. */
  apiKey: string
  /**
   * Field on the Payload collection that stores the Voyant record's ID.
   * Defaults to `"voyantId"`. The Payload collection must declare this
   * field (unique recommended).
   */
  voyantIdField?: string
  /**
   * Header used to carry the API key. Defaults to `"users API-Key"` which
   * matches Payload's default `users` auth collection. Override if your
   * Payload deployment uses a different auth collection.
   */
  apiKeyAuthScheme?: string
  /** Override `fetch` (e.g. in tests). Defaults to global `fetch`. */
  fetch?: PayloadFetch
  /** Timeout/retry/circuit-breaker tuning. See {@link PayloadResilienceOptions}. */
  resilience?: PayloadResilienceOptions
}

/**
 * Result of a Payload "find" query, scoped to the fields the client reads.
 */
interface PayloadFindResponse {
  docs?: Array<{ id: string; [key: string]: unknown }>
  totalDocs?: number
}

export interface PayloadClient {
  /**
   * Create or update a document whose {@link PayloadClientOptions.voyantIdField}
   * equals `voyantId`.
   */
  upsertByVoyantId(
    collection: string,
    voyantId: string,
    body: PayloadDocBody,
  ): Promise<{ id: string; created: boolean }>
  /**
   * Delete a document whose `voyantId` field equals the given value. Returns
   * `false` if no matching document was found.
   */
  deleteByVoyantId(collection: string, voyantId: string): Promise<boolean>
  /** Find at most one document whose `voyantId` field equals the given value. */
  findByVoyantId(collection: string, voyantId: string): Promise<{ id: string } | null>
}

export function createPayloadClient(options: PayloadClientOptions): PayloadClient {
  const voyantIdField = options.voyantIdField ?? "voyantId"
  const authScheme = options.apiKeyAuthScheme ?? "users API-Key"
  const apiUrl = options.apiUrl.replace(/\/$/, "")
  const fetchImpl = options.fetch ?? createGlobalPayloadFetch()
  const resilience = options.resilience ?? {}
  // One breaker per upstream Payload deployment — the client is a
  // per-worker singleton, so a per-instance breaker has the right scope.
  const breaker = resilience.breaker ?? createCircuitBreaker()
  const timeoutMs = resilience.timeoutMs ?? 10_000
  const retryTuning = resilience.retry === false ? undefined : resilience.retry
  const maxAttempts = resilience.retry === false ? 1 : (retryTuning?.attempts ?? 3)

  function headers(): Record<string, string> {
    return {
      Authorization: `${authScheme} ${options.apiKey}`,
      "Content-Type": "application/json",
    }
  }

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
    if (!fetchImpl) {
      throw new Error("Payload client requires a fetch implementation")
    }
    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers: headers(),
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    const response = await resilientFetch(`${apiUrl}${path}`, init, {
      timeoutMs,
      breaker,
      // Every Payload call is idempotent by construction (keyed by the
      // unique voyantId field), so POST/PATCH retry alongside GET/DELETE.
      retryNonIdempotent: true,
      retry: surfacingRetry(maxAttempts, retryTuning),
      fetchImpl: asResilientFetch(fetchImpl),
    })
    // Payload sends JSON for all 2xx/4xx; pull both eagerly.
    let text = ""
    let json: unknown = null
    try {
      text = await response.text()
      json = text ? JSON.parse(text) : null
    } catch {
      // leave json as null, surface text
    }
    return { ok: response.ok, status: response.status, json, text }
  }

  async function findByVoyantId(
    collection: string,
    voyantId: string,
  ): Promise<{ id: string } | null> {
    const query = `where[${encodeURIComponent(voyantIdField)}][equals]=${encodeURIComponent(voyantId)}&limit=1&depth=0`
    const res = await request("GET", `/${collection}?${query}`)
    if (!res.ok) {
      throw new Error(`Payload findByVoyantId(${collection}) failed (${res.status}): ${res.text}`)
    }
    const body = (res.json ?? {}) as PayloadFindResponse
    const first = body.docs?.[0]
    if (!first) return null
    return { id: first.id }
  }

  async function upsertByVoyantId(
    collection: string,
    voyantId: string,
    body: PayloadDocBody,
  ): Promise<{ id: string; created: boolean }> {
    const existing = await findByVoyantId(collection, voyantId)
    const fullBody: PayloadDocBody = { ...body, [voyantIdField]: voyantId }
    if (existing) {
      const res = await request("PATCH", `/${collection}/${existing.id}`, fullBody)
      if (!res.ok) {
        throw new Error(
          `Payload update(${collection}/${existing.id}) failed (${res.status}): ${res.text}`,
        )
      }
      return { id: existing.id, created: false }
    }
    const res = await request("POST", `/${collection}`, fullBody)
    if (!res.ok) {
      throw new Error(`Payload create(${collection}) failed (${res.status}): ${res.text}`)
    }
    const json = (res.json ?? {}) as { doc?: { id?: string }; id?: string }
    const id = json.doc?.id ?? json.id
    if (!id) {
      throw new Error(`Payload create(${collection}) response missing id`)
    }
    return { id, created: true }
  }

  async function deleteByVoyantId(collection: string, voyantId: string): Promise<boolean> {
    const existing = await findByVoyantId(collection, voyantId)
    if (!existing) return false
    const res = await request("DELETE", `/${collection}/${existing.id}`)
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Payload delete(${collection}/${existing.id}) failed (${res.status}): ${res.text}`,
      )
    }
    return true
  }

  return { upsertByVoyantId, deleteByVoyantId, findByVoyantId }
}
