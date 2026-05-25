import type {
  SmartbillEstimateInvoicesResponse,
  SmartbillFetch,
  SmartbillInvoiceBody,
  SmartbillInvoiceResponse,
  SmartbillPaymentEntry,
  SmartbillSeriesResponse,
  SmartbillStatusResponse,
  SmartbillTaxesResponse,
} from "./types.js"

export type SmartbillMockDocumentKind = "invoice" | "estimate"

export type SmartbillMockDocumentStatus =
  | "issued"
  | "cancelled"
  | "deleted"
  | "reversed"
  | "restored"

export interface SmartbillMockTax {
  name: string
  percentage: number
  default?: boolean
}

export interface SmartbillMockSeries {
  name: string
  type: SmartbillMockDocumentKind
  nextNumber: number
}

export interface SmartbillMockDocument {
  kind: SmartbillMockDocumentKind
  companyVatCode: string
  seriesName: string
  number: string
  status: SmartbillMockDocumentStatus
  body: SmartbillInvoiceBody
  url: string
  total: number
  paidAmount: number
  payments: SmartbillPaymentEntry[]
  createdAt: string
  convertedInvoices: SmartbillInvoiceResponse[]
}

export interface SmartbillMockServerOptions {
  taxes?: SmartbillMockTax[]
  series?: SmartbillMockSeries[]
  now?: () => Date
}

export interface SmartbillMockListenOptions {
  port?: number
  hostname?: string
}

export interface SmartbillMockServerHandle {
  apiUrl: string
  close: () => Promise<void>
}

export interface SmartbillMockRequest {
  method: string
  url: string
  body?: string
}

export interface SmartbillMockResponse {
  status: number
  headers: Record<string, string>
  /**
   * Serialised body. JSON endpoints emit a UTF-8 string; PDF endpoints
   * emit raw bytes. The HTTP listener writes both as-is; the in-process
   * `fetch` adapter exposes them through the matching Response method.
   */
  body: string | Uint8Array
}

export interface SmartbillMockServer {
  fetch: SmartbillFetch
  handleRequest: (request: SmartbillMockRequest) => Promise<SmartbillMockResponse>
  listen: (options?: SmartbillMockListenOptions) => Promise<SmartbillMockServerHandle>
  reset: () => void
  listDocuments: () => SmartbillMockDocument[]
  getDocument: (
    kind: SmartbillMockDocumentKind,
    companyVatCode: string,
    seriesName: string,
    number: string,
  ) => SmartbillMockDocument | null
  convertEstimateToInvoice: (args: {
    companyVatCode: string
    seriesName: string
    number: string
    invoiceSeriesName?: string
  }) => SmartbillInvoiceResponse
}

interface SmartbillNodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string
  url?: string
  headers: {
    host?: string | string[]
  }
}

interface SmartbillNodeResponse {
  setHeader: (key: string, value: string) => void
  statusCode: number
  end: (body: string | Uint8Array) => void
}

interface SmartbillNodeServer {
  listen: (port: number, hostname: string, callback: () => void) => void
  once: (event: "error", handler: (error: Error) => void) => void
  off: (event: "error", handler: (error: Error) => void) => void
  address: () => string | { port: number } | null
  close: (callback?: (error?: Error) => void) => void
}

interface SmartbillNodeHttp {
  createServer: (
    handler: (req: SmartbillNodeRequest, res: SmartbillNodeResponse) => void | Promise<void>,
  ) => SmartbillNodeServer
}

const defaultTaxes: SmartbillMockTax[] = [
  { name: "Normala", percentage: 19, default: true },
  { name: "Redusa", percentage: 9 },
  { name: "Redusa", percentage: 5 },
  { name: "Scutit", percentage: 0 },
]

const defaultSeries: SmartbillMockSeries[] = [
  { name: "SB-TEST", type: "invoice", nextNumber: 1 },
  { name: "PF-TEST", type: "estimate", nextNumber: 1 },
]

