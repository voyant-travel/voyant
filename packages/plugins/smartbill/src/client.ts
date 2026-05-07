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
}

export interface SmartbillClientApi {
  /** Create an invoice. Returns the live envelope: series + number + URL + status/message. */
  createInvoice(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse>
  /** Create a proforma invoice. */
  createProforma(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse>
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

export function createSmartbillClient(options: SmartbillClientOptions): SmartbillClientApi {
  const apiUrl = (options.apiUrl ?? "https://ws.smartbill.ro/SBORO/api").replace(/\/$/, "")
  const fetchImpl = options.fetch ?? (globalThis.fetch as unknown as SmartbillFetch | undefined)

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
  ): Promise<T> {
    if (!fetchImpl) {
      throw new Error("SmartBill client requires a fetch implementation")
    }
    const init: { method: string; headers: Record<string, string>; body?: string } = {
      method,
      headers: headers(),
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    const response = await fetchImpl(`${apiUrl}${path}`, init)
    let text = ""
    let parsed: unknown = null
    try {
      text = await response.text()
      parsed = text ? JSON.parse(text) : null
    } catch {
      // leave parsed as null, surface text
    }
    if (!response.ok) {
      throw new Error(`SmartBill ${operation} failed (${response.status}): ${text}`)
    }
    const envelope = (parsed ?? {}) as T
    if (envelope.status === "Error" || envelope.errorText) {
      throw new Error(
        `SmartBill ${operation} failed: ${envelope.errorText ?? envelope.message ?? "Error"}`,
      )
    }
    return envelope
  }

  async function fetchPdf(operation: string, path: string): Promise<SmartbillPdfResponse> {
    if (!fetchImpl) {
      throw new Error("SmartBill client requires a fetch implementation")
    }
    const response = await fetchImpl(`${apiUrl}${path}`, {
      method: "GET",
      headers: { ...headers(), Accept: "application/pdf" },
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`SmartBill ${operation} failed (${response.status}): ${text}`)
    }
    const buffer = await response.arrayBuffer()
    const contentType = response.headers?.get("content-type") ?? "application/pdf"
    return { bytes: new Uint8Array(buffer), contentType }
  }

  function pdfQuery(companyVatCode: string, seriesName: string, number: string) {
    return `cif=${encodeURIComponent(companyVatCode)}&seriesname=${encodeURIComponent(seriesName)}&number=${encodeURIComponent(number)}`
  }

  async function createInvoice(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse> {
    return request<SmartbillInvoiceResponse>("createInvoice", "POST", "/invoice", body)
  }

  async function createProforma(body: SmartbillInvoiceBody): Promise<SmartbillInvoiceResponse> {
    return request<SmartbillInvoiceResponse>("createProforma", "POST", "/estimate", body)
  }

  async function cancelInvoice(
    companyVatCode: string,
    seriesName: string,
    number: string,
  ): Promise<SmartbillEnvelope> {
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
    return request<SmartbillInvoiceResponse>("reverseInvoice", "PUT", "/invoice/reverse", {
      companyVatCode,
      seriesName,
      number,
    })
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
