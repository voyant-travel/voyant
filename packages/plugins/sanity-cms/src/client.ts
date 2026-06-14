import {
  type CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
  type RetryOptions,
  resilientFetch,
} from "@voyant-travel/utils/resilience"

import type { SanityDocBody, SanityFetch } from "./types.js"

/**
 * Outbound-HTTP resilience knobs for the Sanity client. Every call goes
 * through `resilientFetch`, so a slow or down CMS fails fast instead of
 * burning the Worker request's CPU/subrequest budget.
 */
export interface SanityResilienceOptions {
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number
  /**
   * Retry tuning (attempts/backoff), or `false` to disable retries.
   * Defaults to 3 attempts on network errors/timeouts/429/5xx. All Sanity
   * calls are idempotent by construction — find is a GET, patch/delete
   * mutations are keyed by `_id`, create is keyed by the `voyantId` field —
   * so retries apply to every call.
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

function createGlobalSanityFetch(): SanityFetch | undefined {
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

function asResilientFetch(fetchImpl: SanityFetch): typeof fetch {
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
 * Options for {@link createSanityClient}.
 */
export interface SanityClientOptions {
  /** Sanity project ID (the short slug from sanity.io/manage). */
  projectId: string
  /** Sanity dataset (e.g. `"production"`). */
  dataset: string
  /**
   * Sanity API token with write access. Sent as
   * `Authorization: Bearer ${token}`.
   */
  token: string
  /**
   * Sanity API version (date-based, e.g. `"2024-01-01"`). Defaults to
   * `"2024-01-01"`.
   */
  apiVersion?: string
  /**
   * Field on the Sanity document that stores the Voyant record's ID.
   * Defaults to `"voyantId"`. A matching field (+unique index) must be
   * declared in the Sanity schema.
   */
  voyantIdField?: string
  /**
   * Sanity API host. Defaults to `"api.sanity.io"`. Override for regional
   * hosts, proxies, or self-hosted deployments.
   */
  apiHost?: string
  /** Override `fetch` (e.g. in tests). Defaults to global `fetch`. */
  fetch?: SanityFetch
  /** Timeout/retry/circuit-breaker tuning. See {@link SanityResilienceOptions}. */
  resilience?: SanityResilienceOptions
}

interface SanityQueryResponse {
  result?: { _id: string; [key: string]: unknown } | null
}

interface SanityMutateResponse {
  transactionId?: string
  results?: Array<{ id?: string; operation?: string }>
}

export interface SanityClient {
  /**
   * Create or replace a document whose {@link SanityClientOptions.voyantIdField}
   * equals `voyantId`.
   */
  upsertByVoyantId(
    documentType: string,
    voyantId: string,
    body: SanityDocBody,
  ): Promise<{ _id: string; created: boolean }>
  /**
   * Delete a document whose `voyantId` field equals the given value.
   * Returns `false` if no matching document was found.
   */
  deleteByVoyantId(documentType: string, voyantId: string): Promise<boolean>
  /** Find at most one document whose `voyantId` field equals the given value. */
  findByVoyantId(documentType: string, voyantId: string): Promise<{ _id: string } | null>
}

export function createSanityClient(options: SanityClientOptions): SanityClient {
  const apiVersion = options.apiVersion ?? "2024-01-01"
  const voyantIdField = options.voyantIdField ?? "voyantId"
  const apiHost = options.apiHost ?? "api.sanity.io"
  const baseUrl = `https://${options.projectId}.${apiHost}/v${apiVersion}/data`
  const fetchImpl = options.fetch ?? createGlobalSanityFetch()
  const resilience = options.resilience ?? {}
  // One breaker per upstream Sanity project — the client is a per-worker
  // singleton, so a per-instance breaker has the right scope.
  const breaker = resilience.breaker ?? createCircuitBreaker()
  const timeoutMs = resilience.timeoutMs ?? 10_000
  const retryTuning = resilience.retry === false ? undefined : resilience.retry
  const maxAttempts = resilience.retry === false ? 1 : (retryTuning?.attempts ?? 3)

  function headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
    }
  }

  async function request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
    if (!fetchImpl) {
      throw new Error("Sanity client requires a fetch implementation")
    }
    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers: headers(),
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    const response = await resilientFetch(`${baseUrl}${path}`, init, {
      timeoutMs,
      breaker,
      // Every Sanity call is idempotent by construction (mutations keyed by
      // _id / voyantId), so POST mutations retry alongside GET queries.
      retryNonIdempotent: true,
      retry: surfacingRetry(maxAttempts, retryTuning),
      fetchImpl: asResilientFetch(fetchImpl),
    })
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
    documentType: string,
    voyantId: string,
  ): Promise<{ _id: string } | null> {
    // GROQ parameters are JSON-encoded values attached as $-prefixed query params.
    const groq = `*[_type == $type && ${voyantIdField} == $vid][0]{_id}`
    const query = [
      `query=${encodeURIComponent(groq)}`,
      `$type=${encodeURIComponent(JSON.stringify(documentType))}`,
      `$vid=${encodeURIComponent(JSON.stringify(voyantId))}`,
    ].join("&")
    const res = await request("GET", `/query/${options.dataset}?${query}`)
    if (!res.ok) {
      throw new Error(`Sanity findByVoyantId(${documentType}) failed (${res.status}): ${res.text}`)
    }
    const body = (res.json ?? {}) as SanityQueryResponse
    const first = body.result
    if (!first) return null
    return { _id: first._id }
  }

  async function mutate(mutations: unknown[]): Promise<{
    ok: boolean
    status: number
    json: unknown
    text: string
  }> {
    return request("POST", `/mutate/${options.dataset}?returnIds=true&visibility=sync`, {
      mutations,
    })
  }

  async function upsertByVoyantId(
    documentType: string,
    voyantId: string,
    body: SanityDocBody,
  ): Promise<{ _id: string; created: boolean }> {
    const existing = await findByVoyantId(documentType, voyantId)
    const docFields: SanityDocBody = { ...body, [voyantIdField]: voyantId }
    if (existing) {
      const res = await mutate([{ patch: { id: existing._id, set: docFields } }])
      if (!res.ok) {
        throw new Error(
          `Sanity update(${documentType}/${existing._id}) failed (${res.status}): ${res.text}`,
        )
      }
      return { _id: existing._id, created: false }
    }
    const createDoc = { _type: documentType, ...docFields }
    const res = await mutate([{ create: createDoc }])
    if (!res.ok) {
      throw new Error(`Sanity create(${documentType}) failed (${res.status}): ${res.text}`)
    }
    const json = (res.json ?? {}) as SanityMutateResponse
    const id = json.results?.[0]?.id
    if (!id) {
      throw new Error(`Sanity create(${documentType}) response missing id`)
    }
    return { _id: id, created: true }
  }

  async function deleteByVoyantId(documentType: string, voyantId: string): Promise<boolean> {
    const existing = await findByVoyantId(documentType, voyantId)
    if (!existing) return false
    const res = await mutate([{ delete: { id: existing._id } }])
    if (!res.ok) {
      throw new Error(
        `Sanity delete(${documentType}/${existing._id}) failed (${res.status}): ${res.text}`,
      )
    }
    return true
  }

  return { upsertByVoyantId, deleteByVoyantId, findByVoyantId }
}
