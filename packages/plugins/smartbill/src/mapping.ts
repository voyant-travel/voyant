import type {
  SmartbillClient,
  SmartbillInvoiceBody,
  SmartbillProduct,
  VoyantInvoiceEvent,
} from "./types.js"

export type SmartbillMaybePromise<T> = T | Promise<T>

export type SmartbillEventValue<T> = T | ((event: VoyantInvoiceEvent) => SmartbillMaybePromise<T>)

const DEFAULT_ART311_SPECIAL_REGIME_TEXT =
  "Regimul special de taxare - agentie de turism (Art. 311 Cod Fiscal)"

const COUNTRY_CODE_OVERRIDES: Record<string, string> = {
  RO: "Romania",
}

/**
 * Options for the default invoice mapper.
 */
export interface SmartbillMappingOptions {
  /** Romanian company VAT code (e.g. `"RO12345678"`). */
  companyVatCode: string
  /** SmartBill invoice series name (e.g. `"A"`), or an event-specific resolver. */
  seriesName: SmartbillEventValue<string>
  /** Invoice language. Defaults to `"RO"`. */
  language?: string
  /** Whether VAT is included in line item prices. Defaults to `true`. */
  isTaxIncluded?: boolean
  /** SmartBill product unit name. Defaults to `"buc"`. */
  measuringUnitName?: SmartbillEventValue<string | null | undefined>
  /** Whether to use Art. 311 special regime (margin scheme for travel). */
  art311SpecialRegime?: boolean
  /** Text appended to mentions when Art. 311 special regime is enabled. */
  art311SpecialRegimeText?: string
  /** SmartBill mentions override, or an event-specific resolver. Defaults to event.mentions. */
  mentions?: SmartbillEventValue<string | null | undefined>
  /** SmartBill observations override, or an event-specific resolver. Defaults to event.observations. */
  observations?: SmartbillEventValue<string | null | undefined>
}

interface ResolvedMappingOptions {
  companyVatCode: string
  seriesName: string
  language?: string
  isTaxIncluded?: boolean
  measuringUnitName?: string
  art311SpecialRegime?: boolean
  art311SpecialRegimeText?: string
  mentions?: string
  observations?: string
  hasMentionsOverride: boolean
  hasObservationsOverride: boolean
}

/**
 * Extract the SmartBill client block from a Voyant invoice event.
 * Falls back to SmartBill-parseable defaults for fields the API treats as required.
 */
