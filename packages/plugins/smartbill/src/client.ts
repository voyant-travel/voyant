import { createCircuitBreaker, resilientFetch } from "@voyant-travel/utils/resilience"

import {
  SmartbillApiError,
  SmartbillRateLimitCircuitOpenError,
  SmartbillRateLimitError,
} from "./client/errors.js"
import { asResilientFetch, createGlobalSmartbillFetch } from "./client/fetch.js"
import { parseSmartbillRateLimit } from "./client/rate-limit.js"
import { type SmartbillResilienceOptions, surfacingRetry } from "./client/resilience.js"

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

export type { SmartbillResilienceOptions } from "./client/resilience.js"
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

export type { SmartbillApiErrorOptions } from "./client/errors.js"
export {
  SmartbillApiError,
  SmartbillRateLimitCircuitOpenError,
  SmartbillRateLimitError,
} from "./client/errors.js"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
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
