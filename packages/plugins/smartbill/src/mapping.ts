import type {
  SmartbillClient,
  SmartbillInvoiceBody,
  SmartbillProduct,
  VoyantInvoiceEvent,
} from "./types.js"

/**
 * Options for the default invoice mapper.
 */
export interface SmartbillMappingOptions {
  /** Romanian company VAT code (e.g. `"RO12345678"`). */
  companyVatCode: string
  /** SmartBill invoice series name (e.g. `"A"`). */
  seriesName: string
  /** Invoice language. Defaults to `"RO"`. */
  language?: string
  /** Whether VAT is included in line item prices. Defaults to `true`. */
  isTaxIncluded?: boolean
  /** Whether to use Art. 311 special regime (margin scheme for travel). */
  art311SpecialRegime?: boolean
}

/**
 * Extract the SmartBill client block from a Voyant invoice event.
 * Falls back to empty strings for missing fields.
 */
export function mapClient(event: VoyantInvoiceEvent): SmartbillClient {
  return {
    name: asString(event.clientName ?? event.customerName, "Client"),
    vatCode: asStringOrUndefined(event.clientVatCode ?? event.customerVatCode),
    regCom: asStringOrUndefined(event.clientRegCom),
    address: asStringOrUndefined(event.clientAddress ?? event.customerAddress),
    city: asStringOrUndefined(event.clientCity ?? event.customerCity),
    county: asStringOrUndefined(event.clientCounty ?? event.customerCounty),
    country: asStringOrUndefined(event.clientCountry ?? event.customerCountry),
    email: asStringOrUndefined(event.clientEmail ?? event.customerEmail),
    phone: asStringOrUndefined(event.clientPhone ?? event.customerPhone),
    saveToDb: false,
  }
}

/**
 * Extract SmartBill product lines from a Voyant invoice event.
 * Expects `event.lineItems` to be an array of objects with at minimum
 * `description`/`name`, `quantity`, `unitPrice`, `currency`.
 */
export function mapLineItems(
  event: VoyantInvoiceEvent,
  options: SmartbillMappingOptions,
): SmartbillProduct[] {
  const items = event.lineItems
  if (!Array.isArray(items)) return []

  return items.map((item: Record<string, unknown>) => ({
    name: asString(item.description ?? item.name, "Item"),
    code: asStringOrUndefined(item.code ?? item.sku),
    measureUnit: asString(item.measureUnit ?? item.unit, "buc"),
    quantity: asNumber(item.quantity, 1),
    price: asNumber(item.unitPrice ?? item.price, 0),
    currency: asString(item.currency ?? event.currency, "RON"),
    isTaxIncluded: options.isTaxIncluded ?? true,
    taxName: asStringOrUndefined(item.taxName),
    taxPercentage: item.taxPercentage != null ? asNumber(item.taxPercentage, 0) : undefined,
    isService: item.isService === true,
    saveToDb: false,
  }))
}

/**
 * Map a full Voyant invoice event to a SmartBill invoice body.
 */
export function mapVoyantInvoiceToSmartbill(
  event: VoyantInvoiceEvent,
  options: SmartbillMappingOptions,
): SmartbillInvoiceBody {
  const body: SmartbillInvoiceBody = {
    companyVatCode: options.companyVatCode,
    client: mapClient(event),
    seriesName: options.seriesName,
    currency: asString(event.currency, "RON"),
    language: options.language ?? "RO",
    products: mapLineItems(event, options),
  }

  if (event.isDraft === true) body.isDraft = true
  if (typeof event.dueDate === "string") body.dueDate = event.dueDate
  if (typeof event.issueDate === "string") body.issueDate = event.issueDate
  if (typeof event.deliveryDate === "string") body.deliveryDate = event.deliveryDate
  if (typeof event.mentions === "string") body.mentions = event.mentions
  if (typeof event.observations === "string") body.observations = event.observations

  if (options.art311SpecialRegime) {
    body.mentions = [
      body.mentions,
      "Regimul special de taxare - agentie de turism (Art. 311 Cod Fiscal)",
    ]
      .filter(Boolean)
      .join("\n")
  }

  return body
}

// --- helpers ---

function asString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.length > 0) return value
  return fallback
}

function asStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value
  return undefined
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  return fallback
}