export function createSmartbillMockServer(
  options: SmartbillMockServerOptions = {},
): SmartbillMockServer {
  const documents = new Map<string, SmartbillMockDocument>()
  const taxes = options.taxes ?? defaultTaxes
  const initialSeries = options.series ?? defaultSeries
  const seriesCounters = new Map<string, SmartbillMockSeries>()
  const now = options.now ?? (() => new Date())

  function reset() {
    documents.clear()
    seriesCounters.clear()
    for (const item of initialSeries) {
      seriesCounters.set(seriesKey(item.type, item.name), { ...item })
    }
  }

  function listDocuments() {
    return [...documents.values()].map(cloneDocument)
  }

  function getDocument(
    kind: SmartbillMockDocumentKind,
    companyVatCode: string,
    seriesName: string,
    number: string,
  ) {
    const document = documents.get(documentKey(kind, companyVatCode, seriesName, number))
    return document ? cloneDocument(document) : null
  }

  function convertEstimateToInvoice(args: {
    companyVatCode: string
    seriesName: string
    number: string
    invoiceSeriesName?: string
  }): SmartbillInvoiceResponse {
    const estimate = findRequiredDocument(
      "estimate",
      args.companyVatCode,
      args.seriesName,
      args.number,
    )
    const invoice = createDocument("invoice", {
      ...estimate.body,
      seriesName: args.invoiceSeriesName ?? estimate.body.seriesName,
      mentions: appendTestMention(
        estimate.body.mentions,
        `Converted from proforma ${args.seriesName}-${args.number}`,
      ),
    })
    const response = toCreateResponse(invoice)
    estimate.convertedInvoices.push(response)
    documents.set(
      documentKey(estimate.kind, estimate.companyVatCode, estimate.seriesName, estimate.number),
      estimate,
    )
    return response
  }

  async function handleRequest(request: SmartbillMockRequest): Promise<SmartbillMockResponse> {
    const method = request.method.toUpperCase()
    const url = new URL(request.url, "http://smartbill-mock.local")
    const path = normalizeSmartbillPath(url.pathname)

    try {
      if (method === "GET" && path === "/tax") return json(200, taxesEnvelope(taxes))
      if (method === "GET" && path === "/series") return json(200, seriesEnvelope(listSeries()))

      if (method === "POST" && path === "/invoice") {
        const body = parseBody(request.body)
        if (body.useEstimateDetails === true && body.estimate) {
          return json(
            200,
            convertEstimateToInvoice({
              companyVatCode: body.companyVatCode,
              seriesName: body.estimate.seriesName,
              number: body.estimate.number,
              invoiceSeriesName: body.seriesName,
            }),
          )
        }
        return json(200, toCreateResponse(createDocument("invoice", body)))
      }

      if (method === "POST" && path === "/estimate") {
        return json(200, toCreateResponse(createDocument("estimate", parseBody(request.body))))
      }

      if (method === "GET" && path === "/invoice/pdf") {
        return pdf(findByQuery("invoice", url))
      }

      if (method === "GET" && path === "/estimate/pdf") {
        return pdf(findByQuery("estimate", url))
      }

      if (method === "GET" && path === "/estimate/invoices") {
        return json(200, estimateInvoicesEnvelope(findByQuery("estimate", url)))
      }

      if (method === "GET" && path === "/invoice/paymentstatus") {
        return json(200, paymentStatusEnvelope(findByQuery("invoice", url)))
      }

      if (method === "PUT" && path === "/invoice/cancel") {
        const invoice = updateInvoiceStatus(parseBody(request.body), "cancelled")
        return json(200, ackEnvelope(`Invoice ${invoice.seriesName}-${invoice.number} cancelled`))
      }

      if (method === "PUT" && path === "/invoice/reverse") {
        const invoice = updateInvoiceStatus(parseBody(request.body), "reversed")
        const reversal = createDocument("invoice", {
          ...invoice.body,
          products: invoice.body.products.map((product) => ({
            ...product,
            quantity: -Math.abs(product.quantity),
          })),
          mentions: appendTestMention(
            invoice.body.mentions,
            `Reversal for ${invoice.seriesName}-${invoice.number}`,
          ),
        })
        return json(200, toCreateResponse(reversal))
      }

      if (method === "PUT" && path === "/invoice/restore") {
        const invoice = updateInvoiceStatus(parseBody(request.body), "restored")
        return json(200, ackEnvelope(`Invoice ${invoice.seriesName}-${invoice.number} restored`))
      }

      if (method === "DELETE" && path === "/invoice") {
        const invoice = updateByQuery(url, "deleted")
        return json(200, ackEnvelope(`Invoice ${invoice.seriesName}-${invoice.number} deleted`))
      }

      return json(404, errorEnvelope(`SmartBill mock endpoint not found: ${method} ${path}`))
    } catch (error) {
      return json(
        error instanceof SmartbillMockError ? error.status : 500,
        errorEnvelope(error instanceof Error ? error.message : "SmartBill mock failed"),
      )
    }
  }

  const fetch: SmartbillFetch = async (input, init) => {
    const response = await handleRequest({
      method: init.method,
      url: input,
      body: init.body,
    })
    const isBinary = response.body instanceof Uint8Array
    const bytes = isBinary
      ? (response.body as Uint8Array)
      : new TextEncoder().encode(response.body as string)
    const text = isBinary
      ? new TextDecoder().decode(response.body as Uint8Array)
      : (response.body as string)
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => {
        if (isBinary) throw new Error("SmartBill mock response is not JSON")
        return JSON.parse(text)
      },
      text: async () => text,
      arrayBuffer: async () => {
        const copy = new ArrayBuffer(bytes.byteLength)
        new Uint8Array(copy).set(bytes)
        return copy
      },
      headers: {
        get: (name) => response.headers[name.toLowerCase()] ?? null,
      },
    }
  }

  async function listen(listenOptions: SmartbillMockListenOptions = {}) {
    const { createServer } = await importNodeHttp()
    const hostname = listenOptions.hostname ?? "127.0.0.1"
    const server = createServer(async (req, res) => {
      const chunks: Uint8Array[] = []
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk)
      }
      const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host
      const requestUrl = new URL(req.url ?? "/", `http://${host ?? hostname}`)
      const response = await handleRequest({
        method: req.method ?? "GET",
        url: requestUrl.toString(),
        body: new TextDecoder().decode(concat(chunks)),
      })
      for (const [key, value] of Object.entries(response.headers)) {
        res.setHeader(key, value)
      }
      res.statusCode = response.status
      res.end(response.body)
    })

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(listenOptions.port ?? 0, hostname, () => {
        server.off("error", reject)
        resolve()
      })
    })

    const address = server.address()
    if (!address || typeof address === "string") {
      server.close()
      throw new Error("SmartBill mock server failed to resolve its listening address")
    }

    return {
      apiUrl: `http://${hostname}:${address.port}`,
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error?: Error) => (error ? reject(error) : resolve()))
        }),
    }
  }

  function createDocument(kind: SmartbillMockDocumentKind, body: SmartbillInvoiceBody) {
    const seriesName = body.seriesName
    const number = nextNumber(kind, seriesName)
    const companyVatCode = body.companyVatCode
    const total = totalAmount(body, taxes)
    const paid = paidAmount(body, total)
    const payments: SmartbillPaymentEntry[] = body.payment
      ? [
          {
            type: body.payment.type,
            value: paid,
            paidDate: now().toISOString().slice(0, 10),
            isCash: body.payment.isCash,
          },
        ]
      : []
    const document: SmartbillMockDocument = {
      kind,
      companyVatCode,
      seriesName,
      number,
      status: "issued",
      body: {
        ...body,
        mentions: appendTestMention(body.mentions, "TEST DOCUMENT - SmartBill local mock"),
      },
      url: `smartbill-mock://test-document/${kind}/${encodeURIComponent(companyVatCode)}/${encodeURIComponent(seriesName)}/${number}.pdf`,
      total,
      paidAmount: paid,
      payments,
      createdAt: now().toISOString(),
      convertedInvoices: [],
    }
    documents.set(documentKey(kind, companyVatCode, seriesName, number), document)
    return document
  }

  function nextNumber(kind: SmartbillMockDocumentKind, seriesName: string) {
    const key = seriesKey(kind, seriesName)
    const series = seriesCounters.get(key) ?? { name: seriesName, type: kind, nextNumber: 1 }
    const number = String(series.nextNumber)
    seriesCounters.set(key, { ...series, nextNumber: series.nextNumber + 1 })
    return number
  }

  function listSeries() {
    return [...seriesCounters.values()].map((item) => ({ ...item }))
  }

  function findByQuery(kind: SmartbillMockDocumentKind, url: URL) {
    const companyVatCode = url.searchParams.get("cif") ?? url.searchParams.get("companyVatCode")
    const seriesName = url.searchParams.get("seriesname") ?? url.searchParams.get("seriesName")
    const number = url.searchParams.get("number")
    if (!companyVatCode || !seriesName || !number) {
      throw new SmartbillMockError(
        400,
        "SmartBill mock request is missing cif, seriesname, or number",
      )
    }
    return findRequiredDocument(kind, companyVatCode, seriesName, number)
  }

  function findRequiredDocument(
    kind: SmartbillMockDocumentKind,
    companyVatCode: string,
    seriesName: string,
    number: string,
  ) {
    const document = documents.get(documentKey(kind, companyVatCode, seriesName, number))
    if (!document) {
      throw new SmartbillMockError(404, `SmartBill mock ${kind} not found: ${seriesName}-${number}`)
    }
    return document
  }

  function updateInvoiceStatus(body: unknown, status: SmartbillMockDocumentStatus) {
    const reference = parseInvoiceReference(body)
    const invoice = findRequiredDocument(
      "invoice",
      reference.companyVatCode,
      reference.seriesName,
      reference.number,
    )
    invoice.status = status
    documents.set(
      documentKey("invoice", reference.companyVatCode, reference.seriesName, reference.number),
      invoice,
    )
    return invoice
  }

  function updateByQuery(url: URL, status: SmartbillMockDocumentStatus) {
    const invoice = findByQuery("invoice", url)
    invoice.status = status
    documents.set(
      documentKey("invoice", invoice.companyVatCode, invoice.seriesName, invoice.number),
      invoice,
    )
    return invoice
  }

  function pdf(document: SmartbillMockDocument): SmartbillMockResponse {
    const label = `${document.kind === "estimate" ? "Proforma" : "Invoice"} ${document.seriesName}-${document.number} (TEST)`
    return {
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${document.seriesName}-${document.number}.pdf"`,
        "x-mock-pdf-url": document.url,
      },
      body: createPlaceholderPdf(label),
    }
  }

  reset()

  return {
    fetch,
    handleRequest,
    listen,
    reset,
    listDocuments,
    getDocument,
    convertEstimateToInvoice,
  }
}

