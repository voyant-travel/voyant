import {
  type CircuitBreaker,
  CircuitOpenError,
  createCircuitBreaker,
  type RetryOptions,
  resilientFetch,
} from "@voyantjs/utils/resilience"

import type {
  SmartbillEnvelope,
  SmartbillEstimateInvoicesResponse,
  SmartbillFetch,
  SmartbillInvoiceBody,
  SmartbillInvoiceResponse,
  SmartbillPdfResponse,
  SmartbillSeriesResponse,
  SmartbillStatusResponse,
  SmartbillTaxesResponse,
} from "./types.js"

// agent-quality: file-size exception -- SmartBill's broad API client remains co-located until endpoint groups are split.
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

/**
 * Options for {@link createSmartbillClient}.
 */
export interface SmartbillClientOptions {
  /** SmartBill account username (email). */
  username: string
  /** SmartBill API token. */
  apiToken: string
  /**
   * SmartBill API base URL. Defaults to `"https://ws.smartbill.ro/SBORO/api"`.
   */
  apiUrl?: string
  /** Override `fetch` (e.g. in tests). Defaults to global `fetch`. */
  fetch?: SmartbillFetch
  /** Optional process-local protection for SmartBill account rate limits. */
  rateLimit?: {
    /**
     * When enabled, the client opens a process-local circuit after the first
     * SmartBill rate-limit response and skips network calls until retry time.
     */
    circuitBreaker?: boolean
    /** Test hook for deterministic time. */
    now?: () => Date
  }
  /** Timeout/retry/circuit-breaker tuning. See {@link SmartbillResilienceOptions}. */
  resilience?: SmartbillResilienceOptions
}

