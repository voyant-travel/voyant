/**
 * Minimal shape for Voyant invoice events. The plugin accepts anything with
 * at least these fields; everything else is passed through to the mapper.
 */
export interface VoyantInvoiceEvent {
  id: string
  invoiceNumber?: string
  [key: string]: unknown
}

/**
 * SmartBill invoice line item (product).
 * @see https://api.smartbill.ro/#!/Factura/createInvoice
 */
export interface SmartbillProduct {
  name: string
  code?: string
  measureUnit: string
  quantity: number
  price: number
  currency: string
  isTaxIncluded: boolean
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
  isDraft?: boolean
  currency: string
  language?: string
  dueDate?: string
  issueDate?: string
  deliveryDate?: string
  precision?: number
  useEstimateDetails?: boolean
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
 * SmartBill API response for invoice creation.
 */
export interface SmartbillInvoiceResponse {
  number?: string
  series?: string
  url?: string
  errorText?: string
}

/**
 * SmartBill API response for PDF download.
 */
export interface SmartbillPdfResponse {
  url?: string
  errorText?: string
}

/**
 * SmartBill API response for invoice status.
 */
export interface SmartbillStatusResponse {
  status?: string
  paidAmount?: number
  unpaidAmount?: number
  errorText?: string
}

/**
 * Minimal `fetch` shape the SmartBill client depends on. Works with the global
 * `fetch` in Node 18+ / Cloudflare Workers / browsers, and is trivially
 * stubbable in tests.
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
}>