class SmartbillMockError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function normalizeSmartbillPath(pathname: string) {
  return pathname.replace(/^\/SBORO\/api/, "") || "/"
}

function json(status: number, payload: unknown): SmartbillMockResponse {
  return {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  }
}

function parseBody(body: string | undefined): SmartbillInvoiceBody {
  if (!body) throw new SmartbillMockError(400, "SmartBill mock request requires a JSON body")
  try {
    return JSON.parse(body) as SmartbillInvoiceBody
  } catch {
    throw new SmartbillMockError(400, "SmartBill mock request body is not valid JSON")
  }
}

function parseInvoiceReference(body: unknown) {
  const value = body as Partial<{
    companyVatCode: unknown
    seriesName: unknown
    number: unknown
  }>
  if (
    typeof value.companyVatCode !== "string" ||
    typeof value.seriesName !== "string" ||
    typeof value.number !== "string"
  ) {
    throw new SmartbillMockError(
      400,
      "SmartBill mock invoice reference requires companyVatCode, seriesName, and number",
    )
  }
  return {
    companyVatCode: value.companyVatCode,
    seriesName: value.seriesName,
    number: value.number,
  }
}

function totalAmount(body: SmartbillInvoiceBody, taxes: SmartbillMockTax[]) {
  return roundMoney(
    body.products.reduce((total, product) => {
      const lineNet = product.price * product.quantity
      if (product.isTaxIncluded) return total + lineNet
      return total + lineNet * (1 + taxPercentage(product.taxPercentage, taxes) / 100)
    }, 0),
  )
}

