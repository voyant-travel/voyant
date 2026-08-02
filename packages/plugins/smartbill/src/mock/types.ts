import type {
  SmartbillFetch,
  SmartbillInvoiceBody,
  SmartbillInvoiceResponse,
  SmartbillPaymentEntry,
} from "../types.js"

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

export interface SmartbillNodeRequest extends AsyncIterable<Uint8Array | string> {
  method?: string
  url?: string
  headers: {
    host?: string | string[]
  }
}

export interface SmartbillNodeResponse {
  setHeader: (key: string, value: string) => void
  statusCode: number
  end: (body: string | Uint8Array) => void
}

export interface SmartbillNodeServer {
  listen: (port: number, hostname: string, callback: () => void) => void
  once: (event: "error", handler: (error: Error) => void) => void
  off: (event: "error", handler: (error: Error) => void) => void
  address: () => string | { port: number } | null
  close: (callback?: (error?: Error) => void) => void
}

export interface SmartbillNodeHttp {
  createServer: (
    handler: (req: SmartbillNodeRequest, res: SmartbillNodeResponse) => void | Promise<void>,
  ) => SmartbillNodeServer
}