export interface SmartbillClientApi {
  /** Create an invoice. Returns the live envelope: series + number + URL + status/message. */
  createInvoice(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse>
  /** Create a proforma invoice. */
  createProforma(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse>
  /** Create an invoice from an existing proforma estimate. */
  convertEstimateToInvoice(
    companyVatCode: string,
    estimateSeriesName: string,
    estimateNumber: string,
    body: SmartbillInvoiceBody,
  ): Promise<SmartbillInvoiceResponse>
  /** Cancel an invoice by series + number. Returns the live envelope. */
  cancelInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEnvelope>
  /** Restore a previously cancelled invoice. */
  restoreInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEnvelope>
  /** Delete an invoice by series + number. */
  deleteInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEnvelope>
  /** Reverse an invoice — issues a credit-note style reversal invoice. */
  reverseInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillInvoiceResponse>
  /** Download invoice PDF bytes. */
  viewInvoicePdf(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillPdfResponse>
  /**
   * Alias for {@link viewInvoicePdf}. Kept for backward compatibility with
   * earlier client versions that only exposed an invoice PDF method.
   */
  viewPdf(companyVatCode: string, seriesName: string, number: string): Promise<SmartbillPdfResponse>
  /** Download proforma PDF bytes. */
  viewEstimatePdf(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillPdfResponse>
  /** Get payment status for an invoice. */
  getPaymentStatus(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillStatusResponse>
  /** List taxes configured on the SmartBill account. */
  listTaxes(): Promise<SmartbillTaxesResponse>
  /** List document series configured on the SmartBill account. */
  listSeries(): Promise<SmartbillSeriesResponse>
  /** List invoices created from a proforma (conversion lookup). */
  listEstimateInvoices(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEstimateInvoicesResponse>
}

export interface SmartbillApiErrorOptions {
  operation: string
  status?: number
  body?: string
  response?: unknown
}

export class SmartbillApiError extends Error {
  readonly operation: string
  readonly status?: number
  readonly body?: string
  readonly response?: unknown

  constructor(message: string, options: SmartbillApiErrorOptions) {
    super(message)
    this.name = "SmartbillApiError"
    this.operation = options.operation
    this.status = options.status
    this.body = options.body
    this.response = options.response
  }
}

export interface SmartbillRateLimitErrorOptions extends SmartbillApiErrorOptions {
  retryAfterMs?: number
  retryAfterAt?: Date
  blockedAt?: Date
}

export class SmartbillRateLimitError extends SmartbillApiError {
  readonly retryAfterMs?: number
  readonly retryAfterAt?: Date
  readonly blockedAt?: Date

  constructor(message: string, options: SmartbillRateLimitErrorOptions) {
    super(message, options)
    this.name = "SmartbillRateLimitError"
    this.retryAfterMs = options.retryAfterMs
    this.retryAfterAt = options.retryAfterAt
    this.blockedAt = options.blockedAt
  }
}

export class SmartbillRateLimitCircuitOpenError extends SmartbillRateLimitError {
  constructor(options: SmartbillRateLimitErrorOptions) {
    super(
      `SmartBill rate-limit circuit is open${
        options.retryAfterMs !== undefined ? `; retry after ${options.retryAfterMs}ms` : ""
      }`,
      options,
    )
    this.name = "SmartbillRateLimitCircuitOpenError"
  }
}

interface ParsedSmartbillRateLimit {
  errorText: string
  retryAfterMs?: number
  retryAfterAt?: Date
  blockedAt?: Date
}

const RATE_LIMIT_TEXT_PATTERN =
  /limita\s+maxima\s+de\s+requesturi|vei\s+putea\s+executa\s+alte\s+requesturi/i
const RATE_LIMIT_MINUTES_PATTERN = /dupa\s+(\d+)\s*min/i
const RATE_LIMIT_DATE_PATTERN =
  /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})|(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseSmartbillDate(value: string) {
  const match = RATE_LIMIT_DATE_PATTERN.exec(value)
  if (!match) return undefined

  // Treat SmartBill's date string as UTC. The original code used `new
  // Date(y, m, d, ...)` which interprets components as the JS host's
  // local time, so the same response decoded to different instants on a
  // CI runner (UTC) vs. a developer machine (Europe/Bucharest, EEST).
  // The retry-window math downstream is duration-based (`retryAfterAt -
  // now`), so anchoring to UTC keeps the math deterministic and matches
  // the existing test fixtures that assert UTC timestamps.
  if (match[1]) {
    const [, day, month, year, hour, minute, second] = match
    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    )
  }

  const [, , , , , , , year, month, day, hour, minute, second] = match
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  )
}

function parseSmartbillRateLimit(
  status: number,
  parsed: unknown,
  now: Date,
): ParsedSmartbillRateLimit | null {
  if (!isRecord(parsed)) return null

  const errorText =
    typeof parsed.errorText === "string"
      ? parsed.errorText
      : typeof parsed.message === "string"
        ? parsed.message
        : ""
  if (status !== 403 && !RATE_LIMIT_TEXT_PATTERN.test(errorText)) return null
  if (!RATE_LIMIT_TEXT_PATTERN.test(errorText)) return null

  const minutesMatch = RATE_LIMIT_MINUTES_PATTERN.exec(errorText)
  const blockedAt = parseSmartbillDate(errorText)
  const minutes = minutesMatch?.[1] ? Number(minutesMatch[1]) : undefined
  const retryAfterAt =
    blockedAt && minutes !== undefined
      ? new Date(blockedAt.getTime() + minutes * 60_000)
      : typeof parsed.cooldown === "number" && parsed.cooldown > 0
        ? new Date(now.getTime() + parsed.cooldown * 1000)
        : undefined
  const retryAfterMs = retryAfterAt
    ? Math.max(0, retryAfterAt.getTime() - now.getTime())
    : undefined

  return {
    errorText,
    retryAfterMs,
    retryAfterAt,
    blockedAt,
  }
}

export function createSmartbillClient(options: SmartbillClientOptions): SmartbillClientApi {
  const apiUrl = (options.apiUrl ?? "https://ws.smartbill.ro/SBORO/api").replace(/\/$/, "")
  const fetchImpl = options.fetch ?? createGlobalSmartbillFetch()
  const now = options.rateLimit?.now ?? (() => new Date())
  let rateLimitCircuitOpenUntil: Date | undefined
  const resilience = options.resilience ?? {}
  // One breaker per upstream SmartBill account — the client is a per-worker
  // singleton, so a per-instance breaker has the right scope.
  const breaker = resilience.breaker ?? createCircuitBreaker()
  const timeoutMs = resilience.timeoutMs ?? 10_000
  const retryTuning = resilience.retry === false ? undefined : resilience.retry

  function maxAttemptsFor(retryable: boolean): number {
    return retryable && resilience.retry !== false ? (retryTuning?.attempts ?? 3) : 1
  }

  function authHeader(): string {
    return `Basic ${btoa(`${options.username}:${options.apiToken}`)}`
  }

  function headers(): Record<string, string> {
    return {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  }

  async function request<T extends SmartbillEnvelope>(
    operation: string,
    method: string,
    path: string,
    body?: unknown,
    requestOptions?: { retryable?: boolean },
  ): Promise<T> {
    if (!fetchImpl) {
      throw new Error("SmartBill client requires a fetch implementation")
    }
    assertRateLimitCircuitClosed(operation)
    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers: headers(),
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    // Default policy: GET/PUT/DELETE are idempotent against SmartBill (state
    // setters, lookups), POSTs create documents and must not retry. Call
    // sites override where the HTTP method is misleading (e.g. reverse).
    const retryable = requestOptions?.retryable ?? method !== "POST"
    const response = await resilientFetch(`${apiUrl}${path}`, init, {
      timeoutMs,
      breaker,
      // Per-operation policy above already gates retries via attempts.
      retryNonIdempotent: true,
      retry: surfacingRetry(maxAttemptsFor(retryable), retryTuning),
      fetchImpl: asResilientFetch(fetchImpl),
    })
    let text = ""
    let parsed: unknown = null
    try {
      text = await response.text()
      parsed = text ? JSON.parse(text) : null
    } catch {
      // leave parsed as null, surface text
    }
    if (!response.ok) {
      throw buildApiError(operation, response.status, text, parsed)
    }
    const envelope = (parsed ?? {}) as T
    if (envelope.status === "Error" || envelope.errorText) {
      throw buildApiError(operation, response.status, text, parsed)
    }
    return envelope
  }

  async function fetchPdf(operation: string, path: string): Promise<SmartbillPdfResponse> {
    if (!fetchImpl) {
      throw new Error("SmartBill client requires a fetch implementation")
    }
    assertRateLimitCircuitClosed(operation)
    const response = await resilientFetch(
      `${apiUrl}${path}`,
      {
        method: "GET",
        headers: { ...headers(), Accept: "application/octet-stream" },
      },
      {
        timeoutMs,
        breaker,
        // PDF downloads are pure reads — always safe to retry.
        retry: surfacingRetry(maxAttemptsFor(true), retryTuning),
        fetchImpl: asResilientFetch(fetchImpl),
      },
    )
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw buildApiError(operation, response.status, text, parseJson(text))
    }
    const buffer = await response.arrayBuffer()
    const contentType = response.headers?.get("content-type") ?? "application/pdf"
    return { bytes: new Uint8Array(buffer), contentType }
  }

  function pdfQuery(companyVatCode: string, seriesName: string, number: string) {
    return `cif=${encodeURIComponent(companyVatCode)}&seriesname=${encodeURIComponent(seriesName)}&number=${encodeURIComponent(number)}`
  }

  function assertRateLimitCircuitClosed(operation: string) {
    if (!options.rateLimit?.circuitBreaker || !rateLimitCircuitOpenUntil) return

    const currentTime = now()
    if (currentTime.getTime() >= rateLimitCircuitOpenUntil.getTime()) {
      rateLimitCircuitOpenUntil = undefined
      return
    }

    throw new SmartbillRateLimitCircuitOpenError({
      operation,
      retryAfterAt: rateLimitCircuitOpenUntil,
      retryAfterMs: rateLimitCircuitOpenUntil.getTime() - currentTime.getTime(),
    })
  }

  function buildApiError(
    operation: string,
    status: number,
    text: string,
    parsed: unknown,
  ): SmartbillApiError {
    const rateLimit = parseSmartbillRateLimit(status, parsed, now())
    if (rateLimit) {
      if (options.rateLimit?.circuitBreaker && rateLimit.retryAfterAt) {
        rateLimitCircuitOpenUntil = rateLimit.retryAfterAt
      }
      return new SmartbillRateLimitError(
        `SmartBill ${operation} rate-limited: ${rateLimit.errorText}`,
        {
          operation,
          status,
          body: text,
          response: parsed,
          retryAfterMs: rateLimit.retryAfterMs,
          retryAfterAt: rateLimit.retryAfterAt,
          blockedAt: rateLimit.blockedAt,
        },
      )
    }

    const envelope = isRecord(parsed) ? (parsed as SmartbillEnvelope) : null
    const message =
      envelope?.errorText || envelope?.message
        ? `SmartBill ${operation} failed: ${envelope.errorText ?? envelope.message ?? "Error"}`
        : `SmartBill ${operation} failed (${status}): ${text}`
    return new SmartbillApiError(message, {
      operation,
      status,
      body: text,
      response: parsed,
    })
  }

  function parseJson(text: string) {
    try {
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }

  async function createInvoice(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse> {
    // No retry: POST creates an invoice and SmartBill has no idempotency
    // keys — a duplicate invoice is worse than a failed sync (the outbox
    // redelivers, and external-ref dedup skips already-created invoices).
    return request<SmartbillInvoiceResponse>("createInvoice", "POST", "/invoice", body)
  }

  async function createProforma(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse> {
    // No retry: creates a proforma document (same reasoning as createInvoice).
    return request<SmartbillInvoiceResponse>("createProforma", "POST", "/estimate", body)
  }

  async function convertEstimateToInvoice(
    companyVatCode: string,
    estimateSeriesName: string,
    estimateNumber: string,
    body: SmartbillInvoiceBody,
  ): Promise<SmartbillInvoiceResponse> {
    // No retry: POST creates the converted invoice (no idempotency keys).
    return request<SmartbillInvoiceResponse>("convertEstimateToInvoice", "POST", "/invoice", {
      ...body,
      companyVatCode,
      useEstimateDetails: true,
      estimate: {
        seriesName: estimateSeriesName,
        number: estimateNumber,
      },
      useStock: body.useStock ?? false,
    })
  }

  async function cancelInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEnvelope> {
    // Retried: cancel is an idempotent state-setter (cancelling twice is a no-op).
    return request<SmartbillEnvelope>("cancelInvoice", "PUT", "/invoice/cancel", {
      companyVatCode,
      seriesName,
      number,
    })
  }

  async function restoreInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEnvelope> {
    return request<SmartbillEnvelope>("restoreInvoice", "PUT", "/invoice/restore", {
      companyVatCode,
      seriesName,
      number,
    })
  }

  async function deleteInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEnvelope> {
    return request<SmartbillEnvelope>(
      "deleteInvoice",
      "DELETE",
      `/invoice?${pdfQuery(companyVatCode, seriesName, number)}`,
    )
  }

  async function reverseInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillInvoiceResponse> {
    // No retry despite the PUT: reversing issues a NEW credit-note style
    // reversal invoice, so a retried ambiguous failure could double-reverse.
    return request<SmartbillInvoiceResponse>(
      "reverseInvoice",
      "PUT",
      "/invoice/reverse",
      {
        companyVatCode,
        seriesName,
        number,
      },
      { retryable: false },
    )
  }

  async function viewInvoicePdf(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillPdfResponse> {
    return fetchPdf(
      "viewInvoicePdf",
      `/invoice/pdf?${pdfQuery(companyVatCode, seriesName, number)}`,
    )
  }

  async function viewEstimatePdf(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillPdfResponse> {
    return fetchPdf(
      "viewEstimatePdf",
      `/estimate/pdf?${pdfQuery(companyVatCode, seriesName, number)}`,
    )
  }

  async function getPaymentStatus(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillStatusResponse> {
    return request<SmartbillStatusResponse>(
      "getPaymentStatus",
      "GET",
      `/invoice/paymentstatus?${pdfQuery(companyVatCode, seriesName, number)}`,
    )
  }

  async function listTaxes(): Promise<SmartbillTaxesResponse> {
    return request<SmartbillTaxesResponse>("listTaxes", "GET", "/tax")
  }

  async function listSeries(): Promise<SmartbillSeriesResponse> {
    return request<SmartbillSeriesResponse>("listSeries", "GET", "/series")
  }

  async function listEstimateInvoices(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEstimateInvoicesResponse> {
    return request<SmartbillEstimateInvoicesResponse>(
      "listEstimateInvoices",
      "GET",
      `/estimate/invoices?${pdfQuery(companyVatCode, seriesName, number)}`,
    )
  }

  return {
    createInvoice,
    createProforma,
    convertEstimateToInvoice,
    cancelInvoice,
    restoreInvoice,
    deleteInvoice,
    reverseInvoice,
    viewInvoicePdf,
    viewPdf: viewInvoicePdf,
    viewEstimatePdf,
    getPaymentStatus,
    listTaxes,
    listSeries,
    listEstimateInvoices,
  }
}

function createGlobalSmartbillFetch(): SmartbillFetch | undefined {
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

function asResilientFetch(fetchImpl: SmartbillFetch): typeof fetch {
  return async (input, init = {}) => {
    const response = await fetchImpl(input instanceof Request ? input.url : String(input), {
      method: init.method ?? "GET",
      headers: headersForPluginFetch(init.headers),
      ...(typeof init.body === "string" ? { body: init.body } : {}),
    })
    if (response instanceof Response) return response
    const contentType = response.headers?.get("content-type")
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: contentType ? { "content-type": contentType } : undefined,
    })
  }
}