function taxPercentage(lineTaxPercentage: number | undefined, taxes: SmartbillMockTax[]) {
  if (typeof lineTaxPercentage === "number" && Number.isFinite(lineTaxPercentage)) {
    return lineTaxPercentage
  }
  return taxes.find((tax) => tax.default)?.percentage ?? defaultTaxes[0]?.percentage ?? 0
}

function paidAmount(body: SmartbillInvoiceBody, total: number) {
  return roundMoney(Math.min(total, body.payment?.value ?? 0))
}

function toCreateResponse(document: SmartbillMockDocument): SmartbillInvoiceResponse {
  return {
    status: "Ok",
    message: "",
    errorText: "",
    series: document.seriesName,
    number: document.number,
    url: document.url,
  }
}

function ackEnvelope(message: string): SmartbillInvoiceResponse {
  return { status: "Ok", message, errorText: "" }
}

function errorEnvelope(message: string): SmartbillInvoiceResponse {
  return { status: "Error", message: "", errorText: message }
}

function taxesEnvelope(taxes: SmartbillMockTax[]): SmartbillTaxesResponse {
  return {
    status: "Ok",
    message: "",
    errorText: "",
    taxes: taxes.map(({ name, percentage }) => ({ name, percentage })),
  }
}

function seriesEnvelope(series: SmartbillMockSeries[]): SmartbillSeriesResponse {
  return {
    status: "Ok",
    message: "",
    errorText: "",
    list: series.map((item) => ({
      name: item.name,
      nextNumber: item.nextNumber,
      type: item.type === "invoice" ? "f" : "p",
    })),
  }
}

