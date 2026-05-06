import type { SmartbillFetch, SmartbillInvoiceBody, SmartbillInvoiceResponse } from "./types.js"

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
  body: string
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
  end: (body: string) => void
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
    const response = toDocumentResponse(invoice)
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
      if (method === "GET" && path === "/tax") return json(200, taxes)
      if (method === "GET" && path === "/series") return json(200, listSeries())

      if (method === "POST" && path === "/invoice") {
        return json(200, toDocumentResponse(createDocument("invoice", parseBody(request.body))))
      }

      if (method === "POST" && path === "/estimate") {
        return json(200, toDocumentResponse(createDocument("estimate", parseBody(request.body))))
      }

      if (method === "GET" && path === "/invoice/pdf") {
        return json(200, { url: findByQuery("invoice", url).url })
      }

      if (method === "GET" && path === "/estimate/pdf") {
        return json(200, { url: findByQuery("estimate", url).url })
      }

      if (method === "GET" && path === "/estimate/invoices") {
        return json(200, { invoices: findByQuery("estimate", url).convertedInvoices })
      }

      if (method === "GET" && path === "/invoice/paymentstatus") {
        const invoice = findByQuery("invoice", url)
        return json(200, {
          status:
            invoice.status === "cancelled" || invoice.status === "deleted"
              ? invoice.status
              : paymentStatus(invoice),
          paidAmount: invoice.paidAmount,
          unpaidAmount: Math.max(0, invoice.total - invoice.paidAmount),
        })
      }

      if (method === "PUT" && path === "/invoice/cancel") {
        updateInvoiceStatus(parseBody(request.body), "cancelled")
        return json(200, {})
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
        return json(200, toDocumentResponse(reversal))
      }

      if (method === "PUT" && path === "/invoice/restore") {
        updateInvoiceStatus(parseBody(request.body), "restored")
        return json(200, {})
      }

      if (method === "DELETE" && path === "/invoice") {
        updateByQuery(url, "deleted")
        return json(200, {})
      }

      return json(404, { errorText: `SmartBill mock endpoint not found: ${method} ${path}` })
    } catch (error) {
      return json(error instanceof SmartbillMockError ? error.status : 500, {
        errorText: error instanceof Error ? error.message : "SmartBill mock failed",
      })
    }
  }

  const fetch: SmartbillFetch = async (input, init) => {
    const response = await handleRequest({
      method: init.method,
      url: input,
      body: init.body,
    })
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => JSON.parse(response.body),
      text: async () => response.body,
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
      total: totalAmount(body),
      paidAmount: paidAmount(body),
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

function totalAmount(body: SmartbillInvoiceBody) {
  return roundMoney(
    body.products.reduce((total, product) => total + product.price * product.quantity, 0),
  )
}

function paidAmount(body: SmartbillInvoiceBody) {
  return roundMoney(Math.min(totalAmount(body), body.payment?.value ?? 0))
}

function paymentStatus(document: SmartbillMockDocument) {
  if (document.paidAmount >= document.total && document.total > 0) return "paid"
  if (document.paidAmount > 0) return "partially_paid"
  return "unpaid"
}

function toDocumentResponse(document: SmartbillMockDocument): SmartbillInvoiceResponse {
  return {
    series: document.seriesName,
    number: document.number,
    url: document.url,
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