export function mapClient(event: VoyantInvoiceEvent): SmartbillClient {
  const vatCode = asStringOrUndefined(event.clientVatCode ?? event.customerVatCode)

  return {
    name: asString(event.clientName ?? event.customerName, "Client"),
    vatCode,
    regCom: asStringOrUndefined(event.clientRegCom),
    address: asString(event.clientAddress ?? event.customerAddress, "-"),
    city: asString(event.clientCity ?? event.customerCity, "-"),
    county: asStringOrUndefined(event.clientCounty ?? event.customerCounty),
    country:
      normalizeCountryName(asStringOrUndefined(event.clientCountry ?? event.customerCountry)) ??
      "Romania",
    isTaxPayer: Boolean(vatCode),
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
  options: Pick<SmartbillMappingOptions, "isTaxIncluded"> & { measuringUnitName?: string },
): SmartbillProduct[] {
  const items = event.lineItems
  if (!Array.isArray(items)) return []

  return items.map((item: Record<string, unknown>) => ({
    name: asString(item.description ?? item.name, "Item"),
    code: asStringOrUndefined(item.code ?? item.sku),
    measuringUnitName: asString(
      item.measuringUnitName ?? item.measureUnit ?? item.unit ?? options.measuringUnitName,
      "buc",
    ),
    quantity: asNumber(item.quantity, 1),
    price: asNumber(item.unitPrice ?? item.price, 0),
    currency: asString(item.currency ?? event.currency, "RON"),
    isTaxIncluded: options.isTaxIncluded ?? true,
    isDiscount: false,
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
  return buildSmartbillInvoiceBody(event, resolveMappingOptionsSync(event, options))
}

/**
 * Async variant of the default mapper. Use this when mapping options include
 * promise-returning callbacks such as `seriesName`, `mentions`, or
 * `observations`.
 */
export async function mapVoyantInvoiceToSmartbillAsync(
  event: VoyantInvoiceEvent,
  options: SmartbillMappingOptions,
): Promise<SmartbillInvoiceBody> {
  return buildSmartbillInvoiceBody(event, await resolveMappingOptions(event, options))
}

function buildSmartbillInvoiceBody(
  event: VoyantInvoiceEvent,
  options: ResolvedMappingOptions,
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
  if (event.externalAllocationRequired === true) body.number = ""
  if (typeof event.dueDate === "string") body.dueDate = event.dueDate
  if (typeof event.issueDate === "string") body.issueDate = event.issueDate
  if (typeof event.deliveryDate === "string") body.deliveryDate = event.deliveryDate
  const exchangeRate = asNumberOrUndefined(
    event.effectiveRate ?? event.fxRate ?? event.exchangeRate,
  )
  if (exchangeRate) body.exchangeRate = exchangeRate

  const mentions = options.hasMentionsOverride
    ? options.mentions
    : asStringOrUndefined(event.mentions)
  if (mentions) body.mentions = mentions

  const observations = options.hasObservationsOverride
    ? options.observations
    : asStringOrUndefined(event.observations)
  if (observations) body.observations = observations

  const fxCommissionMention = asStringOrUndefined(event.fxCommissionInvoiceMention)
  if (fxCommissionMention && asNumber(event.fxCommissionBps, 0) > 0) {
    body.mentions = [body.mentions, fxCommissionMention].filter(Boolean).join("\n")
  }

  if (options.art311SpecialRegime) {
    body.mentions = [
      body.mentions,
      options.art311SpecialRegimeText ?? DEFAULT_ART311_SPECIAL_REGIME_TEXT,
    ]
      .filter(Boolean)
      .join("\n")
  }

  return body
}

// --- helpers ---

function resolveMappingOptionsSync(
  event: VoyantInvoiceEvent,
  options: SmartbillMappingOptions,
): ResolvedMappingOptions {
  return {
    companyVatCode: options.companyVatCode,
    seriesName: resolveRequiredEventValueSync(event, options.seriesName, "seriesName"),
    language: options.language,
    isTaxIncluded: options.isTaxIncluded,
    measuringUnitName: normalizeOptionalText(
      resolveEventValueSync(event, options.measuringUnitName, "measuringUnitName"),
    ),
    art311SpecialRegime: options.art311SpecialRegime,
    art311SpecialRegimeText: options.art311SpecialRegimeText,
    mentions: normalizeOptionalText(resolveEventValueSync(event, options.mentions, "mentions")),
    observations: normalizeOptionalText(
      resolveEventValueSync(event, options.observations, "observations"),
    ),
    hasMentionsOverride: options.mentions !== undefined,
    hasObservationsOverride: options.observations !== undefined,
  }
}

async function resolveMappingOptions(
  event: VoyantInvoiceEvent,
  options: SmartbillMappingOptions,
): Promise<ResolvedMappingOptions> {
  return {
    companyVatCode: options.companyVatCode,
    seriesName: await resolveRequiredEventValue(event, options.seriesName, "seriesName"),
    language: options.language,
    isTaxIncluded: options.isTaxIncluded,
    measuringUnitName: normalizeOptionalText(
      await resolveEventValue(event, options.measuringUnitName),
    ),
    art311SpecialRegime: options.art311SpecialRegime,
    art311SpecialRegimeText: options.art311SpecialRegimeText,
    mentions: normalizeOptionalText(await resolveEventValue(event, options.mentions)),
    observations: normalizeOptionalText(await resolveEventValue(event, options.observations)),
    hasMentionsOverride: options.mentions !== undefined,
    hasObservationsOverride: options.observations !== undefined,
  }
}

function resolveEventValueSync<T>(
  event: VoyantInvoiceEvent,
  value: SmartbillEventValue<T> | undefined,
  field: string,
): T | undefined {
  const resolved =
    typeof value === "function"
      ? (value as (event: VoyantInvoiceEvent) => SmartbillMaybePromise<T>)(event)
      : value
  if (isPromiseLike(resolved)) {
    throw new Error(
      `SmartBill mapping option "${field}" returned a Promise; use mapVoyantInvoiceToSmartbillAsync`,
    )
  }
  return resolved
}

function resolveRequiredEventValueSync<T>(
  event: VoyantInvoiceEvent,
  value: SmartbillEventValue<T>,
  field: string,
): T {
  const resolved = resolveEventValueSync(event, value, field)
  if (resolved === undefined || resolved === null) {
    throw new Error(`SmartBill mapping option "${field}" is required`)
  }
  return resolved
}

async function resolveEventValue<T>(
  event: VoyantInvoiceEvent,
  value: SmartbillEventValue<T> | undefined,
): Promise<T | undefined> {
  return typeof value === "function"
    ? await (value as (event: VoyantInvoiceEvent) => SmartbillMaybePromise<T>)(event)
    : value
}

async function resolveRequiredEventValue<T>(
  event: VoyantInvoiceEvent,
  value: SmartbillEventValue<T>,
  field: string,
): Promise<T> {
  const resolved = await resolveEventValue(event, value)
  if (resolved === undefined || resolved === null) {
    throw new Error(`SmartBill mapping option "${field}" is required`)
  }
  return resolved
}

function isPromiseLike<T>(value: T | Promise<T> | undefined): value is Promise<T> {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as { then?: unknown }).then === "function"
  )
}

function normalizeOptionalText(value: string | null | undefined) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function normalizeCountryName(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const upper = trimmed.toUpperCase()
  const overridden = COUNTRY_CODE_OVERRIDES[upper]
  if (overridden) return overridden

  if (/^[A-Z]{2}$/.test(upper)) {
    try {
      const displayName = new Intl.DisplayNames(["en"], { type: "region" }).of(upper)
      return displayName && displayName !== upper && displayName !== "Unknown Region"
        ? displayName
        : trimmed
    } catch {
      return trimmed
    }
  }

  return trimmed
}

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

function asNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  return undefined
}