function paymentStatusEnvelope(document: SmartbillMockDocument): SmartbillStatusResponse {
  const unpaid = Math.max(0, roundMoney(document.total - document.paidAmount))
  return {
    status: "Ok",
    message: paymentStatusMessage(document),
    errorText: "",
    paid: document.total > 0 && document.paidAmount >= document.total,
    invoiceTotalAmount: document.total,
    paidAmount: document.paidAmount,
    unpaidAmount: unpaid,
    payments: document.payments.map((entry) => ({ ...entry })),
  }
}

function paymentStatusMessage(document: SmartbillMockDocument): string {
  if (document.status === "cancelled") return "Invoice cancelled"
  if (document.status === "deleted") return "Invoice deleted"
  if (document.status === "reversed") return "Invoice reversed"
  return ""
}

function estimateInvoicesEnvelope(
  estimate: SmartbillMockDocument,
): SmartbillEstimateInvoicesResponse {
  const last = estimate.convertedInvoices[estimate.convertedInvoices.length - 1]
  return {
    status: "Ok",
    message: "",
    errorText: "",
    series: last?.series ?? "",
    number: last?.number ?? "",
    areInvoicesCreated: estimate.convertedInvoices.length > 0,
    invoices: estimate.convertedInvoices.map((invoice) => ({ ...invoice })),
  }
}

function appendTestMention(existing: string | undefined, mention: string) {
  return existing ? `${existing}\n${mention}` : mention
}

function seriesKey(kind: SmartbillMockDocumentKind, seriesName: string) {
  return `${kind}:${seriesName}`
}

function documentKey(
  kind: SmartbillMockDocumentKind,
  companyVatCode: string,
  seriesName: string,
  number: string,
) {
  return `${kind}:${companyVatCode}:${seriesName}:${number}`
}

function cloneDocument(document: SmartbillMockDocument): SmartbillMockDocument {
  return {
    ...document,
    body: structuredClone(document.body),
    payments: document.payments.map((entry) => ({ ...entry })),
    convertedInvoices: document.convertedInvoices.map((invoice) => ({ ...invoice })),
  }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function concat(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const combined = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}

async function importNodeHttp(): Promise<SmartbillNodeHttp> {
  const specifier = "node:http"
  return import(specifier) as Promise<SmartbillNodeHttp>
}

/**
 * Builds a small but well-formed single-page PDF that satisfies SDKs
 * expecting `application/pdf` bytes. The label is rendered on the page
 * so the file is recognisable when opened by hand.
 */
function createPlaceholderPdf(label: string): Uint8Array {
  const escapedLabel = label.replace(/[()\\]/g, (m) => `\\${m}`)
  const stream = `BT /F1 18 Tf 72 720 Td (${escapedLabel}) Tj ET`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  parts.push(encoder.encode("%PDF-1.4\n%"))
  // Binary marker: any four bytes >=128 satisfy PDF readers' "this file is binary" probe.
  parts.push(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  let length = parts.reduce((sum, p) => sum + p.byteLength, 0)
  const offsets: number[] = []
  for (let i = 0; i < objects.length; i++) {
    offsets.push(length)
    const chunk = encoder.encode(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`)
    parts.push(chunk)
    length += chunk.byteLength
  }
  const xrefStart = length
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  parts.push(encoder.encode(xref))
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.byteLength
  }
  return out
}
