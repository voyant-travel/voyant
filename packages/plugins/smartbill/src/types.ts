/**
 * Minimal shape for Voyant invoice events. The plugin accepts anything with
 * at least these fields; everything else is passed through to the mapper.
 */
export interface VoyantInvoiceEvent {
  id: string
  invoiceNumber?: string
  externalAllocationRequired?: boolean
  [key: string]: unknown
}

/**
 * SmartBill invoice line item (product).
 * @see https://api.smartbill.ro/#!/Factura/createInvoice
 */
export interface SmartbillProduct {
  name: string
  code?: string
  /** SmartBill's invoice/estimate API field for the product unit name. */
  measuringUnitName?: string
  /** @deprecated SmartBill ignores this field; use `measuringUnitName`. */
  measureUnit?: string
  quantity: number
  price: number
  currency: string
  isTaxIncluded: boolean
  isDiscount?: boolean
  taxName?: string
  taxPercentage?: number
  isService?: boolean
  saveToDb?: boolean
  warehouseName?: string
}

/**
 * SmartBill invoice client.
 */
export interface SmartbillClient {
  name: string
  vatCode?: string
  regCom?: string
  address?: string
  city?: string
  county?: string
  country?: string
  isTaxPayer?: boolean
  email?: string
  phone?: string
  contact?: string
  saveToDb?: boolean
}

/**
 * SmartBill invoice body as accepted by the `POST /invoice` endpoint.
 */
export interface SmartbillInvoiceBody {
  companyVatCode: string
  client: SmartbillClient
  seriesName: string
  number?: string
  isDraft?: boolean
  currency: string
  language?: string
  dueDate?: string
  issueDate?: string
  deliveryDate?: string
  precision?: number
  useEstimateDetails?: boolean
  exchangeRate?: number
  mentions?: string
  observations?: string
  products: SmartbillProduct[]
  usePaymentTax?: boolean
  payment?: {
    type: string
    value: number
    isCash: boolean
  }
}

/**
 * Live-API response envelope shared by most SmartBill endpoints.
 *
 * The live API returns `status: "Ok"` on success and `status: "Error"` (or
 * an HTTP non-2xx) on failure. `errorText` carries the machine-readable
 * cause; `message` is a human-readable note.
 */
export interface SmartbillEnvelope {
  /** "Ok" on success, "Error" on failure. */
  status?: string
  message?: string
  errorText?: string
}

/**
 * SmartBill API response for invoice / estimate creation.
 */
export interface SmartbillInvoiceResponse extends SmartbillEnvelope {
  number?: string
  series?: string
  url?: string
}

/**
 * SmartBill API response for the PDF endpoints. Live SmartBill responds
 * with raw PDF bytes and `Content-Type: application/pdf`.
 */
export interface SmartbillPdfResponse {
  /** Raw PDF bytes returned by SmartBill. */
  bytes: Uint8Array
  /** Content-Type header from the response. */
  contentType: string
}

/**
 * SmartBill API response for `GET /invoice/paymentstatus`.
 *
 * Live shape: the envelope's `status` is `"Ok"` / `"Error"`, while payment
 * state is carried by `paid: boolean` plus the amount fields. `payments`
 * is the per-receipt list. The mock and the live API both populate these.
 */
export interface SmartbillStatusResponse extends SmartbillEnvelope {
  /** True when the invoice has been fully paid. */
  paid?: boolean
  invoiceTotalAmount?: number
  paidAmount?: number
  unpaidAmount?: number
  payments?: SmartbillPaymentEntry[]
}

export interface SmartbillPaymentEntry {
  type?: string
  value?: number
  paidDate?: string
  [key: string]: unknown
}

/**
 * Response shape for `GET /tax`.
 */
export interface SmartbillTaxesResponse extends SmartbillEnvelope {
  taxes?: Array<{ name: string; percentage: number }>
}

/**
 * Response shape for `GET /series`. `type` is `"f"` (factură / invoice) or
 * `"p"` (proformă).
 */
export interface SmartbillSeriesResponse extends SmartbillEnvelope {
  list?: Array<{ name: string; nextNumber: number; type: "f" | "p" }>
}

/**
 * Response shape for `GET /estimate/invoices` (proforma → invoice
 * conversion lookup).
 */
export interface SmartbillEstimateInvoicesResponse extends SmartbillEnvelope {
  series?: string
  number?: string
  areInvoicesCreated?: boolean
  invoices?: SmartbillInvoiceResponse[]
}

/**
 * Minimal `fetch` shape the SmartBill client depends on. Mirrors the
 * subset of the global `fetch` Response that the client uses, so the
 * global `fetch` and the mock server both fit.
 */
export type SmartbillFetch = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body?: string
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
  arrayBuffer: () => Promise<ArrayBuffer>
  headers?: { get(name: string): string | null }
}>
